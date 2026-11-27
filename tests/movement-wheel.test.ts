import { expect, test } from "bun:test";
import {
  movementWheelAnchor,
  movementWheelGrip,
  movementWheelInput,
} from "../src/movement-wheel";

test("grip keeps thumb touches inside the cap", () => {
  expect(movementWheelGrip(5, -4, 18)).toEqual({ x: 5, y: -4 });
  expect(movementWheelGrip(30, 0, 18)).toEqual({ x: 0, y: 0 });
});

test("wheel floats to a nearby thumb while staying on screen", () => {
  const home = { left: 20, top: 680, width: 100, height: 100 };
  expect(movementWheelAnchor(130, 690, home, 390, 844)).toEqual({
    x: 60,
    y: -40,
  });
  expect(movementWheelAnchor(10, 830, home, 390, 844)).toEqual({
    x: -20,
    y: 64,
  });
  expect(movementWheelAnchor(280, 400, home, 390, 844)).toBeUndefined();
});

test("input respects the deadzone and scales to the rim", () => {
  expect(movementWheelInput(2, 0, 40)).toMatchObject({ right: 0, forward: 0 });
  const full = movementWheelInput(0, -60, 40);
  expect(full.forward).toBeCloseTo(1);
  expect(full.right).toBeCloseTo(0);
});
