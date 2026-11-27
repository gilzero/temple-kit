// @file: perf-report.ts
// @desc: summarize temple walk frame telemetry
// Usage: bun scripts/perf-report.ts [--days 7] [--game kaiyuan]
import { gameIdPattern } from "../src/perf-schema";

const dataset = "temple_walks_perf";
const deviceDimensions = {
  browser: "blob6",
  pointer: "blob7",
  memory: "blob8",
  cores: "blob9",
  dpr: "blob10",
  screen: "blob11",
} as const;

export class PerfReportError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "PerfReportError";
  }
}

type Row = Readonly<Record<string, unknown>>;

export interface ReportOptions {
  days: number;
  game?: string;
}

export function parseArgs(args: readonly string[]): ReportOptions {
  const options: ReportOptions = { days: 7 };
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    const value = args[i + 1];
    if (flag === "--days" && value !== undefined) {
      options.days = Number(value);
      i++;
    } else if (flag === "--game" && value !== undefined) {
      options.game = value;
      i++;
    } else throw new PerfReportError(`Unknown argument: ${flag}`);
  }
  if (!Number.isInteger(options.days) || options.days < 1 || options.days > 90)
    throw new PerfReportError("--days must be a whole number from 1 to 90");
  if (options.game !== undefined && !gameIdPattern.test(options.game))
    throw new PerfReportError("--game must be a game id such as kaiyuan");
  return options;
}

/** Filters interpolated into SQL; both values were validated by `parseArgs`. */
function where(kind: string, { days, game }: ReportOptions) {
  const scope = game ? ` AND blob1 = '${game}'` : "";
  return `WHERE blob2 = '${kind}' AND timestamp > NOW() - INTERVAL '${days}' DAY${scope}`;
}

export function reportQueries(options: ReportOptions) {
  const frames = where("frames", options);
  return {
    frames: `SELECT blob1 AS game, quantileWeighted(0.5, double1, _sample_interval) AS p50, quantileWeighted(0.5, double2, _sample_interval) AS p95, quantileWeighted(0.95, double2, _sample_interval) AS p95_worst, SUM(_sample_interval * double3) AS frames FROM ${dataset} ${frames} GROUP BY game ORDER BY game FORMAT JSON`,
    tiers: `SELECT blob1 AS game, blob5 AS tier, SUM(_sample_interval * double3) AS frames FROM ${dataset} ${frames} GROUP BY game, tier ORDER BY game, frames DESC FORMAT JSON`,
    loads: `SELECT blob1 AS game, blob13 AS milestone, quantileWeighted(0.5, double1, _sample_interval) AS p50, quantileWeighted(0.9, double1, _sample_interval) AS p90 FROM ${dataset} ${where("load", options)} GROUP BY game, milestone ORDER BY game, milestone FORMAT JSON`,
    sessions: `SELECT blob1 AS game, SUM(_sample_interval) AS sessions FROM ${dataset} ${where("session", options)} GROUP BY game ORDER BY game FORMAT JSON`,
    contexts: `SELECT blob1 AS game, blob13 AS state, SUM(_sample_interval) AS events FROM ${dataset} ${where("context", options)} GROUP BY game, state ORDER BY game FORMAT JSON`,
    ...Object.fromEntries(
      Object.entries(deviceDimensions).map(([name, blob]) => [
        `device-${name}`,
        `SELECT blob1 AS game, ${blob} AS bucket, SUM(_sample_interval) AS sessions FROM ${dataset} ${where("session", options)} GROUP BY game, bucket ORDER BY game, sessions DESC FORMAT JSON`,
      ]),
    ),
  };
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value)
    throw new PerfReportError(`Set ${name} to query Analytics Engine`);
  return value;
}

async function query(sql: string): Promise<Row[]> {
  const account = requiredEnv("CLOUDFLARE_ACCOUNT_ID");
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${account}/analytics_engine/sql`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${requiredEnv("CLOUDFLARE_API_TOKEN")}`,
      },
      body: sql,
      signal: AbortSignal.timeout(30_000),
    },
  );
  // The response never echoes the token, so its text is safe to surface.
  if (!response.ok)
    throw new PerfReportError(
      `Analytics Engine answered ${response.status}: ${(await response.text()).slice(0, 300)}`,
      response.status,
    );
  const body: unknown = await response.json();
  if (
    typeof body !== "object" ||
    body === null ||
    !("data" in body) ||
    !Array.isArray(body.data)
  )
    throw new PerfReportError("Analytics Engine returned no data array");
  return body.data as Row[];
}

const text = (value: unknown) => String(value ?? "");
const amount = (value: unknown) => Number(value ?? 0);
const ms = (value: unknown) => `${amount(value).toFixed(1)} ms`;

function byGame(rows: Row[]) {
  const games = new Map<string, Row[]>();
  for (const row of rows) {
    const game = text(row.game);
    games.set(game, [...(games.get(game) ?? []), row]);
  }
  return games;
}

function shares(rows: Row[], label: string, weight: string) {
  const total = rows.reduce((sum, row) => sum + amount(row[weight]), 0) || 1;
  return rows
    .map(
      (row) =>
        `${text(row[label]) || "-"} ${((amount(row[weight]) / total) * 100).toFixed(0)}%`,
    )
    .join(", ");
}

export async function perfReport(options: ReportOptions) {
  const queries = reportQueries(options);
  const results = Object.fromEntries(
    await Promise.all(
      Object.entries(queries).map(
        async ([name, sql]) => [name, byGame(await query(sql))] as const,
      ),
    ),
  );
  const games = new Set(
    Object.values(results).flatMap((result) => [...result.keys()]),
  );
  const lines = [`Temple walks perf, last ${options.days} days`];
  for (const game of [...games].sort()) {
    const of = (name: string) => results[name]?.get(game) ?? [];
    const frames = of("frames")[0];
    const sessions = amount(of("sessions")[0]?.sessions);
    const lost = amount(
      of("contexts").find((row) => row.state === "lost")?.events,
    );
    lines.push("", `## ${game}  (${sessions.toFixed(0)} sampled sessions)`);
    if (frames)
      lines.push(
        `frame time   p50 ${ms(frames.p50)}  p95 ${ms(frames.p95)}  worst-window p95 ${ms(frames.p95_worst)}  over ${amount(frames.frames).toFixed(0)} frames`,
      );
    for (const row of of("loads"))
      lines.push(
        `${text(row.milestone).padEnd(12)} p50 ${ms(row.p50)}  p90 ${ms(row.p90)}`,
      );
    lines.push(`tiers        ${shares(of("tiers"), "tier", "frames")}`);
    lines.push(
      `context loss ${sessions ? ((lost / sessions) * 100).toFixed(2) : "0.00"}% of sessions (${lost.toFixed(0)} losses)`,
    );
    for (const name of Object.keys(deviceDimensions))
      lines.push(
        `${name.padEnd(12)} ${shares(of(`device-${name}`), "bucket", "sessions")}`,
      );
  }
  return lines.join("\n");
}

if (import.meta.main) {
  try {
    console.log(await perfReport(parseArgs(process.argv.slice(2))));
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        msg: "Perf report failed",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    process.exit(1);
  }
}
