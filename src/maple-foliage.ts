// @file: maple-foliage.ts
// @desc: light painted leaves in wind
import * as T from "three";

export function mapleFoliage(
  map: T.Texture,
  clock: { value: number },
  dusk: { value: number },
  preservePigment = false,
) {
  const material = new T.MeshStandardMaterial({
    map,
    alphaTest: 0.42,
    side: T.DoubleSide,
    roughness: 1,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.mapleTime = clock;
    shader.uniforms.mapleDusk = dusk;
    shader.vertexShader =
      "uniform float mapleTime, mapleDusk;\n" +
      shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
       vec3 twig = (modelMatrix * instanceMatrix[3]).xyz;
       vec3 eye = twig - cameraPosition;
       float nearby = 1. - smoothstep(196.,900.,dot(eye.xz,eye.xz));
       if (nearby > 0.) {
         float pulse = smoothstep(.35,.91,sin(.215*mapleTime-dot(twig.xz,vec2(.069,.045))));
         float wave = .68*sin(1.23*mapleTime+dot(twig.xz,vec2(.21,.14)))
                    + .32*sin(2.04*mapleTime+twig.y*1.7+twig.z*.38);
         float reach = dot(uv-vec2(.025,.14),vec2(.55,.45));
         float flex = nearby*pulse*wave*reach*(1.-.42*mapleDusk);
         transformed.z += .074*flex;
         transformed.y -= .015*flex;
         if (isPerspectiveMatrix(projectionMatrix) && dot(eye,eye) < 25.) {
           // Shorten only sprays close enough to sweep across the lens.
           float span = max(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz));
           float spread = smoothstep(.4,1.95,length(eye)-.22*span);
           float shorten = (1.-spread)*smoothstep(.36,.64,span);
           transformed = mix(transformed,vec3(${preservePigment ? "-.478,-.405" : "-.475,-.36"},0.),shorten);
         }
       }`,
      );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `vec4 leaves = texture2D(map, vMapUv);
       float grain = dot(leaves.rgb, vec3(.2126,.7152,.0722));
       diffuseColor.rgb *= ${preservePigment ? "vec3(.037) + 1.05*leaves.rgb" : "vec3(.25 + .95 * sqrt(grain))"};
       diffuseColor.a *= leaves.a;`,
    );
  };
  material.customProgramCacheKey = () =>
    preservePigment ? "lychee-bough" : "maple-leaf";
  return material;
}
