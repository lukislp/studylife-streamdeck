import { describe, expect, it } from "vitest";
import { MINIMUM_LOGGABLE_MS, buildSessionRequest, decide } from "../src/runLog.js";

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

describe("buildSessionRequest", () => {
  const decision = { log: true as const, courseId: 7, startedAt: NOW - 5 * 60_000, endedAt: NOW };

  it("omits topic when the run has none - not sent as an empty string", () => {
    const run = { courseId: 7, startedAt: decision.startedAt, courseName: "Analysis II" };
    const session = buildSessionRequest(run, decision, undefined);
    expect(session).not.toHaveProperty("topic");
  });

  it("omits topic when the run's topic is only whitespace", () => {
    const run = { courseId: 7, startedAt: decision.startedAt, topic: "   " };
    const session = buildSessionRequest(run, decision, undefined);
    expect(session).not.toHaveProperty("topic");
  });

  it("includes a trimmed topic when the run has a non-blank one", () => {
    const run = { courseId: 7, startedAt: decision.startedAt, topic: "  Chapter 4 review  " };
    const session = buildSessionRequest(run, decision, undefined);
    expect(session.topic).toBe("Chapter 4 review");
  });

  it("omits topic when the run itself is undefined", () => {
    const session = buildSessionRequest(undefined, decision, undefined);
    expect(session).not.toHaveProperty("topic");
  });

  it("includes timerModeId only when given", () => {
    const run = { courseId: 7, startedAt: decision.startedAt };
    expect(buildSessionRequest(run, decision, undefined)).not.toHaveProperty("timerModeId");
    expect(buildSessionRequest(run, decision, 4).timerModeId).toBe(4);
  });

  it("falls back to a generic courseName when the run's own name could not be resolved", () => {
    const run = { courseId: 7, startedAt: decision.startedAt };
    expect(buildSessionRequest(run, decision, undefined).courseName).toBe("StudyLife session");
    expect(buildSessionRequest(undefined, decision, undefined).courseName).toBe("StudyLife session");
  });

  it("carries the course id and Europe/Berlin wall-clock start/end times through unchanged", () => {
    const run = { courseId: 7, startedAt: decision.startedAt };
    const session = buildSessionRequest(run, decision, undefined);
    expect(session.courseId).toBe(7);
    expect(session.startTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    expect(session.endTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
  });
});
