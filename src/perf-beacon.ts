// @file: perf-beacon.ts
// @desc: sample anonymous frame timing per visit
import type { TempleLogger } from "./logger";
import {
  limits,
  localePattern,
  perfMaxBytes,
  perfMaxEvents,
  perfSchemaVersion,
  type BrowserFamily,
  type ContextState,
  type CoreBucket,
  type DensityBucket,
  type LoadMilestone,
  type MemoryBucket,
  type PerfBatch,
  type PerfDevice,
  type PerfEvent,
  type RendererKind,
  type ScreenBucket,
} from "./perf-schema";

export interface UserAgentBrand {
  brand: string;
  version: string;
}

/** What the browser reveals; only coarse buckets of it leave the page. */
export interface DeviceSignals {
  coarsePointer: boolean;
  finePointer: boolean;
  memory?: number;
  cores?: number;
  dpr: number;
  screenWidth: number;
  screenHeight: number;
  language: string;
  userAgent: string;
  brands?: readonly UserAgentBrand[];
}

/** Browser hooks, replaceable in tests. */
export interface PerfEnvironment {
  now(): number;
  refused(): boolean;
  signals(): DeviceSignals;
  send(endpoint: string, body: string): boolean;
  /** Call `listener` whenever the page may be about to go away. */
  onLeave(listener: () => void): void;
  /** Report each frame interval in ms until the returned stop runs. */
  frames(listener: (ms: number) => void): () => void;
}

export interface PerfBeaconOptions {
  game: string;
  build: string;
  logger: TempleLogger;
  renderer?: RendererKind;
  /** Share of visits that report, from 0 to 1. */
  sampleRate?: number;
  endpoint?: string;
  windowMs?: number;
  initialTier?: string;
  random?: () => number;
  environment?: PerfEnvironment;
}

export interface PerfBeacon {
  readonly sampled: boolean;
  renderer(kind: RendererKind): void;
  tier(label: string): void;
  firstFrame(): void;
  interactive(): void;
  context(state: ContextState): void;
  /** Count WebGL context losses and restores on a canvas. */
  watchCanvas(canvas: EventTarget): void;
  flush(): void;
}

const defaultSampleRate = 0.25;
const defaultWindowMs = 15_000;
const frameCapacity = 4096;
/** A partial window shorter than this says little about the device. */
const minimumFrames = 30;
const maxBatches = 60;
const sendsPerFlush = 4;

