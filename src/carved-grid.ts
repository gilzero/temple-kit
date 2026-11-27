// @file: carved-grid.ts
// @desc: join rows of sculpted vertices
import * as T from "three";

export function carvedGrid(
  columns: number,
  positions: number[],
  colors?: number[],
  reverse = false,
) {
  const indices: number[] = [];
  const stride = columns + 1,
    rows = positions.length / (3 * stride) - 1;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < columns; i++) {
      const a = j * stride + i,
        b = a + stride;
      if (reverse) indices.push(a, b, a + 1, a + 1, b, b + 1);
      else indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  if (colors) g.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}
