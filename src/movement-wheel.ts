// @file: movement-wheel.ts
// @desc: track directional thumb movement

const deadZone = 0.16;

export function movementWheelGrip(dx: number, dy: number, thumbRadius: number) {
  // Grabbing the cap keeps the contact point under the finger. The rim selects a direction immediately.
  return Math.hypot(dx, dy) <= thumbRadius ? { x: dx, y: dy } : { x: 0, y: 0 };
}

type Box = { left: number; top: number; width: number; height: number };

/** Shift that carries the resting wheel under a thumb landing near it. */
export function movementWheelAnchor(
  x: number,
  y: number,
  home: Box,
  viewWidth: number,
  viewHeight: number,
) {
  const reach = 0.9;
  if (
    x < home.left - home.width * reach ||
    x > home.left + home.width * (1 + reach) ||
    y < home.top - home.height * reach
  )
    return undefined;
  const halfWidth = home.width / 2,
    halfHeight = home.height / 2;
  // The whole wheel stays on the screen.
  return {
    x:
      Math.max(halfWidth, Math.min(viewWidth - halfWidth, x)) -
      home.left -
      halfWidth,
    y:
      Math.max(halfHeight, Math.min(viewHeight - halfHeight, y)) -
      home.top -
      halfHeight,
  };
}

export function movementWheelInput(dx: number, dy: number, radius: number) {
  const distance = Math.hypot(dx, dy);
  if (distance === 0 || radius <= 0)
    return { offsetX: 0, offsetY: 0, right: 0, forward: 0 };

  const reach = Math.min(distance, radius);
  const travel = Math.max(0, (reach / radius - deadZone) / (1 - deadZone));
  const strength = travel * (0.6 + 0.4 * travel);
  const horizontal = dx / distance;
  const vertical = dy / distance;
  return {
    offsetX: reach * horizontal,
    offsetY: reach * vertical,
    right: strength === 0 ? 0 : strength * horizontal,
    forward: strength === 0 ? 0 : -strength * vertical,
  };
}

export function bindMovementWheel(
  wheel: HTMLElement,
  thumb: HTMLElement,
  onMove: (right: number, forward: number) => void,
  surround?: HTMLElement,
) {
  let enabled = false;
  let pointer: number | null = null;
  let centerX = 0,
    centerY = 0,
    radius = 0;
  let lastRight = 0,
    lastForward = 0;

  function emit(right: number, forward: number) {
    if (lastRight === right && lastForward === forward) return;
    lastRight = right;
    lastForward = forward;
    const steering = right !== 0 || forward !== 0;
    wheel.toggleAttribute("data-steering", steering);
    if (steering) {
      const heading = Math.atan2(right, forward) * (180 / Math.PI);
      wheel.style.setProperty("--wheel-heading", `${heading}deg`);
    } else {
      wheel.style.removeProperty("--wheel-heading");
    }
    onMove(right, forward);
  }

  function track(event: PointerEvent) {
    if (event.pointerId !== pointer) return;
    if (!wheel.hasPointerCapture(event.pointerId)) {
      reset();
      return;
    }
    const { offsetX, offsetY, right, forward } = movementWheelInput(
      event.clientX - centerX,
      event.clientY - centerY,
      radius,
    );
    thumb.style.translate = `${offsetX}px ${offsetY}px`;
    emit(right, forward);
  }

  function reset() {
    if (pointer === null) return;
    const held = pointer;
    pointer = null;
    if (wheel.hasPointerCapture(held)) wheel.releasePointerCapture(held);
    delete wheel.dataset.active;
    wheel.style.translate = "";
    thumb.style.translate = "";
    emit(0, 0);
  }

  function begin(event: PointerEvent) {
    if (!enabled || pointer !== null || event.button !== 0) return;
    const base = wheel.getBoundingClientRect();
    const knob = thumb.getBoundingClientRect();
    radius = Math.min(base.width - knob.width, base.height - knob.height) / 2;
    if (radius <= 0) return;
    if (event.pointerType === "mouse") {
      centerX = base.left + base.width / 2;
      centerY = base.top + base.height / 2;
      const grip = movementWheelGrip(
        event.clientX - centerX,
        event.clientY - centerY,
        Math.min(knob.width, knob.height) / 2,
      );
      centerX += grip.x;
      centerY += grip.y;
    } else {
      // A thumb starts at rest wherever it lands and the wheel comes to meet it.
      const anchor = movementWheelAnchor(
        event.clientX,
        event.clientY,
        base,
        window.innerWidth,
        window.innerHeight,
      );
      if (!anchor) return;
      wheel.style.translate = `${anchor.x}px ${anchor.y}px`;
      centerX = event.clientX;
      centerY = event.clientY;
    }
    // The scene leaves a claimed touch alone.
    event.preventDefault();
    wheel.setPointerCapture(event.pointerId);
    pointer = event.pointerId;
    wheel.dataset.active = "true";
    track(event);
  }
  wheel.addEventListener("pointerdown", begin);
  surround?.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse") begin(event);
  });
  // Pending capture can be taken away before the browser sends gotpointercapture.
  window.addEventListener("pointermove", track, true);
  function release(event: PointerEvent) {
    if (event.pointerId === pointer) reset();
  }
  window.addEventListener("pointerup", release, true);
  window.addEventListener("pointercancel", release, true);
  wheel.addEventListener("lostpointercapture", release);
  window.addEventListener("blur", reset);
  window.addEventListener("pagehide", reset);
  window.addEventListener("resize", reset);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) reset();
  });

  return {
    reset,
    setEnabled(value: boolean) {
      enabled = value;
      if (!enabled) reset();
    },
  };
}
