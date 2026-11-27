import { expect, test } from "bun:test";
import { parseArgs, reportQueries } from "../scripts/perf-report";

test("report arguments are validated before reaching SQL", () => {
  expect(parseArgs([])).toEqual({ days: 7 });
  expect(parseArgs(["--days", "30", "--game", "jing-an"])).toEqual({
    days: 30,
    game: "jing-an",
  });
  expect(() => parseArgs(["--game", "x' OR 1=1"])).toThrow();
  expect(() => parseArgs(["--days", "0"])).toThrow();
  expect(() => parseArgs(["--token", "secret"])).toThrow();
});

test("every report query reads the shared dataset in the window", () => {
  const queries = reportQueries({ days: 3, game: "polin" });
  for (const sql of Object.values(queries)) {
    expect(sql).toContain("FROM temple_walks_perf");
    expect(sql).toContain("INTERVAL '3' DAY AND blob1 = 'polin'");
    expect(sql).toEndWith("FORMAT JSON");
  }
  expect(Object.keys(queries)).toContain("device-pointer");
});
