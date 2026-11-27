// @file: perf-schema.ts
// @desc: validate anonymous frame telemetry batches
/** Bump when a field changes meaning; the intake rejects other versions. */
export const perfSchemaVersion = 1;
export const perfMaxBytes = 2048;
export const perfMaxEvents = 24;

export const rendererKinds = ["webgl", "webgpu"] as const;
export const browserFamilies = [
  "chrome",
  "edge",
  "firefox",
  "safari",
  "samsung",
  "opera",
  "other",
] as const;
export const pointerKinds = ["coarse", "fine", "none"] as const;
/** `navigator.deviceMemory` rounded down to 1, 2, 4 or 8 GiB. */
export const memoryBuckets = ["unknown", "1", "2", "4", "8"] as const;
/** Logical cores: up to 2, 4, 8, or more than 8. */
export const coreBuckets = ["unknown", "2", "4", "8", "16"] as const;
export const densityBuckets = ["1", "1.5", "2", "3"] as const;
/** Longest screen side in CSS pixels: <800, <1100, <1500, <2000, larger. */
export const screenBuckets = ["xs", "s", "m", "l", "xl"] as const;
export const loadMilestones = ["first-frame", "interactive"] as const;
export const contextStates = ["lost", "restored"] as const;

export type RendererKind = (typeof rendererKinds)[number];
export type BrowserFamily = (typeof browserFamilies)[number];
export type PointerKind = (typeof pointerKinds)[number];
export type MemoryBucket = (typeof memoryBuckets)[number];
export type CoreBucket = (typeof coreBuckets)[number];
export type DensityBucket = (typeof densityBuckets)[number];
export type ScreenBucket = (typeof screenBuckets)[number];
export type LoadMilestone = (typeof loadMilestones)[number];
export type ContextState = (typeof contextStates)[number];

/** Coarse device class; nothing here narrows a visitor below thousands. */
export interface PerfDevice {
  browser: BrowserFamily;
  major: number;
  pointer: PointerKind;
  memory: MemoryBucket;
  cores: CoreBucket;
  dpr: DensityBucket;
  screen: ScreenBucket;
  locale: string;
}

/** Every event carries the ladder rung and seconds since navigation. */
interface EventBase {
  t: number;
  tier: string;
}
export interface SessionEvent extends EventBase {
  kind: "session";
}
export interface LoadEvent extends EventBase {
  kind: "load";
  milestone: LoadMilestone;
  ms: number;
}
export interface FramesEvent extends EventBase {
  kind: "frames";
  p50: number;
  p95: number;
  n: number;
}
export interface TierEvent extends EventBase {
  kind: "tier";
  from: string;
}
export interface ContextEvent extends EventBase {
  kind: "context";
  state: ContextState;
}
export type PerfEvent =
  SessionEvent | LoadEvent | FramesEvent | TierEvent | ContextEvent;

export interface PerfBatch extends PerfDevice {
  v: typeof perfSchemaVersion;
  game: string;
  build: string;
  renderer: RendererKind;
  events: PerfEvent[];
}

export const gameIdPattern = /^[a-z0-9-]{1,24}$/;
export const buildPattern = /^[A-Za-z0-9._+-]{1,40}$/;
export const tierPattern = /^[a-z0-9-]{1,24}$/;
export const localePattern = /^(?:[a-z]{2,3}(?:-(?:[A-Z]{2}|\d{3}))?|und)$/;

export const limits = {
  major: 999,
  seconds: 86_400,
  loadMs: 600_000,
  frameMs: 1000,
  frames: 200_000,
} as const;

export class PerfSchemaError extends Error {
  constructor(readonly field: string) {
    super(`Invalid perf field: ${field}`);
    this.name = "PerfSchemaError";
  }
}

type Fields = Readonly<Record<string, unknown>>;

function isFields(value: unknown): value is Fields {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Fields, allowed: readonly string[], field: string) {
  for (const key of Object.keys(value))
    if (!allowed.includes(key)) throw new PerfSchemaError(`${field}.${key}`);
}

