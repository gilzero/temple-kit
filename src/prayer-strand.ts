// @file: prayer-strand.ts
// @desc: paint wooden prayer beads
export const beadsPerRound = 108;
const slots = beadsPerRound + 1;
const grainVariants = 8;
const tile = 64;
const samples = 768;
const fullTurn = 2 * Math.PI;

function beadAtlas() {
  const canvas = document.createElement("canvas");
  canvas.width = tile * (grainVariants + 2);
  canvas.height = tile;
  const ctx = canvas.getContext("2d")!;
  for (let i = 0; i < grainVariants + 2; i++) {
    ctx.save();
    ctx.translate(i * tile + 29, 29);
    const shade = ctx.createRadialGradient(-9, -11, 1, 0, 0, 25);
    const hue = 25 + ((i * 7) % 10);
    const light = i === grainVariants ? -10 : (i * 5) % 9;
    const amber = i === grainVariants + 1;
    shade.addColorStop(0, amber ? "#ffdaa1" : `hsl(${hue} 60% ${72 + light}%)`);
    shade.addColorStop(
      0.33,
      amber ? "#c9883c" : `hsl(${hue} 47% ${51 + light}%)`,
    );
    shade.addColorStop(
      0.74,
      amber ? "#84471a" : `hsl(${hue - 3} 49% ${32 + light}%)`,
    );
    shade.addColorStop(1, "#38231b");
    ctx.fillStyle = "#0d151473";
    ctx.beginPath();
    ctx.ellipse(3.5, 5.5, 25, 24, 0, 0, fullTurn);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 0, 24.5, 24, 0, 0, fullTurn);
    ctx.fillStyle = shade;
    ctx.fill();
    ctx.clip();
    ctx.rotate(((i % 4) - 1.6) * 0.5);
    for (let ring = 0; ring < 11; ring++) {
      ctx.lineWidth = ring % 3 === 0 ? 1.3 : 0.7;
      ctx.strokeStyle = ring % 3 === 0 ? "#47251840" : "#ffe2b52b";
      ctx.beginPath();
      ctx.ellipse(
        -28 + (i % 5),
        7,
        8 + ring * 4.2,
        18 + ring * 4.7,
        -0.28,
        0,
        fullTurn,
      );
      ctx.stroke();
    }
    ctx.restore();
  }
  return canvas;
}

function silkTassel() {
  const canvas = document.createElement("canvas");
  canvas.width = 92;
  canvas.height = 142;
  const ctx = canvas.getContext("2d")!;
  ctx.lineCap = "round";
  const silk = ["#582e27", "#84503e", "#a26848", "#c58e63", "#dca978"];
  for (let thread = 0; thread < 46; thread++) {
    const spread = ((thread * 17) % 46) / 45 - 0.5;
    const length = 107 + 7 * Math.sin(thread * 2.7);
    ctx.strokeStyle = silk[(thread * 7) % silk.length]!;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(44 + spread * 14, 46);
    ctx.bezierCurveTo(
      45 + spread * 22,
      66,
      40 + spread * 29,
      83,
      33 + spread * 36,
      length,
    );
    ctx.stroke();
  }
  for (let side = -1; side <= 1; side += 2) {
    ctx.beginPath();
    ctx.moveTo(44, 9);
    ctx.bezierCurveTo(44 + side * 16, 19, 44 - side * 12, 29, 44, 37);
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#804b38";
    ctx.stroke();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = "#c99562";
    ctx.stroke();
  }
  ctx.fillStyle = "#703d30";
  ctx.beginPath();
  ctx.ellipse(44, 40, 9, 9, 0, 0, fullTurn);
  ctx.fill();
  for (let row = 0; row < 5; row++) {
    ctx.strokeStyle = silk[(row + 2) % silk.length]!;
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.moveTo(37, 40 + row * 2);
    ctx.lineTo(51, 39 + row * 2);
    ctx.stroke();
  }
  return canvas;
}

let wood: HTMLCanvasElement | undefined;
let silk: HTMLCanvasElement | undefined;

