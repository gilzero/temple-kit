// @file: path-lantern.ts
// @desc: illuminate carved granite path lanterns
import * as T from "three";

const windowFloor = 0.944;
const windowPlane = 0.226 * Math.cos(Math.PI / 8);
const wickTop = 1.022;
const flameTip = 1.184;

export function pathLanternSpill(dx: number, dz: number, reach: number) {
  const radius = Math.sqrt(dx * dx + dz * dz);
  if (radius >= reach) return 0;
  const axial = Math.max(Math.abs(dx), Math.abs(dz));
  const penumbra =
    Math.min(Math.abs(dx), Math.abs(dz)) / Math.max(axial, 0.001);
  const window = 1 - T.MathUtils.smoothstep(penumbra, 0.26, 0.57);
  // Only the portion of the flame visible above the sill lights the ground directly.
  const sightline =
    (windowFloor * axial) / Math.max(0.001, axial - windowPlane);
  const visibleFlame =
    axial > windowPlane
      ? 1 - T.MathUtils.smoothstep(sightline, wickTop, flameTip)
      : 0;
  const falloff = 1 - T.MathUtils.smoothstep(radius, 0.9, reach);
  const bounce = 0.22 * T.MathUtils.smoothstep(radius, 0.24, 0.8);
  return falloff * (bounce + 0.97 * visibleFlame * window);
}