function oneOf<T extends string>(
  value: unknown,
  options: readonly T[],
  field: string,
): T {
  const match = options.find((option) => option === value);
  if (match === undefined) throw new PerfSchemaError(field);
  return match;
}

function matching(value: unknown, pattern: RegExp, field: string) {
  if (typeof value !== "string" || !pattern.test(value))
    throw new PerfSchemaError(field);
  return value;
}

function within(
  value: unknown,
  max: number,
  field: string,
  integer = false,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > max ||
    (integer && !Number.isInteger(value))
  )
    throw new PerfSchemaError(field);
  return value;
}

const eventKeys = {
  session: ["kind", "t", "tier"],
  load: ["kind", "t", "tier", "milestone", "ms"],
  frames: ["kind", "t", "tier", "p50", "p95", "n"],
  tier: ["kind", "t", "tier", "from"],
  context: ["kind", "t", "tier", "state"],
} as const;
const eventKinds = Object.keys(eventKeys) as (keyof typeof eventKeys)[];

function parseEvent(value: unknown, field: string): PerfEvent {
  if (!isFields(value)) throw new PerfSchemaError(field);
  const kind = oneOf(value.kind, eventKinds, `${field}.kind`);
  exactKeys(value, eventKeys[kind], field);
  const base = {
    t: within(value.t, limits.seconds, `${field}.t`),
    tier: matching(value.tier, tierPattern, `${field}.tier`),
  };
  switch (kind) {
    case "session":
      return { kind, ...base };
    case "load":
      return {
        kind,
        ...base,
        milestone: oneOf(value.milestone, loadMilestones, `${field}.milestone`),
        ms: within(value.ms, limits.loadMs, `${field}.ms`),
      };
    case "frames": {
      const p50 = within(value.p50, limits.frameMs, `${field}.p50`);
      const p95 = within(value.p95, limits.frameMs, `${field}.p95`);
      if (p95 < p50) throw new PerfSchemaError(`${field}.p95`);
      const n = within(value.n, limits.frames, `${field}.n`, true);
      if (n < 1) throw new PerfSchemaError(`${field}.n`);
      return { kind, ...base, p50, p95, n };
    }
    case "tier":
      return {
        kind,
        ...base,
        from: matching(value.from, tierPattern, `${field}.from`),
      };
    case "context":
      return {
        kind,
        ...base,
        state: oneOf(value.state, contextStates, `${field}.state`),
      };
  }
}

const batchKeys = [
  "v",
  "game",
  "build",
  "renderer",
  "browser",
  "major",
  "pointer",
  "memory",
  "cores",
  "dpr",
  "screen",
  "locale",
  "events",
] as const;

/** Accept exactly the documented batch; throw `PerfSchemaError` otherwise. */
export function parsePerfBatch(value: unknown): PerfBatch {
  if (!isFields(value)) throw new PerfSchemaError("batch");
  exactKeys(value, batchKeys, "batch");
  if (value.v !== perfSchemaVersion) throw new PerfSchemaError("v");
  const events = value.events;
  if (
    !Array.isArray(events) ||
    events.length < 1 ||
    events.length > perfMaxEvents
  )
    throw new PerfSchemaError("events");
  return {
    v: perfSchemaVersion,
    game: matching(value.game, gameIdPattern, "game"),
    build: matching(value.build, buildPattern, "build"),
    renderer: oneOf(value.renderer, rendererKinds, "renderer"),
    browser: oneOf(value.browser, browserFamilies, "browser"),
    major: within(value.major, limits.major, "major", true),
    pointer: oneOf(value.pointer, pointerKinds, "pointer"),
    memory: oneOf(value.memory, memoryBuckets, "memory"),
    cores: oneOf(value.cores, coreBuckets, "cores"),
    dpr: oneOf(value.dpr, densityBuckets, "dpr"),
    screen: oneOf(value.screen, screenBuckets, "screen"),
    locale: matching(value.locale, localePattern, "locale"),
    events: events.map((event, index) => parseEvent(event, `events.${index}`)),
  };
}
