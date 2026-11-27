// @file: guanyin-carving.ts
// @desc: sculpt Guanyin robes and attributes
import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { carvedGrid } from "./carved-grid";
import { guanyinFace, type FaceStyle } from "./guanyin-face";

function carvedVeil(detailed: boolean) {
  // Profiles surround the normalized museum head, opening at the brow and falling over the shoulders.
  const rows = [
    [0.556, 0.161, 0.143, 1.59],
    [0.62, 0.162, 0.142, 1.39],
    [0.675, 0.124, 0.113, 1.18],
    [0.74, 0.108, 0.105, 1.12],
    [0.8, 0.111, 0.107, 1.06],
    [0.85, 0.12, 0.12, 0.84],
    [0.887, 0.121, 0.139, 0],
    [0.925, 0.119, 0.137, 0],
    [0.954, 0.097, 0.127, 0],
    [0.977, 0.068, 0.113, 0],
    [0.994, 0.033, 0.071, 0],
    [1.004, 0.005, 0.01, 0],
  ] as const;
  const positions: number[] = [];
  const steps = detailed ? 40 : 20;
  const bands = (rows.length - 1) * (detailed ? 3 : 1);
  const width = new T.SplineCurve(rows.map(([y, rx]) => new T.Vector2(rx, y)));
  const depth = new T.SplineCurve(
    rows.map(([y, , rz]) => new T.Vector2(rz, y)),
  );
  const edge = new T.SplineCurve(
    rows.map(([y, , , opening]) => new T.Vector2(opening, y)),
  );
  for (let j = 0; j <= bands; j++) {
    const t = j / bands,
      section = width.getPoint(t),
      y = section.y,
      rx = section.x,
      rz = depth.getPoint(t).x,
      opening = Math.max(0, edge.getPoint(t).x);
    for (let i = 0; i <= steps; i++) {
      const angle = opening + ((Math.PI * 2 - 2 * opening) * i) / steps;
      const back = (1 - Math.cos(angle)) * 0.5;
      const fold =
        0.0065 * Math.cos(8 * angle + y * 12) +
        0.003 * Math.sin(13 * angle - y * 17);
      const hem =
        (1 - T.MathUtils.smoothstep(y, 0.556, 0.628)) *
        (-0.13 * back ** 1.5 + 0.013 * Math.cos(angle * 6));
      positions.push(
        0.004 + Math.sin(angle) * (rx + fold),
        y + hem,
        Math.cos(angle) * (rz + fold) +
          (-0.006 + 0.015 * T.MathUtils.smoothstep(y, 0.875, 0.925)),
      );
    }
  }
  const cloth = carvedGrid(steps, positions);
  const normals = cloth.getAttribute("normal"),
    n = new T.Vector3(),
    seam = new T.Vector3();
  for (let j = 0; j <= bands; j++) {
    if (edge.getPoint(j / bands).x > 0.0001) continue;
    const a = j * (steps + 1),
      b = a + steps;
    n.fromBufferAttribute(normals, a)
      .add(seam.fromBufferAttribute(normals, b))
      .normalize();
    normals.setXYZ(a, n.x, n.y, n.z);
    normals.setXYZ(b, n.x, n.y, n.z);
  }
  return cloth;
}

