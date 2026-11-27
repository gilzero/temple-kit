// @file: hall-hangings.ts
// @desc: suspend brocade lotus temple hangings
import * as T from "three";

interface HangingHall {
  x: number;
  z: number;
  innerWidth: number;
  rear: number;
  floor: number;
  rafterHeight: number;
  altar: readonly [number, number, number, number];
}

/** Hang brocade pennants along the flanks and beside the altar. */
export function hallHangings(hall: HangingHall, brocade: T.Texture) {
  const height = 2.92,
    width = 0.57;
  const cloth = new T.PlaneGeometry(width, height, 18, 36);
  const position = cloth.getAttribute("position");
  for (let i = 0; i < position.count; i++) {
    const u = position.getX(i) / width + 0.5,
      drop = 0.5 - position.getY(i) / height;
    const pleat = Math.sin(u * Math.PI * 6 + drop * 1.25);
    position.setZ(
      i,
      (0.008 + 0.023 * drop) * pleat + 0.025 * Math.sin(drop * Math.PI),
    );
  }
  cloth.computeVertexNormals();
  const pennants = new T.InstancedMesh(
    cloth,
    new T.MeshStandardMaterial({
      map: brocade,
      alphaTest: 0.42,
      side: T.DoubleSide,
      roughness: 0.82,
    }),
    6,
  );
  const pose = new T.Object3D();
  let next = 0;
  function hang(x: number, z: number, angle: number) {
    pose.position.set(x, hall.rafterHeight + hall.floor - height / 2 - 0.25, z);
    pose.rotation.y = angle;
    pose.updateMatrix();
    pennants.setMatrixAt(next++, pose.matrix);
  }
  for (const side of [-1, 1]) {
    const flank = hall.x + side * (hall.innerWidth / 2 - 0.31);
    for (const offset of [-1.75, 1.53])
      hang(flank, hall.z + offset, (-side * Math.PI) / 2);
    hang(hall.x + side * (hall.altar[2] / 2 + 1.1), hall.rear + 0.32, 0);
  }
  pennants.receiveShadow = pennants.castShadow = true;
  return pennants;
}
