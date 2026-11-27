// @file: weathered-plaster.ts
// @desc: stain limewash beneath temple eaves
import type * as T from "three";

const limewash = [
  "#ebe3d3",
  "#ebe5d7",
  "#e8e0cf",
  "#e5ddcc",
  "#c75f44",
  "#eeece4",
  "#d9d6cb",
];

/** Match limewashed wall colours, plus any a temple adds to its palette. */
export function limewashMatcher(extra: readonly string[] = []) {
  const colours = new Set([...limewash, ...extra]);
  return (color: string) => colours.has(color);
}

export const isLimewash = limewashMatcher();

/** Brush marks, rain streaks and rising damp in world space. */
export function weatherPlaster(material: T.MeshStandardMaterial) {
  material.roughness = 0.96;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader =
      "varying vec3 plasterPoint, plasterFace;\n" +
      shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        plasterPoint=(modelMatrix*vec4(position,1.)).xyz;
        plasterFace=abs(mat3(modelMatrix)*normal);`,
      );
    shader.fragmentShader =
      `varying vec3 plasterPoint, plasterFace;
      float limeCell(vec2 c){return fract(sin(dot(mod(c,289.),vec2(127.1,311.7)))*43758.5453);}
      float limeNoise(vec2 p){
        vec2 c=floor(p),f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(limeCell(c),limeCell(c+vec2(1.,0.)),f.x),
          mix(limeCell(c+vec2(0.,1.)),limeCell(c+vec2(1.)),f.x),f.y);
      }
      ` +
      shader.fragmentShader.replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        vec2 p=vec2(plasterFace.x>plasterFace.z?plasterPoint.z:plasterPoint.x,plasterPoint.y);
        float wash=.6*limeNoise(p*vec2(.55,.8))+.4*limeNoise(p*vec2(1.9,2.4));
        float brush=limeNoise(p*vec2(3.1,17.));
        float streak=limeNoise(vec2(p.x*4.3,p.y*.31+.7*wash));
        float damp=1.-smoothstep(.25,1.15+.9*wash,p.y);
        diffuseColor.rgb*=.86+.17*wash+.05*brush;
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.44,.415,.34),.42*smoothstep(.56,.86,streak)*smoothstep(.2,.8,wash));
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.27,.265,.19),damp*(.2+.4*streak));`,
      );
  };
  material.customProgramCacheKey = () => "weathered-limewash";
}
