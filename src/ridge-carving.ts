// @file: ridge-carving.ts
// @desc: curve pierced ceramic ridge scrolls
import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

type Point = readonly [number, number];
const vines: readonly (readonly Point[])[] = [
  [
    [-0.93, 0],
    [-0.6, 0.07],
    [-0.24, 0.13],
    [-0.03, 0.23],
    [0.17, 0.4],
    [0.26, 0.62],
    [0.41, 0.79],
  ],
  [
    [-0.65, 0.05],
    [-0.47, 0.23],
    [-0.41, 0.4],
    [-0.25, 0.52],
    [-0.04, 0.54],
    [0.11, 0.46],
    [0.17, 0.4],
  ],
  [
    [-0.23, 0.14],
    [-0.1, 0.26],
    [-0.12, 0.35],
    [-0.24, 0.39],
    [-0.3, 0.32],
    [-0.25, 0.28],
  ],
  [
    [-0.4, 0.39],
    [-0.44, 0.5],
    [-0.52, 0.53],
    [-0.56, 0.61],
  ],
  [
    [0.1, 0.46],
    [0.1, 0.62],
    [0.18, 0.68],
    [0.16, 0.78],
  ],
];

function relief(close: boolean) {
  const branches = vines.map((points, branch) => {
    const curve = new T.SplineCurve(
      points.map(([x, y]) => new T.Vector2(x, y)),
    );
    const left: T.Vector2[] = [],
      right: T.Vector2[] = [];
    const segments = points.length * (close ? 2 : 1);
    for (let i = 0; i <= segments; i++) {
      const t = i / segments,
        p = curve.getPoint(t),
        tangent = curve.getTangent(t);
      const width =
        (branch === 0 ? 0.084 : 0.047) *
        (0.32 + 0.68 * Math.sin(Math.PI * (0.26 + t * 0.74)));
      const normal = new T.Vector2(-tangent.y * width, tangent.x * width);
      left.push(p.clone().add(normal));
      right.push(p.clone().sub(normal));
    }
    const contour = new T.Shape([...left, ...right.reverse()]);
    return new T.ExtrudeGeometry(contour, {
      depth: 0.1,
      bevelEnabled: close,
      bevelSegments: 1,
      bevelSize: 0.012,
      bevelThickness: 0.014,
    }).translate(0, 0, -0.05);
  });
  const carving = mergeGeometries(branches);
  branches.forEach((b) => b.dispose());
  return carving;
}

export function ridgeCarvings(material: T.Material) {
  const detailed = relief(true),
    distant = relief(false);
  return (width: number, depth: number, rise: number) => {
    const pieces: T.Matrix4[] = [],
      pose = new T.Object3D();
    const long = Math.max(width, depth),
      short = Math.min(width, depth);
    const ridge = Math.max((long - short) / 2, long * 0.22);
    const curl = Math.min(0.48, rise * 0.27);
    function add(
      x: number,
      y: number,
      z: number,
      angle: number,
      scale: number,
    ) {
      pose.position.set(x, y, z);
      pose.scale.setScalar(scale);
      pose.rotation.y = angle;
      pose.updateMatrix();
      pieces.push(pose.matrix.clone());
    }
    for (const side of [-1, 1]) {
      add(side * ridge, rise + 0.18, 0, side > 0 ? 0 : Math.PI, 1.05);
      for (const end of [-1, 1]) {
        const angle = Math.atan2((-end * short) / 2, side * (long / 2 - ridge));
        add(
          side * (long / 2 - 0.16),
          curl + 0.09,
          end * (short / 2 - 0.16),
          angle,
          0.78,
        );
      }
    }
    const levels = new T.LOD();
    for (const [geometry, distance] of [
      [detailed, 0],
      [distant, 29],
    ] as const) {
      const mesh = new T.InstancedMesh(geometry, material, pieces.length);
      pieces.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
      mesh.castShadow = mesh.receiveShadow = true;
      levels.addLevel(mesh, distance, 0.12);
    }
    if (depth > width) levels.rotation.y = Math.PI / 2;
    return levels;
  };
}
