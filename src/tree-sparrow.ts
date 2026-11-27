// @file: tree-sparrow.ts
// @desc: model articulated tree sparrow plumage
import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// Each cross section pairs the painting's crown and belly with a half width in metres.
const body = [
  [0.015, 0.645, 0.651, 0.001],
  [0.026, 0.625, 0.67, 0.015],
  [0.06, 0.6, 0.663, 0.019],
  [0.14, 0.557, 0.63, 0.019],
  [0.21, 0.526, 0.615, 0.019],
  [0.27, 0.504, 0.635, 0.022],
  [0.34, 0.446, 0.667, 0.029],
  [0.42, 0.36, 0.737, 0.037],
  [0.5, 0.3, 0.787, 0.042],
  [0.57, 0.245, 0.795, 0.043],
  [0.64, 0.204, 0.785, 0.042],
  [0.69, 0.177, 0.764, 0.038],
  [0.72, 0.124, 0.743, 0.035],
  [0.76, 0.063, 0.712, 0.032],
  [0.8, 0.029, 0.664, 0.031],
  [0.84, 0.021, 0.598, 0.03],
  [0.88, 0.036, 0.489, 0.027],
  [0.9, 0.056, 0.381, 0.022],
  [0.916, 0.076, 0.302, 0.016],
  [0.933, 0.115, 0.24, 0.011],
  [0.945, 0.15, 0.231, 0.009],
  [0.965, 0.17, 0.221, 0.006],
  [0.98, 0.196, 0.213, 0.003],
  [0.986, 0.207, 0.21, 0.0005],
] as const;
const wing = [
  [0.27, 0.591, 0.594],
  [0.32, 0.525, 0.59],
  [0.38, 0.444, 0.579],
  [0.45, 0.365, 0.57],
  [0.53, 0.305, 0.557],
  [0.61, 0.245, 0.529],
  [0.67, 0.222, 0.49],
  [0.71, 0.224, 0.421],
  [0.74, 0.25, 0.367],
  [0.754, 0.307, 0.313],
] as const;
const length = 0.24,
  height = length / 2;
const yAt = (v: number) => (0.8 - v) * height - 0.034;
const zAt = (u: number) => (u - 0.57) * length;

