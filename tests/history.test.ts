import { describe, expect, it } from "vitest";
import { sumTodayHours } from "../src/history.js";

// Noon Berlin time on 2026-09-17 (CEST, UTC+2), i.e. 2026-09-17T10:00:00Z.
const NOW = Date.parse("2026-09-17T10:00:00.000Z");

describe("sumTodayHours", () => {
  it("is zero with no sessions", () => {
    expect(sumTodayHours([], NOW)).toBe(0);
    expect(sumTodayHours(undefined, NOW)).toBe(0);
  });

  it("sums a session fully inside today", () => {
    const sessions = [{ startTime: "2026-09-17T08:00:00", endTime: "2026-09-17T09:30:00" }];
    expect(sumTodayHours(sessions, NOW)).toBeCloseTo(1.5, 5);
  });

  it("ignores a session on a different Berlin day entirely", () => {
    const sessions = [{ startTime: "2026-09-16T08:00:00", endTime: "2026-09-16T09:30:00" }];
    expect(sumTodayHours(sessions, NOW)).toBe(0);
  });

  it("clips a session spanning midnight to only today's part of it", () => {
    const sessions = [{ startTime: "2026-09-16T23:00:00", endTime: "2026-09-17T01:00:00" }];
    // Only the 1 hour after midnight counts as today.
    expect(sumTodayHours(sessions, NOW)).toBeCloseTo(1, 5);
  });

  it("skips malformed entries instead of throwing", () => {
    const sessions = [
      { startTime: "2026-09-17T08:00:00" }, // no endTime
      { startTime: "not a date", endTime: "2026-09-17T09:00:00" },
      { startTime: "2026-09-17T09:00:00", endTime: "2026-09-17T08:00:00" }, // end before start
    ];
    expect(sumTodayHours(sessions, NOW)).toBe(0);
  });

  it("sums multiple sessions across today", () => {
    const sessions = [
      { startTime: "2026-09-17T06:00:00", endTime: "2026-09-17T07:00:00" },
      { startTime: "2026-09-17T20:00:00", endTime: "2026-09-17T21:15:00" },
    ];
    expect(sumTodayHours(sessions, NOW)).toBeCloseTo(2.25, 5);
  });

  it("uses the Berlin calendar day, not the UTC one, near midnight", () => {
    // 22:30 UTC on the 17th is already 00:30 CEST on the 18th in Berlin.
    const lateInstant = Date.parse("2026-09-17T22:30:00.000Z");
    const sessionOnBerlin18th = [{ startTime: "2026-09-18T00:15:00", endTime: "2026-09-18T00:45:00" }];
    expect(sumTodayHours(sessionOnBerlin18th, lateInstant)).toBeCloseTo(0.5, 5);
    // The same session does not count against the Berlin 17th.
    expect(sumTodayHours(sessionOnBerlin18th, NOW)).toBe(0);
  });
});