export function pathLanternStone(setting: "walkway" | "grove" = "walkway") {
  const positions: number[] = [],
    colors: number[] = [],
    light: number[] = [],
    uvs: number[] = [],
    faces: number[] = [];
  const tint = new T.Color();
  const halfFace = Math.cos(Math.PI / 8);

  function vertex(
    x: number,
    y: number,
    z: number,
    finish: string,
    bounce = 0,
    burner = 0,
    flame = 0,
  ) {
    positions.push(x, y, z);
    tint.set(finish);
    colors.push(tint.r, tint.g, tint.b);
    light.push(bounce, burner, flame);
    uvs.push(1.25 * (x + 0.56 * z), 1.25 * (y - 0.67 * z));
    return positions.length / 3 - 1;
  }

  // Midpoints give the lotus petals a crest and the eaves a raised corner.
  function ring(
    y: number,
    radius: number,
    finish: string,
    rib = 0,
    cornerLift = 0,
    bounce = 0,
  ) {
    const start = positions.length / 3;
    for (let i = 0; i < 16; i++) {
      const a = ((i - 1) * Math.PI) / 8;
      const r = i % 2 ? radius * halfFace + rib : radius;
      vertex(
        r * Math.sin(a),
        y + (i % 2 ? 0 : cornerLift),
        r * Math.cos(a),
        finish,
        bounce,
      );
    }
    return start;
  }
  function band(low: number, high: number, step = 2) {
    for (let i = 0; i < 16; i += step) {
      const j = (i + step) % 16;
      faces.push(low + i, low + j, high + i, low + j, high + j, high + i);
    }
  }
  const shade = "#899486",
    granite = "#c6c8bb",
    edge = "#ded9c8";
  const foot = ring(-0.038, 0.294, shade);
  const base = ring(0.105, 0.294, granite);
  const bevel = ring(0.15, 0.255, edge);
  const petals = ring(0.22, 0.225, granite, 0.028);
  const neck = ring(0.31, 0.136, shade);
  const shaft = ring(0.335, 0.119, granite);
  const collar = ring(0.765, 0.123, granite);
  const lip = ring(0.8, 0.16, shade);
  const cup = ring(0.855, 0.218, granite, 0.025);
  const sill = ring(0.902, 0.256, edge, 0, 0, 0.08);
  const floor = ring(windowFloor, 0.234, granite, 0, 0, 0.3);
  band(foot, base);
  band(base, bevel);
  band(bevel, petals, 1);
  band(petals, neck, 1);
  band(neck, shaft);
  band(shaft, collar);
  band(collar, lip);
  band(lip, cup, 1);
  band(cup, sill, 1);
  band(sill, floor);

  if (setting === "grove") {
    // A clipped square foundation meets the eight-sided lotus pedestal.
    let previous = -1;
    for (const [y, half, cut, finish] of [
      [-0.035, 0.304, 0.045, "#7b8574"],
      [0.032, 0.329, 0.05, "#969c89"],
      [0.096, 0.326, 0.055, granite],
      [0.126, 0.301, 0.048, edge],
      [0.126, 0.242, 0.09, granite],
    ] as const) {
      const start = positions.length / 3;
      for (const [x, z] of [
        [-half + cut, half],
        [half - cut, half],
        [half, half - cut],
        [half, -half + cut],
        [half - cut, -half],
        [-half + cut, -half],
        [-half, -half + cut],
        [-half, half - cut],
      ] as const)
        vertex(x, y, z, finish);
      if (previous >= 0) {
        for (let i = 0; i < 8; i++) {
          const j = (i + 1) % 8;
          faces.push(
            previous + i,
            previous + j,
            start + i,
            previous + j,
            start + j,
            start + i,
          );
        }
      }
      previous = start;
    }

    // Each carved petal has two folded lobes and a raised midrib.
    const folds = [-1, -0.68, -0.26, 0, 0.26, 0.68, 1];
    for (let side = 0; side < 8; side++) {
      const a = (side * Math.PI) / 4,
        sx = Math.sin(a),
        sz = Math.cos(a);
      for (const whorl of [
        [
          [0.148, 0.235, 0.013],
          [0.17, 0.239, 0.059],
          [0.217, 0.233, 0.074],
          [0.248, 0.205, 0.053],
          [0.297, 0.146, 0.003],
        ],
        [
          [0.796, 0.15, 0.003],
          [0.828, 0.194, 0.045],
          [0.856, 0.227, 0.062],
          [0.879, 0.234, 0.054],
          [0.898, 0.236, 0.012],
        ],
      ] as const) {
        let row = -1;
        for (const [y, radius, width] of whorl) {
          const start = positions.length / 3;
          for (const fold of folds) {
            const at = Math.abs(fold);
            const relief =
              at === 0 ? 0.32 : at === 0.68 ? 0.14 : at === 1 ? -0.19 : 0.07;
            const r = radius + 0.002 + width * relief;
            vertex(
              sx * r + sz * width * fold,
              y,
              sz * r - sx * width * fold,
              at === 0 ? edge : at === 1 ? shade : granite,
            );
          }
          if (row >= 0) {
            for (let i = 0; i + 1 < folds.length; i++)
              faces.push(
                row + i,
                row + i + 1,
                start + i,
                row + i + 1,
                start + i + 1,
                start + i,
              );
          }
          row = start;
        }
      }
    }
  }

  const floorCenter = vertex(0, windowFloor, 0, shade, 0.95);
  for (let i = 0; i < 16; i += 2)
    faces.push(floor + i, floor + ((i + 2) % 16), floorCenter);
  const bottom = ring(windowFloor, 0.226, granite, 0, 0, 0.12),
    top = ring(1.238, 0.222, granite, 0, 0, 0.16);
  const insideLow = ring(windowFloor, 0.163, "#786f5d", 0, 0, 0.83),
    insideHigh = ring(1.238, 0.16, "#8d806b", 0, 0, 0.78);
  for (let i = 2; i < 16; i += 4) {
    const j = (i + 2) % 16;
    faces.push(bottom + i, bottom + j, top + i, bottom + j, top + j, top + i);
    faces.push(
      insideLow + j,
      insideLow + i,
      insideHigh + j,
      insideLow + i,
      insideHigh + i,
      insideHigh + j,
    );
    faces.push(
      insideLow + i,
      bottom + i,
      insideHigh + i,
      bottom + i,
      top + i,
      insideHigh + i,
    );
    faces.push(
      bottom + j,
      insideLow + j,
      top + j,
      insideLow + j,
      insideHigh + j,
      top + j,
    );
  }
  const lintel = ring(1.235, 0.243, shade, 0, 0, 0.28);
  const underside = ring(1.272, 0.272, granite, 0, 0, 0.09);
  const eaves = ring(1.292, 0.374, shade, 0, 0.022);
  const drip = ring(1.32, 0.375, edge, 0, 0.025);
  const slope = ring(1.357, 0.271, granite, 0, 0.012);
  const crown = ring(1.456, 0.094, granite);
  const bead = ring(1.5, 0.076, edge);
  const tip = vertex(0, 1.577, 0, granite);
  const ceiling = vertex(0, 1.235, 0, shade, 1);
  band(lintel, underside);
  band(underside, eaves, 1);
  band(eaves, drip, 1);
  band(drip, slope, 1);
  band(slope, crown, 1);
  band(crown, bead);
  for (let i = 0; i < 16; i += 2) {
    const j = (i + 2) % 16;
    faces.push(bead + i, bead + j, tip, lintel + j, lintel + i, ceiling);
  }
  function vessel(
    profile: readonly (readonly [number, number, string, number?])[],
    flame = false,
  ) {
    const sides = 8;
    let previous = -1;
    for (const [y, radius, color, bounce = 0] of profile) {
      const start = positions.length / 3;
      const lean = flame ? T.MathUtils.smoothstep(y, wickTop, flameTip) : 0;
      const count = radius === 0 ? 1 : sides;
      for (let i = 0; i < count; i++) {
        const a = (i * 2 * Math.PI) / sides;
        vertex(
          radius * Math.sin(a) + 0.018 * lean,
          y,
          radius * Math.cos(a) - 0.009 * lean,
          color,
          bounce,
          1,
          Number(flame),
        );
      }
      if (previous >= 0) {
        for (let i = 0; i < sides; i++) {
          const j = (i + 1) % sides;
          faces.push(
            previous + i,
            previous + j,
            radius === 0 ? start : start + i,
          );
          if (radius > 0) faces.push(previous + j, start + j, start + i);
        }
      }
      previous = start;
    }
  }
  vessel([
    [0.945, 0.042, "#4c483a", 0.09],
    [0.958, 0.047, "#61553e", 0.15],
    [0.992, 0.105, "#796747", 0.26],
    [1.003, 0.106, "#bea774", 0.63],
    [0.996, 0.092, "#5c4b30", 0.14],
    [0.996, 0, "#30291e", 0.09],
  ]);
  vessel([
    [0.996, 0.009, "#62523c"],
    [wickTop, 0.006, "#302a22"],
    [wickTop, 0, "#302a22"],
  ]);
  vessel(
    [
      [1.016, 0.007, "#cc722b"],
      [1.044, 0.035, "#ffcb70"],
      [1.077, 0.042, "#fff2b7"],
      [1.128, 0.024, "#ffc262"],
      [flameTip, 0, "#e38b36"],
    ],
    true,
  );
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("lanternLight", new T.Float32BufferAttribute(light, 3));
  geometry.setIndex(faces);
  geometry.computeVertexNormals();
  return geometry;
}