type Point = readonly [number, number, number];
export function figureDetails(
  detailed: boolean,
  headOnly = false,
  face: FaceStyle = {},
) {
  const pieces: T.BufferGeometry[] = [];
  function cut(g: T.BufferGeometry, shade = 1) {
    g.deleteAttribute("uv");
    if (!g.hasAttribute("color")) {
      const colors = new Float32Array(
        g.getAttribute("position").count * 3,
      ).fill(shade);
      g.setAttribute("color", new T.BufferAttribute(colors, 3));
    }
    pieces.push(g);
  }
  function line(points: readonly Point[], radius: number, shade = 0.96) {
    cut(
      new T.TubeGeometry(
        new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p))),
        Math.max(6, points.length * (detailed ? 2 : 1)),
        radius,
        detailed ? 6 : 4,
        false,
      ),
      shade,
    );
  }
  function bead(
    x: number,
    y: number,
    z: number,
    rx: number,
    ry = rx,
    rz = rx,
    shade = 0.98,
  ) {
    cut(
      new T.SphereGeometry(1, detailed ? 8 : 6, detailed ? 6 : 4)
        .scale(rx, ry, rz)
        .translate(x, y, z),
      shade,
    );
  }
  cut(carvedVeil(detailed));
  cut(guanyinFace(detailed, "stone", face));
  const hair: number[] = [],
    curls: number[] = [];
  const columns = detailed ? 96 : 42,
    bands = detailed ? 10 : 4;
  for (let j = 0; j <= bands; j++) {
    const t = j / bands;
    for (let i = 0; i <= columns; i++) {
      const angle = (i / columns - 0.5) * 3.38,
        u = Math.abs(angle);
      const lock = 0.5 + 0.5 * Math.cos(23 * u - 1.25 * t - 1.65 * t * t);
      const wave = 0.0052 * lock * Math.sin(Math.PI * (0.065 + 0.9 * t));
      const hem =
        0.846 - 0.033 * (u / 1.69) ** 2 + 0.0035 * Math.exp((-u * u) / 0.044);
      const y = hem + (0.907 - hem) * t;
      hair.push(
        0.005 + (0.088 + wave) * Math.sin(angle),
        y,
        0.002 + (0.108 + wave) * Math.cos(angle),
      );
      const shade = 0.78 + 0.17 * lock;
      curls.push(shade, shade, shade);
    }
  }
  cut(carvedGrid(columns, hair, curls));
  if (headOnly) {
    const head = mergeGeometries(pieces);
    for (const piece of pieces) piece.dispose();
    return head;
  }
  // The two outer folds fall from the wrists over the original carved robe.
  for (const side of [-1, 1]) {
    const p: number[] = [],
      edge: Point[] = [];
    const cols = detailed ? 22 : 10,
      rows = detailed ? 18 : 8;
    for (let j = 0; j <= rows; j++) {
      const t = j / rows;
      for (let i = 0; i <= cols; i++) {
        const u = i / cols,
          angle = u * Math.PI * 0.98;
        const crease =
          0.0062 * Math.sin(u * 21 + 0.83 * t) + 0.0028 * Math.cos(u * 43 - t);
        const inner = 0.055 + 0.032 * t,
          width = 0.082 + 0.016 * Math.sin(Math.PI * t) - 0.005 * t;
        const x =
          side *
          (inner +
            width * Math.sin(angle) +
            0.012 * u +
            crease -
            0.009 * t ** 5);
        const front = 0.09 + (side < 0 ? 0.029 : 0.019) * t;
        const z =
          -0.007 +
          (front + 0.007) * Math.cos(angle) +
          0.007 * Math.cos(u * 23 + t) -
          0.023 * t ** 5;
        const hem =
          0.147 +
          0.035 * u +
          0.024 * Math.cos(u * 3.5 * Math.PI + 0.4) +
          (side < 0 ? 0.013 : 0);
        const shoulder = (side < 0 ? 0.548 : 0.49) - 0.045 * u;
        const y = hem + (shoulder - hem) * t;
        p.push(x, y, z);
        if (i === 0 && (j % 3 === 0 || j === rows))
          edge.push([x, y, z + 0.0017]);
      }
    }
    cut(carvedGrid(cols, p, undefined, side < 0), 0.985);
    line(edge, 0.0019);
  }
  for (const side of [-1, 1]) {
    const pos: number[] = [],
      hem: Point[] = [];
    const cols = detailed ? 22 : 10,
      rows = detailed ? 10 : 5;
    for (let j = 0; j <= rows; j++) {
      const t = j / rows;
      for (let i = 0; i <= cols; i++) {
        const u = i / cols,
          a = Math.PI * u;
        const ripple = 0.0032 * Math.sin(4 * a + 1 - t);
        const x =
          side *
          (0.069 + 0.016 * t + (0.026 + 0.05 * t + ripple) * Math.sin(a));
        const z =
          -0.021 +
          (0.037 + 0.079 * t) * Math.cos(a) +
          0.005 * Math.cos(3 * a + t);
        const y =
          0.666 -
          0.109 * t -
          0.036 * Math.sin(a) * t * t -
          0.022 * (1 - u) * t +
          0.006 * Math.sin(2 * a);
        pos.push(x, y, z);
        if (j === rows && i % 2 === 0) hem.push([x, y, z]);
      }
    }
    cut(carvedGrid(cols, pos, undefined, side > 0), 0.986);
    line(hem, 0.002, 0.96);
  }
  const skirt: number[] = [];
  const rows = detailed ? 18 : 7,
    cols = detailed ? 28 : 12;
  for (let row = 0; row <= rows; row++) {
    const t = row / rows;
    for (let col = 0; col <= cols; col++) {
      const u = (2 * col) / cols - 1;
      const width = 0.074 + 0.035 * (1 - t) ** 2;
      const x = 0.003 + u * width;
      const y =
        0.049 +
        0.45 * t +
        0.024 * u * u +
        0.007 * (1 - t) ** 3 * Math.cos(6 * u);
      const z =
        0.068 +
        0.009 * Math.sin(t * Math.PI) -
        0.039 * u * u +
        (0.004 + 0.004 * (1 - t)) * Math.cos(u * 11 + 0.9 * t) +
        0.004 * (1 - t) * Math.cos(u * 20 - 0.4 * t);
      skirt.push(x, y, z);
    }
  }
  cut(carvedGrid(cols, skirt), 0.96);
  for (const [top, bottom] of [
    [0.476, 0.411],
    [0.418, 0.332],
  ] as const) {
    const points: Point[] = [];
    for (let i = 0; i <= 16; i++) {
      const u = i / 8 - 1;
      points.push([
        0.003 + u * 0.063,
        bottom + (top - bottom) * u * u,
        0.08 - 0.026 * u * u,
      ]);
    }
    line(points, 0.0022, 0.91);
  }
  // A folded brow band and a crescent clasp sit on the veil above the temples.
  for (const side of [-1, 1]) {
    line(
      [
        [0.004, 0.896, 0.139],
        [side * 0.038, 0.897, 0.135],
        [side * 0.072, 0.886, 0.111],
        [side * 0.094, 0.868, 0.082],
        [side * 0.101, 0.849, 0.064],
      ],
      0.0044,
    );
    line(
      [
        [side * 0.031, 0.936, 0.135],
        [side * 0.023, 0.925, 0.138],
        [side * 0.012, 0.921, 0.141],
        [0.003, 0.92, 0.144],
      ],
      0.0024,
      0.89,
    );
  }
  bead(0.003, 0.938, 0.138, 0.008, 0.011, 0.005, 0.93);
  bead(0.003, 0.924, 0.14, 0.011, 0.0037, 0.004, 0.91);
  for (let strand = 0; strand < 2; strand++) {
    const p: Point[] = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 8 - 1;
      const x = 0.004 + t * (0.052 + strand * 0.008),
        y = 0.633 - 0.026 * strand + 0.032 * t * t,
        z = 0.037 + strand * 0.015 - 0.052 * t * t;
      p.push([x, y, z]);
      if (detailed && i % 2 === 0) bead(x, y, z + 0.001, 0.003);
    }
    line(p, 0.002, 0.89);
  }
  for (let i = -2; i <= 2; i++) {
    const x = 0.003 + i * 0.011,
      top = 0.587 + 0.002 * Math.abs(i),
      end = 0.54 + 0.006 * Math.abs(i);
    line(
      [
        [x, top, 0.052],
        [x, 0.566, 0.053],
        [x, end, 0.058],
      ],
      0.0015,
    );
    bead(x, end, 0.058, 0.0038, 0.006, 0.0031);
  }
  // The mouth of the ritual vase points down from the left palm.
  const vaseAxis = new T.Vector3(-0.47, -0.76, 0.45).normalize();
  const vaseShape = [
    [0, 0],
    [0.018, 0],
    [0.019, 0.005],
    [0.017, 0.009],
    [0.022, 0.023],
    [0.024, 0.037],
    [0.021, 0.05],
    [0.013, 0.066],
    [0.009, 0.081],
    [0.009, 0.096],
    [0.013, 0.103],
    [0.013, 0.107],
    [0.0095, 0.108],
    [0.009, 0.103],
    [0, 0.101],
  ];
  const vase = new T.LatheGeometry(
    vaseShape.map(([r, y]) => new T.Vector2(r, y)),
    24,
  );
  vase.applyQuaternion(
    new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), vaseAxis),
  );
  cut(vase.translate(0.056, 0.493, 0.147), 0.985);
  const twig: Point[] = [
    [-0.109, 0.55, 0.123],
    [-0.101, 0.577, 0.132],
    [-0.094, 0.604, 0.131],
    [-0.072, 0.632, 0.12],
    [-0.049, 0.644, 0.115],
  ];
  line(twig, 0.0023, 0.9);
  const branch = new T.CatmullRomCurve3(twig.map((p) => new T.Vector3(...p)));
  for (let i = 0; i < 5; i++) {
    const t = (i + 1) / 6,
      base = branch.getPoint(t);
    const leaf = new T.SphereGeometry(1, 8, 6)
      .scale(0.0037, 0.015, 0.0024)
      .rotateZ(i % 2 ? -0.71 : 0.7)
      .translate(base.x + (i % 2 ? 0.006 : -0.006), base.y + 0.009, base.z);
    cut(leaf, 0.92);
  }
  const g = mergeGeometries(pieces);
  for (const p of pieces) p.dispose();
  return g;
}
