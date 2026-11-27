// @file: timber-bench.ts
// @desc: shape carved village timber benches
import * as T from "three";
const timberBenchSize = {
  width: 2.3,
  depth: 0.664,
  height: 1.093,
  seatHeight: 0.527,
  footOffsetX: 0.995,
};

type Point = readonly [number, number, number];
type Texel = readonly [number, number];
type Profile = readonly [number, number, number];

export function timberBenchGeometry() {
  const positions: number[] = [],
    colors: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  const color = new T.Color();
  function vertex(p: Point, uv: Texel, tone: string) {
    const index = positions.length / 3;
    positions.push(...p);
    uvs.push(uv[0], 1 - uv[1] / 256);
    color.set(tone);
    colors.push(color.r, color.g, color.b);
    return index;
  }
  function quad(
    points: readonly [Point, Point, Point, Point],
    texels: readonly [Texel, Texel, Texel, Texel],
    tone: string,
  ) {
    const start = positions.length / 3;
    for (let k = 0; k < 4; k++) vertex(points[k]!, texels[k]!, tone);
    indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  }
  const strip = (
    start: number,
    end: number,
    top: number,
    bottom: number,
  ): [Texel, Texel, Texel, Texel] => [
    [start, bottom],
    [start, top],
    [end, top],
    [end, bottom],
  ];

  const seatSection = [
    [-0.306, 0.438],
    [0.234, 0.438],
    [0.234, 0.512],
    [0.219, timberBenchSize.seatHeight],
    [-0.301, timberBenchSize.seatHeight],
    [-0.325, 0.508],
    [-0.325, 0.461],
  ] as const;
  const halfWidth = timberBenchSize.width / 2;
  for (let i = 0; i < seatSection.length; i++) {
    const [z, y] = seatSection[i]!,
      [nextZ, nextY] = seatSection[(i + 1) % seatSection.length]!;
    const top = i === 3,
      start = top ? 4 : 140,
      end = top ? 74 : 149;
    quad(
      [
        [-halfWidth, y, z],
        [halfWidth, y, z],
        [halfWidth, nextY, nextZ],
        [-halfWidth, nextY, nextZ],
      ],
      [
        [0.01, start],
        [0.99, start],
        [0.99, end],
        [0.01, end],
      ],
      top ? "#fff7e9" : i === 4 ? "#ffeed6" : "#ddc6b1",
    );
  }
  for (const side of [-1, 1]) {
    const first = positions.length / 3;
    for (const [z, y] of seatSection)
      vertex(
        [side * halfWidth, y, z],
        [0.42 + z * 0.56, 249 - (y - 0.438) * 196],
        "#d7b8a0",
      );
    for (let i = 1; i < seatSection.length - 1; i++)
      if (side < 0) indices.push(first, first + i, first + i + 1);
      else indices.push(first, first + i + 1, first + i);
  }

  function rail(rows: readonly Profile[], rear: boolean) {
    const zAt = (y: number) => (rear ? 0.161 + (y - 0.48) * 0.12 : -0.277);
    const thickness = rear ? 0.085 : 0.072,
      tone = rear ? "#fff2de" : "#e7ccb1";
    const top = rear ? 89 : 184,
      bottom = rear ? 127 : 214;
    for (let i = 0; i < rows.length - 1; i++) {
      const [x1, lo1, hi1] = rows[i]!,
        [x2, lo2, hi2] = rows[i + 1]!;
      const a: Point = [x1, lo1, zAt(lo1)],
        b: Point = [x1, hi1, zAt(hi1)],
        c: Point = [x2, hi2, zAt(hi2)],
        d: Point = [x2, lo2, zAt(lo2)];
      const back = (p: Point): Point => [p[0], p[1], p[2] + thickness];
      const aa = back(a),
        bb = back(b),
        cc = back(c),
        dd = back(d);
      const u = 0.5 + x1 / 2.17,
        v = 0.5 + x2 / 2.17;
      quad([a, b, c, d], strip(u, v, top, bottom), tone);
      quad(
        [dd, cc, bb, aa],
        strip(v, u, top, bottom),
        rear ? "#efddc5" : "#d3bba2",
      );
      if (rear) quad([b, bb, cc, c], strip(u, v, 150, 157), "#ffe9ce");
      quad([aa, a, d, dd], strip(u, v, 159, 166), "#d4b89c");
    }
  }
  // The crest meets two leaning stiles. The cloud-cut apron is tenoned into the feet.
  rail(
    [
      [-0.978, 0.804, 1.045],
      [-0.81, 0.807, 1.042],
      [-0.53, 0.869, 0.998],
      [-0.23, 0.872, 1.046],
      [0, 0.891, 1.085],
      [0.23, 0.872, 1.046],
      [0.53, 0.869, 0.998],
      [0.81, 0.807, 1.042],
      [0.978, 0.804, 1.045],
    ],
    true,
  );
  rail(
    [
      [-0.974, 0.285, 0.45],
      [-0.804, 0.285, 0.45],
      [-0.756, 0.334, 0.45],
      [-0.644, 0.337, 0.45],
      [-0.568, 0.397, 0.45],
      [0.568, 0.397, 0.45],
      [0.644, 0.337, 0.45],
      [0.756, 0.334, 0.45],
      [0.804, 0.285, 0.45],
      [0.974, 0.285, 0.45],
    ],
    false,
  );

  for (const side of [-1, 1]) {
    for (const rear of [false, true]) {
      const top = rear ? timberBenchSize.height : 0.649;
      const lowerX = timberBenchSize.footOffsetX * side,
        upperX = 0.97 * side,
        lowerZ = rear ? 0.243 : -0.242,
        upperZ = rear ? 0.271 : -0.214;
      const corners = [
        [-1, -1],
        [-1, 1],
        [1, 1],
        [1, -1],
      ] as const;
      const corner = (i: number, high: boolean): Point => {
        const [x, z] = corners[i % 4]!,
          h = high ? 0.061 : 0.049;
        return [
          (high ? upperX : lowerX) + x * h,
          high ? top : 0.003,
          (high ? upperZ : lowerZ) + z * h,
        ];
      };
      for (let i = 0; i < 4; i++)
        quad(
          [
            corner(i, false),
            corner(i + 1, false),
            corner(i + 1, true),
            corner(i, true),
          ],
          [
            [0.04, 176],
            [0.04, 142],
            [0.91, 142],
            [0.91, 176],
          ],
          rear ? "#e1c5af" : "#ecd2b7",
        );
      if (rear)
        quad(
          [corner(0, true), corner(1, true), corner(2, true), corner(3, true)],
          strip(0.45, 0.52, 229, 247),
          "#edd2b5",
        );
    }
    const x = 0.97 * side,
      low = 0.638,
      high = 0.702,
      front = -0.282,
      back = 0.239,
      w = 0.068;
    const a: Point = [x - w, high, front],
      b: Point = [x - w, high, back],
      c: Point = [x + w, high, back],
      d: Point = [x + w, high, front];
    const under = (p: Point): Point => [p[0], low, p[2]];
    quad(
      [a, b, c, d],
      [
        [0.11, 147],
        [0.62, 147],
        [0.62, 174],
        [0.11, 174],
      ],
      "#f6dfc3",
    );
    quad(
      [under(a), under(b), b, a],
      [
        [0.11, 172],
        [0.62, 172],
        [0.62, 153],
        [0.11, 153],
      ],
      "#e0c1a5",
    );
    quad(
      [d, c, under(c), under(d)],
      [
        [0.11, 153],
        [0.62, 153],
        [0.62, 172],
        [0.11, 172],
      ],
      "#e0c1a5",
    );
    quad([under(a), a, d, under(d)], strip(0.44, 0.52, 230, 250), "#dfbfa2");
    quad(
      [under(d), under(c), under(b), under(a)],
      strip(0.11, 0.62, 143, 170),
      "#cab59f",
    );
  }
  const shape = new T.BufferGeometry();
  shape.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  shape.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
  shape.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  shape.setIndex(indices);
  shape.computeVertexNormals();
  return shape;
}
