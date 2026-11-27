import { expect, test } from "bun:test";
import { createSealMemory } from "../src/seal-memory";

test("seals merge across tabs and ignore unknown ids", () => {
  const saved = new Map<string, string>([["seals", "1,5,99,abc"]]);
  const memory = createSealMemory({
    read: (key) => saved.get(key) ?? null,
    write: (key, value) => void saved.set(key, value),
    isLandmark: (id) => [1, 4, 5, 8].includes(id),
  });
  expect(memory.savedSeals()).toEqual([1, 5]);
  const local = new Set([1]);
  memory.recordSeal(local, 4);
  expect([...local].sort((a, b) => a - b)).toEqual([1, 4, 5]);
  saved.set("seals", "1,4,5,8");
  memory.syncSeals(local);
  expect([...local].sort((a, b) => a - b)).toEqual([1, 4, 5, 8]);
});
