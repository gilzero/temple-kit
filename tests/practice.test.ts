import { expect, test } from "bun:test";
import { bowDuration, greetingDuration, TemplePractice } from "../src/practice";

test("greet and repeating bow practice advance and finish cleanly", () => {
  let completed = 0;
  const p = new TemplePractice(() => completed++);
  p.greet();
  expect(p.gesture?.kind).toBe("greet");
  expect(p.tick(greetingDuration - 10)).toBe(false);
  expect(p.tick(20)).toBe(true);
  expect(p.gesture).toBeUndefined();
  p.approach();
  p.arrive();
  expect(p.gesture?.kind).toBe("bow");
  expect(p.tick(bowDuration)).toBe(true);
  expect(completed).toBe(1);
  p.stop();
  expect(p.tick(bowDuration)).toBe(true);
  expect(completed).toBe(2);
  expect(p.gesture).toBeUndefined();
});
