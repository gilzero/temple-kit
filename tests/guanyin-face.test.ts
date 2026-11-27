import { expect, test } from "bun:test";
import { guanyinFace } from "../src/guanyin-face";

test("the urna style carves the same grid with a raised brow", () => {
  const plain = guanyinFace(false);
  const urna = guanyinFace(false, "stone", { urna: true });
  const a = plain.getAttribute("position");
  const b = urna.getAttribute("position");
  expect(b.count).toBe(a.count);
  let raised = 0;
  for (let i = 0; i < a.count; i++) if (b.getZ(i) > a.getZ(i)) raised++;
  expect(raised).toBeGreaterThan(0);
  expect(guanyinFace(false).getAttribute("position").array).toEqual(a.array);
});
