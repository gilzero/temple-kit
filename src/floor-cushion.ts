// @file: floor-cushion.ts
// @desc: shape woven temple floor cushions
import * as T from "three";

export function floorCushion() {
  const positions: number[] = [],
    uvs: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  const vertex = (x: number, y: number, z: number, shade: number) => {
    positions.push(x, y, z);
    uvs.push(x + 0.5, z + 0.5);
    colors.push(shade, shade, shade);
  };
  const rings = [
    [0.93, -0.5, 0.62],
    [1, -0.16, 0.8],
    [1.009, -0.08, 1.3],
    [1, 0.035, 0.85],
    [0.96, 0.25, 0.92],
    [0.77, 0.39, 0.99],
  ] as const;
  for (const [scale, height, shade] of rings) {
    for (let corner = 0; corner < 4; corner++) {
      const cx = corner === 0 || corner === 3 ? 0.4 : -0.4,
        cz = corner < 2 ? 0.4 : -0.4;
      for (let arc = 0; arc < 3; arc++) {
        const a = ((corner + arc / 2) * Math.PI) / 2;
        vertex(
          (cx + Math.cos(a) * 0.1) * scale,
          height,
          (cz + Math.sin(a) * 0.1) * scale,
          shade,
        );
      }
    }
  }
  vertex(0, 0.5, 0, 1);
  for (let layer = 0; layer < rings.length; layer++) {
    for (let i = 0; i < 12; i++) {
      const current = layer * 12 + i,
        next = layer * 12 + ((i + 1) % 12);
      if (layer === rings.length - 1)
        indices.push(rings.length * 12, next, current);
      else
        indices.push(
          current,
          current + 12,
          next,
          next,
          current + 12,
          next + 12,
        );
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
