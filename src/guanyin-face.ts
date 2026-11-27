// @file: guanyin-face.ts
// @desc: carve downcast eyes and features
import * as T from "three";
import { carvedGrid } from "./carved-grid";

const gaussian = (v: number, w: number) => Math.exp(-(v * v) / (w * w));

export interface FaceStyle {
  /** Carve the brow urna and warm the stone face around it. */
  urna?: boolean;
}

export function guanyinFace(
  detailed: boolean,
  finish: "stone" | "painted jade" = "stone",
  { urna = false }: FaceStyle = {},
) {
  // Chin to hairline, in the normalized coordinates of the sibling figure.
  const profiles = [
    [0.688, 0.008, 0.046],
    [0.699, 0.031, 0.067],
    [0.715, 0.049, 0.076],
    [0.747, 0.067, 0.081],
    [0.773, 0.073, 0.087],
    [0.803, 0.075, 0.089],
    [0.835, 0.073, 0.091],
    [0.859, 0.062, 0.094],
    [0.875, 0.036, 0.089],
  ] as const;
  const profile = new T.SplineCurve(
    profiles.map(([y, rx]) => new T.Vector2(rx, y)),
  );
  const depth = new T.SplineCurve(
    profiles.map(([y, , rz]) => new T.Vector2(rz, y)),
  );
  const pos: number[] = [],
    shades: number[] = [];
  const rings = detailed ? 112 : 48,
    columns = detailed ? 72 : 36;
  for (let j = 0; j <= rings; j++) {
    const t = j / rings,
      cross = profile.getPoint(t),
      y = cross.y,
      front = depth.getPoint(t).x;
    for (let i = 0; i <= columns; i++) {
      const a = (i / columns - 0.5) * Math.PI * 1.2,
        x = cross.x * Math.sin(a);
      const facing = Math.max(0, Math.cos(a)),
        side = Math.abs(x),
        eye = side - 0.033;
      const eyeLine = 0.79 + 0.0015 * gaussian(eye, 0.017) + 0.18 * eye;
      const lid = y - eyeLine,
        eyeWidth = Math.exp(-((eye / 0.02) ** 4));
      const arch = 0.808 + 0.006 * gaussian(eye, 0.021) + 0.08 * eye;
      const nostril =
        gaussian(side - 0.009, 0.003) * gaussian(y - 0.754, 0.0019);
      const mouthLine =
        0.7345 +
        0.0016 * gaussian(side - 0.006, 0.004) -
        0.0011 * gaussian(side, 0.003);
      const mouth = y - mouthLine,
        mouthWidth = gaussian(x, 0.015);
      let relief =
        0.0052 * gaussian(side - 0.042, 0.025) * gaussian(y - 0.763, 0.021);
      relief +=
        0.009 * gaussian(x, 0.009) * gaussian(y - 0.782, 0.029) +
        0.01 * gaussian(x, 0.009) * gaussian(y - 0.76, 0.009) +
        0.0048 * gaussian(side - 0.0105, 0.0047) * gaussian(y - 0.755, 0.0044) -
        0.003 * nostril;
      relief +=
        eyeWidth *
          (-0.005 * gaussian(lid - 0.005, 0.011) +
            0.0065 * gaussian(lid - 0.0028, 0.004) -
            0.0025 * gaussian(lid, 0.00155) +
            0.0023 * gaussian(lid + 0.0036, 0.0036)) +
        0.005 * gaussian(eye, 0.024) * gaussian(y - arch, 0.0039);
      relief +=
        mouthWidth *
          (0.0052 * gaussian(mouth - 0.0025, 0.0024) +
            0.0054 * gaussian(mouth + 0.0032, 0.0028) -
            0.0024 * gaussian(mouth, 0.0013)) +
        0.004 * gaussian(x, 0.017) * gaussian(y - 0.712, 0.009) +
        // Delicate carved brow urna (白毫) catching warm sanctuary light between the arched eyebrows
        (urna ? 0.0028 * gaussian(x, 0.0044) * gaussian(y - 0.818, 0.0044) : 0);
      const jade = finish === "painted jade";
      const underHair = jade
        ? 0.021 * T.MathUtils.smoothstep(y, 0.832, 0.875)
        : 0;
      pos.push(
        x + 0.005,
        y,
        0.006 +
          (front - 0.006) * Math.cos(a) +
          facing ** 2 * relief -
          underHair,
      );
      const shade =
        1 -
        facing ** 2 *
          ((urna ? 0.68 : 0.64) * eyeWidth * gaussian(lid, 0.0018) +
            (urna ? 0.16 : 0.13) *
              gaussian(eye, 0.022) *
              gaussian(y - arch, 0.0028) +
            (urna ? 0.52 : 0.48) * mouthWidth * gaussian(mouth, 0.0018) +
            (urna ? 0.36 : 0.34) * nostril +
            (urna ? 0.065 : 0.058) *
              gaussian(side - 0.014, 0.007) *
              gaussian(y - 0.775, 0.021));
      if (jade) {
        const eyelids = 0.46 * eyeWidth * gaussian(lid, 0.0021);
        const brows = 0.24 * gaussian(eye, 0.024) * gaussian(y - arch, 0.0024);
        const lips = mouthWidth * gaussian(mouth, 0.0046);
        const tone = shade * (1 - facing ** 2 * (eyelids + brows));
        shades.push(
          tone * (1 + 0.11 * lips),
          tone * (1 - 0.34 * lips),
          tone * (1 - 0.26 * lips),
        );
      } else if (urna) {
        const urnaGlow = gaussian(x, 0.005) * gaussian(y - 0.818, 0.005);
        const faceTone = Math.min(1, shade + 0.09 * urnaGlow);
        shades.push(
          Math.min(1, faceTone * 1.02),
          faceTone * 0.99,
          faceTone * 0.95,
        );
      } else shades.push(shade, shade, shade);
    }
  }
  return carvedGrid(columns, pos, shades);
}
