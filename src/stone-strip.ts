// @file: stone-strip.ts
// @desc: join stone courses through bends
import * as T from "three";

/** A ground-plane position as x and z. */
export type Coordinate = readonly [x: number, z: number];

export function stripEdges(line: readonly Coordinate[], radius: number) {
  const last = line.length - 1;
  const closed =
    line[0]![0] === line[last]![0] && line[0]![1] === line[last]![1];
  return line.map(([x, z], i) => {
    const before = line[i === 0 ? (closed ? last - 1 : 0) : i - 1]!;
    const after = line[i === last ? (closed ? 1 : last) : i + 1]!;
    const a = new T.Vector2(x - before[0], z - before[1]).normalize();
    const b = new T.Vector2(after[0] - x, after[1] - z).normalize();
    if (!closed && i === 0) a.copy(b);
    if (!closed && i === last) b.copy(a);
    const normal = new T.Vector2(-a.y - b.y, a.x + b.x).normalize();
    const miter = radius / Math.max(0.25, normal.dot(new T.Vector2(-b.y, b.x)));
    return [
      [x + normal.x * miter, z + normal.y * miter],
      [x - normal.x * miter, z - normal.y * miter],
    ] as const;
  });
}

export function stoneStrip(
  line: readonly Coordinate[],
  width: number,
  bottom: number | ((x: number, z: number) => number),
  top: number | ((x: number, z: number) => number),
) {
  const sides = stripEdges(line, width / 2);
  const positions: number[] = [];
  const uvs: number[] = [];
  const at = ([x, z]: Coordinate, y: typeof top) =>
    new T.Vector3(x, typeof y === "number" ? y : y(x, z), z);
  const start = line[0]!;
  const end = line[line.length - 1]!;
  const open = start[0] !== end[0] || start[1] !== end[1];
  function face(a: T.Vector3, b: T.Vector3, c: T.Vector3, d: T.Vector3) {
    for (const p of [a, b, c, a, c, d]) {
      positions.push(p.x, p.y, p.z);
      uvs.push((p.x + p.y * 0.5) * 0.5, (p.z + p.y) * 0.5);
    }
  }
  for (let i = 1; i < sides.length; i++) {
    const [l, r] = sides[i - 1]!;
    const [s, t] = sides[i]!;
    const a = at(l, top);
    const b = at(r, top);
    const c = at(t, top);
    const d = at(s, top);
    face(a, d, c, b);
    face(at(l, bottom), at(s, bottom), d, a);
    face(at(t, bottom), at(r, bottom), b, c);
    if (open) {
      if (i === 1) face(at(r, bottom), at(l, bottom), a, b);
      if (i === sides.length - 1) face(at(s, bottom), at(t, bottom), c, d);
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}
