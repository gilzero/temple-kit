// @file: practice.ts
// @desc: time greetings and cushion practice
export const bowDuration = 5200;
export const greetingDuration = 3000;
export type Gesture =
  | { kind: "greet"; elapsed: number }
  | { kind: "bow"; elapsed: number; first: boolean; last: boolean };

export class TemplePractice {
  approaching = false;
  gesture?: Gesture;
  constructor(private readonly completed: () => void) {}
  approach() {
    this.approaching = true;
    this.gesture = undefined;
  }
  arrive() {
    if (!this.approaching) return;
    this.approaching = false;
    this.gesture = { kind: "bow", elapsed: 0, first: true, last: false };
  }
  greet() {
    if (!this.gesture) this.gesture = { kind: "greet", elapsed: 0 };
  }
  stop() {
    this.approaching = false;
    if (this.gesture?.kind === "bow") this.gesture.last = true;
  }
  reset() {
    this.approaching = false;
    this.gesture = undefined;
  }
  tick(milliseconds: number) {
    const action = this.gesture;
    if (!action) return false;
    action.elapsed += milliseconds;
    if (action.kind === "greet") {
      if (action.elapsed < greetingDuration) return false;
      this.gesture = undefined;
    } else {
      if (action.elapsed < bowDuration) return false;
      this.completed();
      if (action.last) this.gesture = undefined;
      else {
        action.elapsed -= bowDuration;
        action.first = false;
      }
    }
    return true;
  }
}
