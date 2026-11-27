// @file: chanting.ts
// @desc: stream devotional chanting between silences
export class Chanting {
  private media = new Audio();
  private active = false;
  private revision = 0;
  private restMs = 0;
  private resumeAt = 0;
  private timer?: number;

  constructor(
    ctx: AudioContext,
    bus: GainNode,
    private unavailable: (reason: unknown) => void,
    source = "/media/temple-chant-review-v1.mp3",
  ) {
    this.media.preload = "none";
    this.media.src = source;
    const gain = ctx.createGain();
    gain.gain.value = 0.26;
    ctx.createMediaElementSource(this.media).connect(gain).connect(bus);
    this.media.addEventListener("ended", () => {
      this.restMs = 15_000;
      if (this.active) this.resume();
    });
    this.media.addEventListener("error", () => {
      if (this.active) this.failed(this.media.error);
    });
  }
  setActive(active: boolean) {
    if (active === this.active) return;
    this.active = active;
    this.revision++;
    if (active) {
      this.resume();
    } else {
      this.media.pause();
      if (this.timer !== undefined) {
        this.restMs = Math.max(0, this.resumeAt - performance.now());
        window.clearTimeout(this.timer);
        this.timer = undefined;
      }
    }
  }
  private resume() {
    if (this.restMs > 0) {
      this.resumeAt = performance.now() + this.restMs;
      this.timer = window.setTimeout(() => {
        this.timer = undefined;
        this.restMs = 0;
        this.resume();
      }, this.restMs);
      return;
    }
    if (this.media.error) this.media.load();
    if (this.media.ended) this.media.currentTime = 0;
    const revision = this.revision;
    void this.media.play().catch((reason: unknown) => {
      if (revision === this.revision && this.active) this.failed(reason);
    });
  }
  private failed(reason: unknown) {
    this.setActive(false);
    this.unavailable(reason);
  }
}
