import { expect, test } from "bun:test";
import {
  browserVersion,
  coarseLocale,
  createPerfBeacon,
  deviceClass,
  percentile,
  tierLabel,
  trackingRefused,
  type DeviceSignals,
  type PerfEnvironment,
} from "../src/perf-beacon";
import { parsePerfBatch, perfMaxBytes } from "../src/perf-schema";

const phone: DeviceSignals = {
  coarsePointer: true,
  finePointer: false,
  memory: 4,
  cores: 8,
  dpr: 3,
  screenWidth: 393,
  screenHeight: 852,
  language: "zh-Hant-HK",
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
};

function fakeEnvironment(refused = false) {
  const sent: string[] = [];
  const leave: (() => void)[] = [];
  const state = {
    now: 0,
    frame: undefined as ((ms: number) => void) | undefined,
  };
  const environment: PerfEnvironment = {
    now: () => state.now,
    refused: () => refused,
    signals: () => phone,
    send: (_endpoint, body) => (sent.push(body), true),
    onLeave: (listener) => void leave.push(listener),
    frames(listener) {
      state.frame = listener;
      return () => (state.frame = undefined);
    },
  };
  const run = (ms: number, count: number) => {
    for (let i = 0; i < count; i++) {
      state.now += ms;
      state.frame?.(ms);
    }
  };
  const hide = () => leave.forEach((listener) => listener());
  return { environment, sent, state, run, hide };
}

const silent = { warn: () => undefined };

test("browser family and major version replace the agent string", () => {
  expect(browserVersion(phone.userAgent)).toEqual({
    browser: "safari",
    major: 18,
  });
  expect(
    browserVersion("x", [
      { brand: "Not A Brand", version: "99" },
      { brand: "Microsoft Edge", version: "131" },
      { brand: "Chromium", version: "131" },
    ]),
  ).toEqual({ browser: "edge", major: 131 });
  expect(
    browserVersion("Mozilla/5.0 (Android 14) Gecko/20100101 Firefox/133.0"),
  ).toEqual({ browser: "firefox", major: 133 });
  expect(browserVersion("curl/8")).toEqual({ browser: "other", major: 0 });
});

test("device signals fall into coarse buckets", () => {
  expect(deviceClass(phone)).toEqual({
    browser: "safari",
    major: 18,
    pointer: "coarse",
    memory: "4",
    cores: "8",
    dpr: "3",
    screen: "s",
    locale: "zh-HK",
  });
  expect(coarseLocale("not a locale!")).toBe("und");
  expect(coarseLocale("en")).toBe("en");
  expect(
    deviceClass({
      ...phone,
      coarsePointer: false,
      memory: undefined,
      cores: 32,
      dpr: Number.NaN,
      screenWidth: 2560,
    }),
  ).toMatchObject({ memory: "unknown", cores: "16", dpr: "1", screen: "xl" });
});

test("tiers become slugs and percentiles use nearest rank", () => {
  expect(tierLabel("Device Tier: Light")).toBe("device-tier-light");
  expect(tierLabel("!!")).toBe("unknown");
  const sorted = Array.from({ length: 100 }, (_, i) => i + 1);
  expect(percentile(sorted, 0.5)).toBe(50);
  expect(percentile(sorted, 0.95)).toBe(95);
  expect(percentile([], 0.5)).toBe(0);
});

test("Do Not Track and Global Privacy Control refuse reporting", () => {
  expect(trackingRefused({ doNotTrack: "1" })).toBe(true);
  expect(trackingRefused({ globalPrivacyControl: true })).toBe(true);
  expect(trackingRefused({ doNotTrack: "0" }, undefined)).toBe(false);
  const { environment, sent, hide } = fakeEnvironment(true);
  const beacon = createPerfBeacon({
    game: "kaiyuan",
    build: "1.0.0",
    logger: silent,
    random: () => 0,
    environment,
  });
  beacon.firstFrame();
  hide();
  expect(beacon.sampled).toBe(false);
  expect(sent).toEqual([]);
});

test("unsampled visits send nothing", () => {
  const { environment, sent, hide } = fakeEnvironment();
  const beacon = createPerfBeacon({
    game: "kaiyuan",
    build: "1.0.0",
    logger: silent,
    random: () => 0.25,
    environment,
  });
  hide();
  expect(beacon.sampled).toBe(false);
  expect(sent).toEqual([]);
  expect(() =>
    createPerfBeacon({ game: "k", build: "1", logger: silent, sampleRate: 2 }),
  ).toThrow(RangeError);
});

test("a sampled visit reports milestones, windows, tiers and losses", () => {
  const { environment, sent, state, run, hide } = fakeEnvironment();
  const beacon = createPerfBeacon({
    game: "jing-an",
    build: "2.4.1",
    logger: silent,
    random: () => 0.1,
    initialTier: "full",
    environment,
  });
  state.now = 1200;
  beacon.firstFrame();
  beacon.firstFrame();
  run(16, 900);
  beacon.tier("light");
  run(33, 100);
  state.now += 500;
  beacon.interactive();
  const canvas = new EventTarget();
  beacon.watchCanvas(canvas);
  canvas.dispatchEvent(new Event("webglcontextlost"));
  canvas.dispatchEvent(new Event("webglcontextrestored"));
  hide();
  expect(sent).toHaveLength(1);
  const body = sent[0]!;
  expect(body.length).toBeLessThanOrEqual(perfMaxBytes);
  const batch = parsePerfBatch(JSON.parse(body));
  expect(batch).toMatchObject({ game: "jing-an", build: "2.4.1" });
  expect(body).not.toContain("Mozilla");
  const kinds = batch.events.map((event) => event.kind);
  expect(kinds).toEqual([
    "session",
    "load",
    "frames",
    "tier",
    "load",
    "context",
    "context",
    "frames",
  ]);
  expect(batch.events[1]).toMatchObject({ milestone: "first-frame", ms: 1200 });
  expect(batch.events[2]).toMatchObject({ p50: 16, p95: 16, tier: "full" });
  expect(batch.events[3]).toMatchObject({ tier: "light", from: "full" });
  expect(batch.events[7]).toMatchObject({ p50: 33, n: 100, tier: "light" });
});

test("long visits split into batches under the size cap", () => {
  const { environment, sent, run, hide } = fakeEnvironment();
  const beacon = createPerfBeacon({
    game: "polin",
    build: "0.0.26",
    logger: silent,
    random: () => 0,
    windowMs: 1000,
    environment,
  });
  beacon.firstFrame();
  run(20, 3000);
  hide();
  expect(sent.length).toBeGreaterThan(1);
  for (const body of sent) {
    expect(body.length).toBeLessThanOrEqual(perfMaxBytes);
    expect(() => parsePerfBatch(JSON.parse(body))).not.toThrow();
  }
});

test("a failing environment stops the beacon without throwing", () => {
  const warnings: string[] = [];
  const { environment } = fakeEnvironment();
  const beacon = createPerfBeacon({
    game: "temple",
    build: "1.0.15",
    logger: { warn: (msg) => void warnings.push(msg) },
    random: () => 0,
    environment: {
      ...environment,
      signals: () => {
        throw new Error("blocked");
      },
    },
  });
  expect(() => beacon.flush()).not.toThrow();
  expect(() => beacon.tier("low")).not.toThrow();
  expect(warnings).toEqual(["Perf beacon stopped"]);
});
