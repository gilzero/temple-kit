// @file: giwa-roof.ts
// @desc: lay hipped clay tile roofs
import * as T from "three";

export type TileDetail = "far" | "middle" | "near";

export function giwaRoof(
  width: number,
  depth: number,
  rise: number,
  detail: TileDetail = "near",
  ridgeSpan?: number,
) {
  const long = Math.max(width, depth),
    short = Math.min(width, depth);
  const ridge =
    ridgeSpan === undefined
      ? Math.max((long - short) / 2, long * 0.22)
      : (long * ridgeSpan) / 2;
  const curl = Math.min(0.48, rise * 0.27);
  const positions: number[] = [],
    colors: number[] = [],
    uvs: number[] = [],
    coursesUv: number[] = [],
    faces: number[] = [];
  const slope = (v: number, edge: number) =>
    rise * v ** 1.55 + curl * edge ** 3 * (1 - v) ** 2;
  function vertex(
    x: number,
    y: number,
    z: number,
    u: number,
    v: number,
    light: number,
    tileU = -1,
    tileV = 0,
  ) {
    const i = positions.length / 3;
    positions.push(x, y, z);
    colors.push(light * 0.47, light * 0.57, light * 0.68);
    uvs.push(u, v);
    coursesUv.push(tileU, tileV);
    return i;
  }
  const corners = [
    [-long / 2, -short / 2],
    [long / 2, -short / 2],
    [long / 2, short / 2],
    [-long / 2, short / 2],
  ] as const;
  const profiles = {
    near: [
      [0, 0.076],
      [0.1, 0.061],
      [0.18, 0.027],
      [0.19, 0.004],
      [0.5, -0.015],
      [0.81, 0.004],
      [0.82, 0.027],
      [0.9, 0.061],
    ],
    middle: [
      [0, 0.076],
      [0.14, 0.045],
      [0.2, 0.004],
      [0.78, 0.004],
      [0.86, 0.045],
    ],
    far: [
      [0, 0.076],
      [0.19, 0.004],
      [0.81, 0.004],
    ],
  } as const;
  const profile = profiles[detail];
  for (const [side, a] of corners.entries()) {
    const b = corners[(side + 1) % 4]!;
    const span = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const tx = (b[0] - a[0]) / span,
      tz = (b[1] - a[1]) / span;
    const nx = tz,
      nz = -tx;
    const hips = side % 2 === 1;
    const run = hips ? long / 2 - ridge : short / 2;
    const cols = Math.round(span / 0.34),
      pitch = span / cols;
    const courses =
      detail === "far"
        ? 5
        : Math.ceil(Math.hypot(run, rise) / (detail === "near" ? 0.39 : 0.72));
    const columns = cols * profile.length + 1;
    function band(v: number, lip: number, shade: number) {
      const course = Math.round(v * courses);
      const start = positions.length / 3;
      for (let i = 0; i < columns; i++) {
        const [phase, relief] = profile[i % profile.length]!;
        const pan = Math.floor(i / profile.length);
        // Convex cover joints overlap the joint between two pans.
        const cover = relief > 0.02;
        const t =
          detail !== "far" && cover && course > 0 && course < courses
            ? v + 0.32 / courses
            : v;
        const half = T.MathUtils.lerp(span / 2, hips ? 0 : ridge, t);
        const mid = (hips ? long / 2 : short / 2) - run * t;
        const along = T.MathUtils.clamp(
          (pan + phase) * pitch - span / 2,
          -half,
          half,
        );
        const atHip = T.MathUtils.smoothstep(half - Math.abs(along), 0, 0.1);
        const height = slope(t, half ? Math.abs(along) / half : 0);
        const grain =
          0.97 +
          0.045 * Math.cos(2.13 * pan + 1.73 * side) +
          0.023 * Math.sin(pan * 0.85 + course * 2.5);
        vertex(
          nx * mid + tx * along,
          height + atHip * relief + lip,
          nz * mid + tz * along,
          along / span + 0.5,
          t,
          grain * shade * (cover ? 0.86 + 1.35 * relief : 0.97),
          (along + span / 2) / pitch,
          (t * Math.hypot(run, rise)) / 0.39,
        );
      }
      return start;
    }
    function join(lower: number, upper: number) {
      for (let j = 0; j < columns - 1; j++) {
        const a = lower + j,
          b = upper + j;
        // Clipped rows stop at the hip instead of fanning into the ridge.
        if (
          positions[a * 3] !== positions[(a + 1) * 3] ||
          positions[a * 3 + 2] !== positions[(a + 1) * 3 + 2]
        )
          faces.push(a, b, a + 1);
        if (
          positions[b * 3] !== positions[(b + 1) * 3] ||
          positions[b * 3 + 2] !== positions[(b + 1) * 3 + 2]
        )
          faces.push(a + 1, b, b + 1);
      }
    }
    let previous = band(0, -0.072, 0.56);
    for (let row = 0; row <= courses; row++) {
      if (detail === "near" && row) {
        const back = band(row / courses, 0, 0.93);
        join(previous, back);
        previous = back;
        if (row === courses) break;
      }
      const next = band(row / courses, 0.014, 1.02);
      join(previous, next);
      previous = next;
    }
    if (detail === "far") continue;
    // Round convex end tiles cap the raised seams along the eave.
    for (let col = 1; col < cols; col++) {
      const u = col / cols,
        along = (u - 0.5) * span;
      const x = (a[0] + b[0]) / 2 + along * tx + nx * 0.016;
      const z = (a[1] + b[1]) / 2 + along * tz + nz * 0.016;
      const cy = slope(0, Math.abs(2 * u - 1)) + 0.013;
      const center = vertex(
        x + nx * 0.018,
        cy,
        z + nz * 0.018,
        0.15,
        0.4,
        1.16,
      );
      const steps = detail === "near" ? 16 : 8,
        radius = 0.088;
      for (let ring = 0; ring < 2; ring++) {
        for (let k = 0; k < steps; k++) {
          const tip = k % 2;
          const r = radius * (ring ? 1 : 0.54 + 0.27 * tip);
          const theta = (2 * Math.PI * k) / steps,
            dx = r * Math.cos(theta),
            dy = r * Math.sin(theta);
          const petal = ring ? 0.003 : tip * 0.016;
          vertex(
            x + dx * tx + nx * petal,
            cy + dy,
            z + dx * tz + nz * petal,
            0.15 + dx * 0.19,
            0.4 + dy * 0.19,
            ring ? 1.24 : 0.81 + 0.4 * tip,
          );
        }
      }
      for (let k = 0; k < steps; k++) {
        const p = center + 1 + k,
          q = center + 1 + ((k + 1) % steps);
        faces.push(center, q, p, p, q, q + steps, p, q + steps, p + steps);
      }
    }
  }

  function tiledRidge(
    ax: number,
    az: number,
    bx: number,
    bz: number,
    hip: boolean,
  ) {
    const length = Math.hypot(bx - ax, bz - az);
    const nx = (bz - az) / length,
      nz = (ax - bx) / length;
    const count = Math.ceil(length / (detail === "near" ? 0.38 : 0.82)),
      radius = hip ? 0.105 : 0.145;
    const bedEdge = hip
      ? ([[-1, -0.76]] as const)
      : ([
          [-0.91, -1.35],
          [-0.91, -0.62],
          [-1.06, -0.56],
          [-1.06, -0.39],
          [-0.92, -0.34],
          [-0.92, -0.07],
        ] as const);
    const cross = [
      ...bedEdge,
      [-1, 0],
      [-0.77, 0.63],
      [0, 1],
      [0.77, 0.63],
      [1, 0],
      ...bedEdge.map(([side, up]) => [-side, up] as const).reverse(),
    ] as const;
    let previous = -1;
    for (let row = 0; row < count; row++) {
      for (const end of [0, 1]) {
        const t = (row + end) / count,
          x = T.MathUtils.lerp(ax, bx, t),
          z = T.MathUtils.lerp(az, bz, t);
        const bed = hip
          ? slope(t, 1) + 0.01
          : rise + 0.038 + 0.055 * (2 * t - 1) ** 4;
        const first = positions.length / 3;
        for (const [side, up] of cross)
          vertex(
            x + side * radius * nx,
            bed + up * radius + (1 - end) * 0.018,
            z + side * radius * nz,
            (side + 1) * 0.12,
            t,
            (0.84 + 0.14 * up) * (end ? 0.86 : 1.12),
          );
        if (previous >= 0)
          for (let k = 0; k < cross.length - 1; k++)
            faces.push(
              previous + k,
              first + k,
              previous + k + 1,
              previous + k + 1,
              first + k,
              first + k + 1,
            );
        if ((row === 0 && !end) || (row === count - 1 && end))
          for (let k = 1; k < cross.length - 1; k++) {
            if (end) faces.push(first, first + k + 1, first + k);
            else faces.push(first, first + k, first + k + 1);
          }
        previous = first;
      }
    }
  }
  for (const [x, z] of corners) tiledRidge(x, z, Math.sign(x) * ridge, 0, true);
  tiledRidge(-ridge, 0, ridge, 0, false);
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  g.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  g.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
  g.setAttribute("tileCourse", new T.Float32BufferAttribute(coursesUv, 2));
  g.setIndex(faces);
  g.computeVertexNormals();
  if (depth > width) g.rotateY(Math.PI / 2);
  return g;
}
