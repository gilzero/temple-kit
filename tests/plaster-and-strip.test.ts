import { expect, test } from "bun:test";
import { stripEdges } from "../src/stone-strip";
import { isLimewash, limewashMatcher } from "../src/weathered-plaster";

test("temples can extend the limewash palette", () => {
  expect(isLimewash("#ebe3d3")).toBe(true);
  expect(isLimewash("#ece5d5")).toBe(false);
  const extended = limewashMatcher(["#ece5d5"]);
  expect(extended("#ece5d5")).toBe(true);
  expect(extended("#ebe3d3")).toBe(true);
});

test("a straight strip keeps its width on both sides", () => {
  const edges = stripEdges(
    [
      [0, 0],
      [4, 0],
    ],
    0.5,
  );
  expect(edges).toHaveLength(2);
  for (const pair of edges)
    for (const [, z] of pair) expect(Math.abs(z)).toBeCloseTo(0.5);
});