export function treeSparrowGeometry() {
  const pieces: T.BufferGeometry[] = [];
  function shell(side: number, lowerBill = false) {
    const positions: number[] = [],
      colors: number[] = [],
      uvs: number[] = [],
      parts: number[] = [],
      faces: number[] = [];
    const sides = side ? 12 : 20,
      shade = new T.Color();
    const hinge = 0.933;
    const sections = lowerBill
      ? body.filter(([u]) => u >= hinge)
      : side
        ? wing
        : body;
    const stride = sides + 1;
    for (const [i, [u, top, bottom]] of sections.entries()) {
      const next = Math.max(
        1,
        body.findIndex((section) => section[0] >= u),
      );
      const a = body[next - 1]!,
        b = body[next]!;
      const t = (u - a[0]) / (b[0] - a[0]);
      const back = T.MathUtils.lerp(a[1], b[1], t),
        belly = T.MathUtils.lerp(a[2], b[2], t),
        width = T.MathUtils.lerp(a[3], b[3], t);
      for (let j = 0; j <= sides; j++) {
        const angle = (j * 2 * Math.PI) / sides;
        const v = T.MathUtils.lerp(top, bottom, 0.5 - 0.5 * Math.cos(angle));
        const radial = 1 - (2 * (v - back)) / (belly - back);
        const flank = width * Math.sqrt(Math.max(0, 1 - radial * radial));
        const x = side
          ? side * (flank + 0.0012 + 0.0028 * Math.sin(angle))
          : width * Math.sin(angle);
        positions.push(x, yAt(v), zAt(u));
        uvs.push(
          u,
          1 -
            T.MathUtils.lerp(
              top,
              bottom,
              0.03 + 0.94 * (0.5 - 0.5 * Math.cos(angle)),
            ),
        );
        const head = side
          ? 0
          : T.MathUtils.smoothstep(
              u - 0.24 * Math.max(0, v - 0.27),
              0.69,
              0.83,
            );
        parts.push(
          side,
          head,
          1,
          lowerBill ? T.MathUtils.smoothstep(u, hinge, 0.948) : 0,
        );
        const cheek = u > 0.76 && v > 0.18 && v < 0.39;
        shade
          .set(
            side
              ? "#947149"
              : u > 0.932
                ? "#3a3734"
                : cheek
                  ? "#e7ddc7"
                  : v < 0.24
                    ? "#915d3d"
                    : v > 0.53 && u > 0.31
                      ? "#d4c2a3"
                      : "#aa8864",
          )
          .toArray(colors, colors.length);
        if (i && j < sides) {
          if (
            !side &&
            u > hinge &&
            (j >= sides / 4 && j < (3 * sides) / 4) !== lowerBill
          )
            continue;
          const c = i * stride + j,
            p = c - stride;
          if (side < 0) faces.push(p, p + 1, c, c, p + 1, c + 1);
          else faces.push(p, c, p + 1, c, c + 1, p + 1);
        }
      }
    }
    // The two dark inner faces meet along the closed bill and part during a call.
    if (!side) {
      let previous: number | undefined;
      for (const [u, top, bottom, width] of body) {
        if (u < hinge) continue;
        const current = positions.length / 3;
        const gape = lowerBill ? T.MathUtils.smoothstep(u, hinge, 0.948) : 0;
        for (const edge of [-1, 1]) {
          positions.push(edge * width, yAt((top + bottom) / 2), zAt(u));
          uvs.push(0, 0);
          shade
            .set(lowerBill ? "#654138" : "#442e29")
            .toArray(colors, colors.length);
          parts.push(0, 1, 1, gape);
        }
        if (previous !== undefined) {
          if (lowerBill)
            faces.push(
              previous,
              current,
              previous + 1,
              previous + 1,
              current,
              current + 1,
            );
          else
            faces.push(
              previous,
              previous + 1,
              current,
              previous + 1,
              current + 1,
              current,
            );
        }
        previous = current;
      }
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
    g.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
    g.setAttribute("plumagePart", new T.Float32BufferAttribute(parts, 4));
    g.setIndex(faces);
    g.computeVertexNormals();
    pieces.push(g);
  }
  shell(0);
  shell(0, true);
  shell(-1);
  shell(1);
  function toe(
    a: T.Vector3,
    b: T.Vector3,
    base: number,
    tip: number,
    color: string,
  ) {
    const axis = b.clone().sub(a);
    const g = new T.CylinderGeometry(tip, base, axis.length(), 5, 1, true);
    g.applyQuaternion(
      new T.Quaternion().setFromUnitVectors(
        new T.Vector3(0, 1, 0),
        axis.normalize(),
      ),
    );
    g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    const count = g.getAttribute("position").count;
    const colors = new Float32Array(count * 3),
      tone = new T.Color(color);
    for (let i = 0; i < count; i++) tone.toArray(colors, i * 3);
    g.setAttribute(
      "uv",
      new T.Float32BufferAttribute(new Float32Array(count * 2), 2),
    );
    g.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
    g.setAttribute(
      "plumagePart",
      new T.Float32BufferAttribute(new Float32Array(count * 4), 4),
    );
    pieces.push(g);
  }
  for (const side of [-1, 1]) {
    const ankle = new T.Vector3(side * 0.015, -0.059, 0.008);
    toe(
      new T.Vector3(side * 0.011, -0.026, -0.009),
      ankle,
      0.0028,
      0.0019,
      "#9c775e",
    );
    for (const spread of [-1, 0, 1, 2]) {
      const back = spread === 2;
      const tip = new T.Vector3(
        ankle.x + (back ? 0 : spread * 0.007),
        -0.06,
        ankle.z + (back ? -0.012 : 0.017 - 0.004 * Math.abs(spread)),
      );
      toe(ankle, tip, 0.0018, 0.0012, "#ab8369");
      toe(
        tip,
        new T.Vector3(tip.x, -0.063, tip.z + (back ? -0.004 : 0.004)),
        0.00125,
        0.0003,
        "#715b4c",
      );
    }
  }
  const geometry = mergeGeometries(pieces);
  for (const piece of pieces) piece.dispose();
  return geometry;
}