const brandFamilies: readonly [string, BrowserFamily][] = [
  ["Microsoft Edge", "edge"],
  ["Opera", "opera"],
  ["Samsung Internet", "samsung"],
  ["Google Chrome", "chrome"],
  ["Chromium", "chrome"],
];
const agentFamilies: readonly [RegExp, BrowserFamily][] = [
  [/\bEdg(?:e|A|iOS)?\/(\d+)/, "edge"],
  [/\bOPR\/(\d+)/, "opera"],
  [/\bSamsungBrowser\/(\d+)/, "samsung"],
  [/\b(?:Firefox|FxiOS)\/(\d+)/, "firefox"],
  [/\bCriOS\/(\d+)/, "chrome"],
  [/\bChrome\/(\d+)/, "chrome"],
  [/\bVersion\/(\d+)[^]*\bSafari\//, "safari"],
];

function major(text: string | undefined) {
  const value = Number.parseInt(text ?? "", 10);
  return Number.isFinite(value) ? Math.min(limits.major, value) : 0;
}

/** Browser family and major version only; the full string never leaves. */
export function browserVersion(
  userAgent: string,
  brands: readonly UserAgentBrand[] = [],
): { browser: BrowserFamily; major: number } {
  for (const [name, browser] of brandFamilies) {
    const brand = brands.find((entry) => entry.brand === name);
    if (brand) return { browser, major: major(brand.version) };
  }
  for (const [pattern, browser] of agentFamilies) {
    const found = pattern.exec(userAgent);
    if (found) return { browser, major: major(found[1]) };
  }
  return { browser: "other", major: 0 };
}

/** Language and region only, such as `zh-HK`; scripts and extensions drop. */
export function coarseLocale(tag: string) {
  try {
    const locale = new Intl.Locale(tag);
    const coarse = locale.region
      ? `${locale.language}-${locale.region}`
      : locale.language;
    return localePattern.test(coarse) ? coarse : "und";
  } catch (error) {
    if (error instanceof RangeError || error instanceof TypeError) return "und";
    throw error;
  }
}

function memoryBucket(memory: number | undefined): MemoryBucket {
  if (memory === undefined || !(memory > 0)) return "unknown";
  if (memory <= 1) return "1";
  if (memory <= 2) return "2";
  if (memory <= 4) return "4";
  return "8";
}

function coreBucket(cores: number | undefined): CoreBucket {
  if (cores === undefined || !(cores > 0)) return "unknown";
  if (cores <= 2) return "2";
  if (cores <= 4) return "4";
  if (cores <= 8) return "8";
  return "16";
}

function densityBucket(dpr: number): DensityBucket {
  if (!Number.isFinite(dpr) || dpr < 1.25) return "1";
  if (dpr < 1.75) return "1.5";
  if (dpr < 2.5) return "2";
  return "3";
}

function screenBucket(width: number, height: number): ScreenBucket {
  const side = Math.max(width, height);
  if (side < 800) return "xs";
  if (side < 1100) return "s";
  if (side < 1500) return "m";
  if (side < 2000) return "l";
  return "xl";
}

export function deviceClass(signals: DeviceSignals): PerfDevice {
  return {
    ...browserVersion(signals.userAgent, signals.brands),
    pointer: signals.coarsePointer
      ? "coarse"
      : signals.finePointer
        ? "fine"
        : "none",
    memory: memoryBucket(signals.memory),
    cores: coreBucket(signals.cores),
    dpr: densityBucket(signals.dpr),
    screen: screenBucket(signals.screenWidth, signals.screenHeight),
    locale: coarseLocale(signals.language),
  };
}

interface PrivacySignals {
  doNotTrack?: string | null;
  globalPrivacyControl?: boolean;
}

/** Do Not Track or Global Privacy Control turns reporting off. */
export function trackingRefused(...sources: (PrivacySignals | undefined)[]) {
  return sources.some(
    (source) =>
      source?.globalPrivacyControl === true ||
      source?.doNotTrack === "1" ||
      source?.doNotTrack === "yes",
  );
}

/** Tier names become lowercase slugs the intake accepts. */
export function tierLabel(label: string) {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return slug || "unknown";
}

/** Nearest-rank percentile of an ascending list. */
export function percentile(sorted: ArrayLike<number>, share: number) {
  if (!sorted.length) return 0;
  const rank = Math.min(
    sorted.length - 1,
    Math.ceil(share * sorted.length) - 1,
  );
  return sorted[Math.max(0, rank)] ?? 0;
}

const tenth = (value: number) => Math.round(value * 10) / 10;

type BrowserNavigator = Navigator &
  PrivacySignals & {
    deviceMemory?: number;
    userAgentData?: { brands?: readonly UserAgentBrand[] };
  };

export function browserEnvironment(): PerfEnvironment {
  const nav = navigator as BrowserNavigator;
  return {
    now: () => performance.now(),
    refused: () =>
      trackingRefused(nav, globalThis as unknown as PrivacySignals),
    signals: () => ({
      coarsePointer: matchMedia("(pointer: coarse)").matches,
      finePointer: matchMedia("(pointer: fine)").matches,
      memory: nav.deviceMemory,
      cores: nav.hardwareConcurrency || undefined,
      dpr: devicePixelRatio,
      screenWidth: screen.width,
      screenHeight: screen.height,
      language: nav.language,
      userAgent: nav.userAgent,
      brands: nav.userAgentData?.brands,
    }),
    send: (endpoint, body) =>
      nav.sendBeacon(endpoint, new Blob([body], { type: "application/json" })),
    onLeave(listener) {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") listener();
      });
      addEventListener("pagehide", listener);
    },
    frames(listener) {
      let last: number | undefined;
      let handle = 0;
      // Hidden tabs pause animation frames; that gap is not a frame
      const forget = () => (last = undefined);
      document.addEventListener("visibilitychange", forget);
      const tick = (time: number) => {
        if (last !== undefined) listener(time - last);
        last = time;
        handle = requestAnimationFrame(tick);
      };
      handle = requestAnimationFrame(tick);
      return () => {
        cancelAnimationFrame(handle);
        document.removeEventListener("visibilitychange", forget);
      };
    },
  };
}

const quietBeacon: PerfBeacon = {
  sampled: false,
  renderer: () => undefined,
  tier: () => undefined,
  firstFrame: () => undefined,
  interactive: () => undefined,
  context: () => undefined,
  watchCanvas: () => undefined,
  flush: () => undefined,
};

