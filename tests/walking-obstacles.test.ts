import { expect, test } from "bun:test";
import { walkingObstacles } from "../src/walking-obstacles";

test("walls and posts block positions and crossings", () => {
  const obstacles = walkingObstacles([[0, 0, 4, 2]], [[10, 10, 1]], 0.5);
  expect(obstacles.occupied(0, 0)).toBe(true);
  expect(obstacles.occupied(2.4, 0)).toBe(true);
  expect(obstacles.occupied(2.6, 0)).toBe(false);
  expect(obstacles.occupied(10.5, 10)).toBe(true);
  expect(obstacles.occupied(-30, 40)).toBe(false);
  expect(obstacles.crossesWall({ x: -5, z: 0 }, { x: 5, z: 0 })).toBe(true);
  expect(obstacles.crossesWall({ x: -5, z: 3 }, { x: 5, z: 3 })).toBe(false);
  expect(obstacles.crossesWall({ x: 0, z: 2 }, { x: 0, z: 1 })).toBe(true);
});
