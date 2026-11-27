import { expect, test } from "bun:test";
import {
  handlePerfIntake,
  perfDataPoints,
  type PerfDataPoint,
} from "../src/perf-intake";
import { parsePerfBatch, PerfSchemaError } from "../src/perf-schema";

const batch = {
  v: 1,
  game: "kaiyuan",
  build: "1.4.0",
  renderer: "webgl",
  browser: "chrome",
  major: 131,
  pointer: "fine",
  memory: "8",
  cores: "8",
  dpr: "2",
  screen: "m",
  locale: "en-AU",
  events: [
    { kind: "session", t: 0.1, tier: "full" },
    { kind: "load", t: 2, tier: "full", milestone: "first-frame", ms: 1900 },
    { kind: "frames", t: 17, tier: "full", p50: 16.7, p95: 24.1, n: 880 },
    { kind: "tier", t: 18, tier: "samples", from: "full" },
    { kind: "context", t: 40, tier: "samples", state: "lost" },
  ],
};

function fakeDataset() {
  const points: PerfDataPoint[] = [];
  return {
    points,
    writeDataPoint: (point: PerfDataPoint) => points.push(point),
  };
}

const warnings: string[] = [];
const logger = { warn: (msg: string) => void warnings.push(msg) };

function post(body: string, headers: Record<string, string> = {}) {
  return new Request("https://kaiyuan.weiming.ai/api/perf", {
    method: "POST",
    body,
    headers: { "content-type": "application/json", ...headers },
  });
}

test("a valid batch writes one point per event with the game first", async () => {
  const dataset = fakeDataset();
  const response = await handlePerfIntake(post(JSON.stringify(batch)), {
    game: "kaiyuan",
    dataset,
    logger,
  });
  expect(response.status).toBe(204);
  expect(dataset.points).toHaveLength(5);
  for (const point of dataset.points) {
    expect(point.blobs[0]).toBe("kaiyuan");
    expect(point.indexes).toEqual(["kaiyuan"]);
    expect(point.blobs).toHaveLength(13);
    expect(point.doubles).toHaveLength(6);
  }
  expect(dataset.points[2]).toMatchObject({
    blobs: expect.arrayContaining(["frames", "full"]),
    doubles: [16.7, 24.1, 880, 17, 131, 1],
  });
  expect(dataset.points[4]!.blobs[12]).toBe("lost");
});

test("the schema refuses unknown fields, enums and ranges", () => {
  const bad = (change: Record<string, unknown>, field: string) =>
    expect(() => parsePerfBatch({ ...batch, ...change })).toThrow(
      new PerfSchemaError(field),
    );
  bad({ v: 2 }, "v");
  bad({ userId: "abc" }, "batch.userId");
  bad({ renderer: "canvas" }, "renderer");
  bad({ major: 1.5 }, "major");
  bad({ locale: "en-US-x-private" }, "locale");
  bad({ build: "1.0 beta" }, "build");
  bad({ events: [] }, "events");
  bad({ events: Array(25).fill(batch.events[0]) }, "events");
  bad(
    { events: [{ kind: "frames", t: 1, tier: "x", p50: 30, p95: 20, n: 9 }] },
    "events.0.p95",
  );
  bad(
    { events: [{ kind: "frames", t: 1, tier: "x", p50: 9, p95: 2e3, n: 9 }] },
    "events.0.p95",
  );
  bad({ events: [{ kind: "session", t: -1, tier: "x" }] }, "events.0.t");
  bad(
    { events: [{ kind: "session", t: 1, tier: "x", ip: "1.2.3.4" }] },
    "events.0.ip",
  );
  expect(() => parsePerfBatch([batch])).toThrow(PerfSchemaError);
});

test("the intake rejects oversized, foreign, malformed and misrouted posts", async () => {
  const dataset = fakeDataset();
  const options = { game: "kaiyuan", dataset, logger };
  const status = async (request: Request) =>
    (await handlePerfIntake(request, options)).status;
  expect(await status(post("x".repeat(3000)))).toBe(413);
  expect(await status(post("{}", { "content-length": "999999" }))).toBe(413);
  expect(await status(post("{"))).toBe(400);
  expect(await status(post(JSON.stringify({ ...batch, game: "polin" })))).toBe(
    400,
  );
  expect(
    await status(
      post(JSON.stringify(batch), { origin: "https://elsewhere.example" }),
    ),
  ).toBe(403);
  expect(await status(new Request("https://kaiyuan.weiming.ai/api/perf"))).toBe(
    405,
  );
  expect(dataset.points).toEqual([]);
  expect(warnings).toContain("Perf batch refused");
  expect(
    (
      await handlePerfIntake(post(JSON.stringify(batch)), {
        game: "kaiyuan",
        dataset: undefined,
        logger,
      })
    ).status,
  ).toBe(503);
});

test("data points keep the documented blob order", () => {
  const [point] = perfDataPoints(parsePerfBatch(batch));
  expect(point!.blobs.slice(0, 5)).toEqual([
    "kaiyuan",
    "session",
    "1.4.0",
    "webgl",
    "full",
  ]);
});
