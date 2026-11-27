// @file: orbit.ts
// @desc: orbit and zoom around walkers
import { MathUtils } from "three";

type Contact = {
  x: number;
  y: number;
  startX: number;
  startY: number;
  dragged: boolean;
};

export interface OrbitOptions {
  /** Lowest camera pitch; below zero the camera dips to look up at eaves. */
  minPitch?: number;
}

export function bindOrbit(
  canvas: HTMLCanvasElement,
  tap: (x: number, y: number) => void,
  { minPitch = 0.08 }: OrbitOptions = {},
) {
  const view = {
    angle: Math.PI / 2,
    pitch: 0.23,
    distance: 6.3,
    revision: 0,
    firstPerson: false,
    bowing: false,
    eyePitch: 0,
  };
  const fromEye = () => view.firstPerson && !view.bowing;
  const bound = new AbortController();
  const { signal } = bound;
  const contacts = new Map<number, Contact>();
  let pinch = 0;
  const separation = () => {
    const [a, b] = contacts.values();
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };
  function reset() {
    for (const id of contacts.keys())
      if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    contacts.clear();
    delete canvas.dataset.dragging;
  }
  function look(horizontal: number, vertical: number) {
    view.angle -= horizontal;
    if (fromEye())
      view.eyePitch = MathUtils.clamp(view.eyePitch + vertical, -1.35, 1.35);
    else view.pitch = MathUtils.clamp(view.pitch - vertical, minPitch, 0.88);
    view.revision++;
  }
  canvas.addEventListener(
    "pointerdown",
    (e) => {
      if (e.defaultPrevented || e.button !== 0 || contacts.size >= 2) return;
      canvas.setPointerCapture(e.pointerId);
      contacts.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
        startX: e.clientX,
        startY: e.clientY,
        dragged: false,
      });
      if (contacts.size === 2) {
        pinch = separation();
        for (const contact of contacts.values()) contact.dragged = true;
      }
    },
    { signal },
  );
  canvas.addEventListener(
    "pointermove",
    (e) => {
      const contact = contacts.get(e.pointerId);
      if (!contact) return;
      const dx = e.clientX - contact.x,
        dy = e.clientY - contact.y;
      contact.x = e.clientX;
      contact.y = e.clientY;
      contact.dragged ||=
        Math.hypot(contact.x - contact.startX, contact.y - contact.startY) > 5;
      if (contacts.size === 2) {
        const distance = separation();
        if (!fromEye() && pinch && distance) {
          view.distance = MathUtils.clamp(
            (view.distance * pinch) / distance,
            2.4,
            9,
          );
          view.revision++;
        }
        pinch = distance;
      } else if (contact.dragged) {
        look(dx * 0.006, -dy * 0.004);
      }
      if (contact.dragged) {
        canvas.dataset.dragging = "true";
      }
    },
    { signal },
  );
  const release = (e: PointerEvent) => {
    const contact = contacts.get(e.pointerId);
    contacts.delete(e.pointerId);
    if (!contacts.size) delete canvas.dataset.dragging;
    if (
      e.type === "pointerup" &&
      contact &&
      !contact.dragged &&
      Math.hypot(e.clientX - contact.startX, e.clientY - contact.startY) <= 5
    )
      tap(e.clientX, e.clientY);
  };
  for (const type of [
    "pointerup",
    "pointercancel",
    "lostpointercapture",
  ] as const)
    canvas.addEventListener(type, release, { signal });
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      if (fromEye()) return;
      view.revision++;
      view.distance = MathUtils.clamp(view.distance + e.deltaY * 0.005, 2.4, 9);
    },
    { passive: false, signal },
  );
  window.addEventListener("blur", reset, { signal });
  window.addEventListener("pagehide", reset, { signal });
  /** Let go of the canvas for a scene built after this one. */
  function unbind() {
    reset();
    bound.abort();
  }
  return { view, reset, look, unbind };
}
