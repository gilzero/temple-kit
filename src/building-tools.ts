// @file: building-tools.ts
// @desc: share architectural rendering primitives
import type * as T from "three";

export interface BuildingTools {
  block(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    material: T.Material,
    angle?: number,
  ): void;
  cylinder(
    x: number,
    y: number,
    z: number,
    r1: number,
    r2: number,
    h: number,
    material: T.Material,
    n?: number,
    angle?: number,
  ): void;
  place(
    g: T.BufferGeometry,
    material: T.Material,
    x: number,
    y: number,
    z: number,
    angle?: number,
  ): void;
  finish(color: string, texture?: string): T.MeshStandardMaterial;
  /** Let a finish glow after dark. */
  lamplit(
    material: T.MeshStandardMaterial,
    color: string,
    strength: number,
  ): T.MeshStandardMaterial;
  obstacle(
    x: number,
    z: number,
    width: number,
    depth: number,
    bottom: number,
    top: number,
  ): void;
}
export type HallTools = BuildingTools;