export function pathLanternMaterial(
  stone: T.MeshStandardMaterial,
  dusk: { value: number },
  clock: { value: number },
) {
  const material = stone.clone();
  material.customProgramCacheKey = () =>
    stone.customProgramCacheKey() + "-oil-lamp";
  material.onBeforeCompile = (shader, renderer) => {
    stone.onBeforeCompile(shader, renderer);
    shader.uniforms.lanternTime = clock;
    shader.uniforms.lanternDusk = dusk;
    shader.vertexShader =
      `attribute vec3 lanternLight;
      uniform float lanternTime, lanternDusk;
      varying vec3 chamberLight;
      ` +
      shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        chamberLight = lanternLight;
        if (lanternLight.z > .5) {
          float height = smoothstep(${wickTop}, ${flameTip}, position.y);
          float phase = 0.;
          #ifdef USE_INSTANCING
            phase = dot(instanceMatrix[3].xz, vec2(.37,.83));
          #endif
          transformed.x += height * (.012*sin(lanternTime*1.6 + phase) + .005*sin(lanternTime*2.7 - phase));
          transformed = mix(vec3(0.,${wickTop},0.), transformed, smoothstep(.12,.82,lanternDusk));
        }`,
      );
    shader.fragmentShader =
      "varying vec3 chamberLight;\nuniform float lanternDusk;\n" +
      shader.fragmentShader
        .replace(
          "#include <color_fragment>",
          `diffuseColor.rgb = mix(diffuseColor.rgb, diffuse, chamberLight.y);
        #include <color_fragment>`,
        )
        .replace(
          "#include <opaque_fragment>",
          `outgoingLight += diffuseColor.rgb * vec3(2.3,1.07,.36) * chamberLight.x * lanternDusk;
        if (chamberLight.z > .5) {
          float core = smoothstep(.08,.91,dot(normal,normalize(vViewPosition)));
          outgoingLight = diffuseColor.rgb * mix(vec3(1.03,.62,.26), vec3(1.4,1.28,1.12),core);
        }
        #include <opaque_fragment>`,
        );
  };
  return material;
}