/** Start a visit's sampler. Unsampled or refused visits get a silent beacon. */
export function createPerfBeacon(options: PerfBeaconOptions): PerfBeacon {
  const { logger } = options;
  const sampleRate = options.sampleRate ?? defaultSampleRate;
  if (!(sampleRate >= 0 && sampleRate <= 1))
    throw new RangeError(`sampleRate must be within 0 and 1: ${sampleRate}`);
  let environment: PerfEnvironment;
  try {
    environment = options.environment ?? browserEnvironment();
    if (environment.refused()) return quietBeacon;
  } catch (error) {
    logger.warn("Perf beacon unavailable", { error });
    return quietBeacon;
  }
  if ((options.random ?? Math.random)() >= sampleRate) return quietBeacon;
  const env = environment;
  const endpoint = options.endpoint ?? "/api/perf";
  const windowMs = options.windowMs ?? defaultWindowMs;
  let renderer: RendererKind = options.renderer ?? "webgl";
  let tier = tierLabel(options.initialTier ?? "full");
  let device: PerfDevice | undefined;
  let queue: PerfEvent[] = [];
  let batches = 0;
  let active = true;
  let stopFrames: (() => void) | undefined;
  const reached = new Set<LoadMilestone>();
  const frames = new Float32Array(frameCapacity);
  let frameCount = 0;
  let windowStart = 0;

  const seconds = () => tenth(Math.min(limits.seconds, env.now() / 1000));

  function stop() {
    active = false;
    stopFrames?.();
    queue = [];
  }

  /** Run a hook; a fault turns the beacon off instead of reaching the game. */
  function guard(hook: () => void) {
    if (!active) return;
    try {
      hook();
    } catch (error) {
      logger.warn("Perf beacon stopped", { error });
      stop();
    }
  }

  function batchOf(events: PerfEvent[]): string {
    device ??= deviceClass(env.signals());
    const batch: PerfBatch = {
      v: perfSchemaVersion,
      game: options.game,
      build: options.build,
      renderer,
      ...device,
      events,
    };
    return JSON.stringify(batch);
  }

  function send() {
    for (let sent = 0; queue.length && sent < sendsPerFlush; sent++) {
      if (batches >= maxBatches) {
        stop();
        return;
      }
      let take = Math.min(queue.length, perfMaxEvents);
      let body = batchOf(queue.slice(0, take));
      while (body.length > perfMaxBytes && take > 1)
        body = batchOf(queue.slice(0, --take));
      queue = queue.slice(take);
      batches++;
      if (!env.send(endpoint, body))
        logger.warn("Perf batch not queued", { bytes: body.length });
    }
  }

  function push(event: PerfEvent) {
    queue.push(event);
    if (queue.length >= perfMaxEvents) send();
  }

  function closeWindow(minimum: number) {
    if (frameCount < minimum) return;
    const sorted = frames.subarray(0, frameCount).sort();
    push({
      kind: "frames",
      t: seconds(),
      tier,
      p50: tenth(percentile(sorted, 0.5)),
      p95: tenth(percentile(sorted, 0.95)),
      n: frameCount,
    });
    frameCount = 0;
  }

  function frame(ms: number) {
    guard(() => {
      // Longer gaps are pauses: a dialog, a sleeping laptop, a hidden tab
      if (ms > 0 && ms <= limits.frameMs && frameCount < frameCapacity)
        frames[frameCount++] = ms;
      const now = env.now();
      if (now - windowStart < windowMs) return;
      windowStart = now;
      closeWindow(1);
    });
  }

  function milestone(name: LoadMilestone) {
    guard(() => {
      if (reached.has(name)) return;
      reached.add(name);
      const ms = Math.round(Math.min(limits.loadMs, env.now()));
      push({ kind: "load", t: seconds(), tier, milestone: name, ms });
      if (name === "first-frame" && !stopFrames) {
        windowStart = env.now();
        stopFrames = env.frames(frame);
      }
    });
  }

  function flush() {
    guard(() => {
      closeWindow(minimumFrames);
      send();
    });
  }

  guard(() => {
    push({ kind: "session", t: seconds(), tier });
    env.onLeave(flush);
  });

  const beacon: PerfBeacon = {
    sampled: true,
    renderer: (kind) => guard(() => void (renderer = kind)),
    tier(label) {
      guard(() => {
        const next = tierLabel(label);
        if (next === tier) return;
        // Frames so far belong to the rung that drew them
        closeWindow(1);
        windowStart = env.now();
        push({ kind: "tier", t: seconds(), tier: next, from: tier });
        tier = next;
      });
    },
    firstFrame: () => milestone("first-frame"),
    interactive: () => milestone("interactive"),
    context: (state) =>
      guard(() => push({ kind: "context", t: seconds(), tier, state })),
    watchCanvas(canvas) {
      guard(() => {
        canvas.addEventListener("webglcontextlost", () =>
          beacon.context("lost"),
        );
        canvas.addEventListener("webglcontextrestored", () =>
          beacon.context("restored"),
        );
      });
    },
    flush,
  };
  return beacon;
}