export class PrayerStrand {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly x = new Float32Array(samples + 1);
  private readonly y = new Float32Array(samples + 1);
  private cord = new Path2D();
  private spacing = 0;
  private width = 0;
  private height = 0;
  private scale = 0;
  constructor(private readonly surface: HTMLCanvasElement) {
    this.ctx = surface.getContext("2d")!;
    wood ??= beadAtlas();
    silk ??= silkTassel();
  }
  resize() {
    const width = this.surface.clientWidth,
      height = this.surface.clientHeight;
    const scale = Math.min(2, devicePixelRatio);
    if (
      !width ||
      !height ||
      (width === this.width && height === this.height && scale === this.scale)
    )
      return false;
    this.width = width;
    this.height = height;
    this.scale = scale;
    this.surface.width = Math.round(width * scale);
    this.surface.height = Math.round(height * scale);
    this.ctx.setTransform(scale, 0, 0, scale, 0, 0);
    const rawX = new Float32Array(samples + 1),
      rawY = new Float32Array(samples + 1);
    const distance = new Float32Array(samples + 1);
    this.cord = new Path2D();
    for (let i = 0; i <= samples; i++) {
      const t = (fullTurn * i) / samples,
        a = 2 * t + 0.71;
      const r = 0.84 + 0.15 * Math.cos(t);
      const x = width * (0.48 + 0.456 * r * Math.cos(a) + 0.037 * Math.sin(t));
      const y =
        height *
        (0.48 +
          0.419 * r * Math.sin(a) -
          0.056 * Math.cos(a) +
          0.025 * Math.sin(t));
      rawX[i] = x;
      rawY[i] = y;
      if (i === 0) {
        this.cord.moveTo(x, y);
        continue;
      }
      this.cord.lineTo(x, y);
      distance[i] =
        distance[i - 1]! + Math.hypot(x - rawX[i - 1]!, y - rawY[i - 1]!);
    }
    this.cord.closePath();
    const length = distance[samples]!;
    this.spacing = length / slots;
    let next = 1;
    for (let i = 0; i <= samples; i++) {
      const target = (i / samples) * length;
      while (next < samples && distance[next]! < target) next++;
      const prev = next - 1;
      const mix =
        (target - distance[prev]!) / (distance[next]! - distance[prev]!);
      this.x[i] = rawX[prev]! + (rawX[next]! - rawX[prev]!) * mix;
      this.y[i] = rawY[prev]! + (rawY[next]! - rawY[prev]!) * mix;
    }
    return true;
  }
  draw(position: number, sway = 0) {
    if (!this.spacing) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.strokeStyle = "#985b40";
    ctx.lineWidth = Math.max(1, this.spacing * 0.11);
    ctx.stroke(this.cord);
    const phase =
      ((((position % beadsPerRound) + beadsPerRound) % beadsPerRound) * slots) /
      beadsPerRound;
    for (let i = 1; i <= slots; i++) {
      const index = (((i + phase) % slots) / slots) * samples;
      const low = Math.floor(index),
        mix = index - low;
      const x = this.x[low]! + (this.x[low + 1]! - this.x[low]!) * mix;
      const y = this.y[low]! + (this.y[low + 1]! - this.y[low]!) * mix;
      const join = i === slots;
      const variant = join
        ? grainVariants + 1
        : i % 27 === 0
          ? grainVariants
          : (i * 5 + Math.floor(i / 7)) % grainVariants;
      const size = this.spacing * (join ? 1.67 : 1.24);
      if (join) {
        const tasselWidth = Math.min(this.spacing * 5.1, this.width * 0.19);
        ctx.save();
        ctx.translate(x, y);
        // Lay the silk towards the mat edge, trailing lightly with bead motion
        const angle =
          Math.atan2((x / this.width - 0.48) * -1.45, y / this.height - 0.48) +
          sway;
        ctx.rotate(angle);
        const dx = -Math.sin(angle),
          dy = Math.cos(angle);
        const roomX =
          dx >= 0
            ? (this.width - x) / Math.max(dx, 0.01)
            : x / Math.max(-dx, 0.01);
        const roomY =
          dy >= 0
            ? (this.height - y) / Math.max(dy, 0.01)
            : y / Math.max(-dy, 0.01);
        const scale = Math.min(
          tasselWidth / 92,
          (Math.min(roomX, roomY) - 3) / 118,
        );
        ctx.drawImage(silk!, -44 * scale, 0, 92 * scale, 142 * scale);
        ctx.restore();
      }
      ctx.drawImage(
        wood!,
        variant * tile,
        0,
        tile,
        tile,
        x - (size * 29) / tile,
        y - (size * 29) / tile,
        size,
        size,
      );
    }
  }
}
