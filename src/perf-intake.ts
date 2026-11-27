// @file: perf-intake.ts
// @desc: store frame telemetry in Analytics Engine
import type { TempleLogger } from "./logger";
import {
  parsePerfBatch,
  perfMaxBytes,
  PerfSchemaError,
  type PerfBatch,
  type PerfEvent,
} from "./perf-schema";

/** The slice of a Workers Analytics Engine binding the intake uses. */
export interface PerfDataPoint {
  blobs: string[];
  doubles: number[];
  indexes: string[];
}
export interface PerfDataset {
  writeDataPoint(point: PerfDataPoint): void;
}

export interface PerfIntakeOptions {
  /** The Worker's own game; batches naming another game are refused. */
  game: string;
  dataset: PerfDataset | undefined;
  logger: TempleLogger;
}

export const perfPath = "/api/perf";

class BodyTooLarge extends Error {
  constructor() {
    super("Perf body exceeds the size cap");
    this.name = "BodyTooLarge";
  }
}

function reply(status: number, text?: string, headers?: HeadersInit) {
  return new Response(text ?? null, {
    status,
    headers: {
      "cache-control": "no-store",
      ...(text ? { "content-type": "text/plain; charset=utf-8" } : {}),
      ...headers,
    },
  });
}

/** Read at most `cap` bytes, whatever Content-Length claims. */
async function cappedText(request: Request, cap: number) {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > cap) {
      await reader.cancel();
      throw new BodyTooLarge();
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(
    bytes,
  );
}

function eventValues(event: PerfEvent): [string, number, number, number] {
  switch (event.kind) {
    case "frames":
      return ["", event.p50, event.p95, event.n];
    case "load":
      return [event.milestone, event.ms, 0, 1];
    case "tier":
      return [event.from, 0, 0, 1];
    case "context":
      return [event.state, 0, 0, 1];
    case "session":
      return ["", 0, 0, 1];
  }
}

/**
 * One point per event. blob1 game, blob2 kind, blob3 build, blob4 renderer,
 * blob5 tier, blob6-12 device class and locale, blob13 detail; double1 value,
 * double2 p95, double3 count, double4 seconds, double5 browser major, double6 schema.
 */
export function perfDataPoints(batch: PerfBatch): PerfDataPoint[] {
  return batch.events.map((event) => {
    const [detail, value, p95, count] = eventValues(event);
    return {
      blobs: [
        batch.game,
        event.kind,
        batch.build,
        batch.renderer,
        event.tier,
        batch.browser,
        batch.pointer,
        batch.memory,
        batch.cores,
        batch.dpr,
        batch.screen,
        batch.locale,
        detail,
      ],
      doubles: [value, p95, count, event.t, batch.major, batch.v],
      indexes: [batch.game],
    };
  });
}

function crossOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host !== new URL(request.url).host;
  } catch (error) {
    if (error instanceof TypeError) return true;
    throw error;
  }
}

/** Answer `POST /api/perf`: validate strictly, then write each event. */
export async function handlePerfIntake(
  request: Request,
  { game, dataset, logger }: PerfIntakeOptions,
): Promise<Response> {
  if (request.method !== "POST")
    return reply(405, "Method not allowed", { allow: "POST" });
  if (crossOrigin(request)) return reply(403, "Forbidden");
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > perfMaxBytes) return reply(413, "Too large");
  let batch: PerfBatch;
  try {
    batch = parsePerfBatch(JSON.parse(await cappedText(request, perfMaxBytes)));
  } catch (error) {
    if (error instanceof BodyTooLarge) return reply(413, "Too large");
    if (
      error instanceof PerfSchemaError ||
      error instanceof SyntaxError ||
      error instanceof TypeError
    ) {
      logger.warn("Perf batch refused", {
        game,
        reason: error instanceof PerfSchemaError ? error.field : error.name,
      });
      return reply(400, "Invalid batch");
    }
    throw error;
  }
  if (batch.game !== game) {
    logger.warn("Perf batch for another game", { game, named: batch.game });
    return reply(400, "Invalid batch");
  }
  if (!dataset) {
    logger.warn("Perf dataset is not bound", { game });
    return reply(503, "Unavailable");
  }
  for (const point of perfDataPoints(batch)) dataset.writeDataPoint(point);
  return reply(204);
}
