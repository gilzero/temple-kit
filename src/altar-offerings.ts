// @file: altar-offerings.ts
// @desc: shape celadon vases and chrysanthemums
import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export function chrysanthemumVase(porcelain = false) {
  const parts: T.BufferGeometry[] = [];
  const add = (geometry: T.BufferGeometry, color: string) => {
    geometry.deleteAttribute("uv");
    const count = geometry.getAttribute("position").count;
    const rgb = new T.Color(color);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) rgb.toArray(colors, i * 3);
    geometry.setAttribute("color", new T.BufferAttribute(colors, 3));
    parts.push(geometry);
  };
  const vessel = [
    [0.08, 0],
    [0.105, 0.015],
    [0.095, 0.045],
    [0.155, 0.11],
    [0.18, 0.2],
    [0.175, 0.27],
    [0.142, 0.33],
    [0.068, 0.38],
    [0.064, 0.44],
    [0.085, 0.455],
    [0.082, 0.47],
    [0.051, 0.467],
    [0.05, 0.415],
  ] as const;
  const profile = vessel.map(([r, y]) => new T.Vector2(r, y));
  const porcelainProfile = porcelain
    ? profile.flatMap((p, i) => {
        const next = profile[i + 1];
        if (!next) return [p];
        const count = Math.max(1, Math.ceil(Math.abs(next.y - p.y) / 0.009));
        return Array.from({ length: count }, (_, j) =>
          p.clone().lerp(next, j / count),
        );
      })
    : profile;
  const jar = new T.LatheGeometry(porcelainProfile, porcelain ? 72 : 16);
  add(jar, porcelain ? "#e4e1d1" : "#96b3a0");
  if (porcelain) {
    const positions = jar.getAttribute("position"),
      colors = jar.getAttribute("color");
    const blue = new T.Color("#345782"),
      light = new T.Color("#e4e1d1"),
      pigment = new T.Color();
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i),
        theta = Math.atan2(positions.getX(i), positions.getZ(i));
      const lotus = ((theta * 4 + Math.PI * 3) % (2 * Math.PI)) - Math.PI;
      const v = (y - 0.21) / 0.081;
      const petals =
        Math.hypot(lotus * 0.85, v) -
        (0.72 + 0.23 * Math.cos(5 * Math.atan2(v, lotus * 0.85)));
      const bands = Math.min(
        ...[0.042, 0.065, 0.314, 0.329, 0.433].map((h) => Math.abs(y - h)),
      );
      const paint = Math.max(
        1 - T.MathUtils.smoothstep(Math.abs(petals), 0.06, 0.22),
        1 - T.MathUtils.smoothstep(bands, 0.001, 0.008),
      );
      pigment.copy(light).lerp(blue, paint);
      colors.setXYZ(i, pigment.r, pigment.g, pigment.b);
    }
  }
  const up = new T.Vector3(0, 1, 0);
  const petalShape = new T.BufferGeometry();
  petalShape.setAttribute(
    "position",
    new T.Float32BufferAttribute(
      [
        0, -1, 0, 1, 0.21, 0, 0.2, 1, -0.6, -0.86, 0.14, 0, 0, 0.12, 1, 0, 0.1,
        -0.24,
      ],
      3,
    ),
  );
  petalShape.setIndex([
    4, 0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 5, 1, 0, 5, 2, 1, 5, 3, 2, 5, 0, 3,
  ]);
  petalShape.computeVertexNormals();
  const stem = (a: T.Vector3, b: T.Vector3) => {
    const axis = b.clone().sub(a);
    const geometry = new T.CylinderGeometry(0.012, 0.014, axis.length(), 5);
    geometry.applyQuaternion(
      new T.Quaternion().setFromUnitVectors(up, axis.normalize()),
    );
    geometry.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    add(geometry, "#59694e");
  };
  for (const [x, y, z, scale, tilt] of [
    [-0.23, 0.86, 0.015, 0.9, 0.28],
    [0.04, 1.04, -0.015, 1, 0.44],
    [0.24, 0.8, 0.075, 0.85, 0.2],
    [-0.015, 0.71, 0.12, 0.7, 0.65],
  ] as const) {
    const root = new T.Vector3(x * 0.13, 0.425, 0);
    const bend = new T.Vector3(x * 0.39, y - 0.17, z * 0.51);
    const bloom = new T.Vector3(x, y, z);
    stem(root, bend);
    stem(bend, bloom);
    const leaf = new T.SphereGeometry(1, 5, 3);
    leaf.scale(0.032, 0.1, 0.017);
    leaf.rotateZ(x < 0 ? 0.82 : -0.82);
    leaf.translate(bend.x + (x < 0 ? -0.06 : 0.06), bend.y + 0.033, bend.z);
    add(leaf, "#667d59");
    for (const [petals, radius, color] of [
      [12, 0.078, "#f0e2bc"],
      [8, 0.047, "#fff1d3"],
    ] as const) {
      for (let i = 0; i < petals; i++) {
        const angle = ((i + 0.31) * Math.PI * 2) / petals;
        const petal = petalShape.clone();
        petal.scale(0.022 * scale, radius * 0.63 * scale, 0.011 * scale);
        petal.rotateX(-0.28);
        petal.translate(0, radius * 0.56 * scale, petals === 8 ? 0.019 : 0);
        petal.rotateZ(angle);
        petal.rotateX(-tilt);
        petal.translate(x, y, z);
        add(petal, porcelain ? (petals === 8 ? "#ecc8c6" : "#bb7896") : color);
      }
    }
    const center = new T.SphereGeometry(0.027 * scale, 6, 4);
    center.translate(x, y + 0.011, z + 0.021);
    add(center, "#d3a450");
  }
  const geometry = mergeGeometries(parts);
  petalShape.dispose();
  for (const part of parts) part.dispose();
  return geometry;
}
