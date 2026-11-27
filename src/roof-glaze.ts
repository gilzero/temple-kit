// @file: roof-glaze.ts
// @desc: shade overlapping clay roof tiles
import type { MeshStandardMaterial } from "three";

export function glazeTiles(material: MeshStandardMaterial) {
  material.roughness = 0.73;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader =
      "attribute vec2 tileCourse; varying vec2 tileGrid;\n" +
      shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\n tileGrid = tileCourse;",
      );
    shader.fragmentShader =
      "varying vec2 tileGrid;\n" +
      shader.fragmentShader.replace(
        "#include <map_fragment>",
        `
      #ifdef USE_MAP
        vec3 grain = texture2D(map, vMapUv).rgb;
        diffuseColor.rgb *= .64 + .88 * sqrt(dot(grain, vec3(.2126,.7152,.0722)));
        vec2 footprint = max(fwidth(tileGrid), vec2(.001));
        if (tileGrid.x >= 0.) {
          float side = fract(tileGrid.x + .5) - .5;
          float edge = abs(side);
          float across = 1. - smoothstep(.23,.82,footprint.x);
          float along = 1. - smoothstep(.23,.82,footprint.y);
          float cover = 1. - smoothstep(.063,.215,edge);
          float row = tileGrid.y + .38 * cover;
          float seamDistance = abs(fract(row + .5) - .5);
          float seamAA = clamp(.42 * footprint.y, .008, .24);
          float joint = 1. - smoothstep(.025-seamAA,.025+seamAA,seamDistance);
          float toe = cos(6.283185 * clamp((edge-.14)/.14,0.,1.)-3.14159)*.5+.5;
          float crown = 1. - smoothstep(.012,.15,edge);
          float variation = fract(sin(dot(floor(vec2(tileGrid.x+.5,row)),vec2(61.37,17.53)))*12571.81);
          float fired = .91+.18*variation;
          float channel = 1. + across * (.21*crown - .19*toe - .05*(1.-cover));
          diffuseColor.rgb *= channel * mix(1.,fired,across*along) * (1.-.40*joint*along);
        }
      #endif`,
      );
  };
}
