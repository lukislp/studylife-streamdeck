import { describe, expect, it } from "vitest";
import { MINIMUM_LOGGABLE_MS, decide } from "../src/runLog.js";

const NOW = Date.parse("2026-09-16T12:00:00.000Z");

describe("decide", () => {
  it("logs nothing when this plugin did not start the run", () => {
    expect(decide(undefined, null, NOW)).toEqual({ log: false, reason: "no-run" });
  });

  it("logs nothing when a planned session was already attached at stop", () => {
    const run = { courseId: 1, startedAt: NOW - 60_000 };
    expect(decide(run, 42, NOW)).toEqual({ log: false, reason: "planned" });
  });

  it("logs nothing for a run shorter than the minimum loggable duration", () => {
    const run = { courseId: 1, startedAt: NOW - (MINIMUM_LOGGABLE_MS - 1) };
    expect(decide(run, null, NOW)).toEqual({ log: false, reason: "too-short" });
    expect(decide(run, undefined, NOW)).toEqual({ log: false, reason: "too-short" });
  });

  it("logs a run at exactly the minimum loggable duration", () => {
    const run = { courseId: 1, startedAt: NOW - MINIMUM_LOGGABLE_MS };
    expect(decide(run, null, NOW)).toEqual({
      log: true,
      courseId: 1,
      startedAt: run.startedAt,
      endedAt: NOW,
    });
  });

  it("logs an unplanned run long enough to count", () => {
    const run = { courseId: 7, startedAt: NOW - 5 * 60_000 };
    expect(decide(run, null, NOW)).toEqual({
      log: true,
      courseId: 7,
      startedAt: run.startedAt,
      endedAt: NOW,
    });
    expect(decide(run, undefined, NOW)).toEqual({
      log: true,
      courseId: 7,
      startedAt: run.startedAt,
      endedAt: NOW,
    });
  });
});
