// @file: novice-shadows.ts
// @desc: ground the novice during practice
import * as T from "three";

export interface NoviceShadowOptions {
  /** Share one compiled program across scenes under this key. */
  programCacheKey?: string;
}

export function noviceShadows(
  root: T.Group,
  { programCacheKey }: NoviceShadowOptions = {},
) {
  const opacity = new T.InstancedBufferAttribute(
    new Float32Array(8),
    1,
  ).setUsage(T.DynamicDrawUsage);
  const geometry = new T.PlaneGeometry(2, 2);
  geometry.setAttribute("contactStrength", opacity);
  const material = new T.MeshBasicMaterial({
    color: "#302d29",
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  if (programCacheKey) material.customProgramCacheKey = () => programCacheKey;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader =
      "attribute float contactStrength; varying float contactOpacity; varying vec2 contactUv;\n" +
      shader.vertexShader.replace(
        "#include <uv_vertex>",
        "#include <uv_vertex>\n contactUv=uv*2.-1.; contactOpacity=contactStrength;",
      );
    shader.fragmentShader =
      "varying float contactOpacity; varying vec2 contactUv;\n" +
      shader.fragmentShader.replace(
        "#include <color_fragment>",
        "#include <color_fragment>\n float falloff=max(0.,1.-dot(contactUv,contactUv)); diffuseColor.a*=contactOpacity*falloff*falloff*falloff;",
      );
  };
  const shadows = new T.InstancedMesh(geometry, material, 8);
  shadows.instanceMatrix.setUsage(T.DynamicDrawUsage);
  shadows.frustumCulled = false;
  root.add(shadows);
  const pose = new T.Object3D();
  pose.rotation.x = -Math.PI / 2;
  function shade(
    slot: number,
    x: number,
    y: number,
    z: number,
    width: number,
    depth: number,
    strength: number,
  ) {
    pose.position.set(x, y + 0.006, z);
    pose.scale.set(width, depth, 1);
    pose.updateMatrix();
    shadows.setMatrixAt(slot, pose.matrix);
    opacity.setX(slot, strength);
    shadows.instanceMatrix.needsUpdate = opacity.needsUpdate = true;
  }
  return {
    shade,
    kneeling: (active: boolean) => {
      shadows.count = active ? 8 : 3;
    },
  };
}
