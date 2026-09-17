import { describe, expect, it } from "vitest";
import {
  type TimerState,
  durationMinutes,
  formatCountdown,
  modeName,
  nextTapAction,
  phaseOf,
  remainingMs,
  transition,
} from "../src/timer.js";

const NOW = Date.parse("2026-09-16T12:00:00.000Z");
const MIN = 60_000;

function running(overrides: Partial<TimerState> = {}): TimerState {
  return {
    isRunning: true,
    isBreak: false,
    currentRound: 2,
    timerModeId: 1, // Pomodoro Classic, 25/5
    sessionId: 42,
    phaseEndsAt: new Date(NOW + 10 * MIN).toISOString(),
    ...overrides,
  };
}

describe("phase", () => {
  it("distinguishes stopped, paused, focus and break", () => {
    expect(phaseOf(undefined)).toBe("stopped");
    expect(phaseOf({ isRunning: false })).toBe("stopped");
    expect(phaseOf({ isRunning: false, sessionId: 42 })).toBe("paused");
    expect(phaseOf(running())).toBe("focus");
    expect(phaseOf(running({ isBreak: true }))).toBe("break");
  });
});

describe("remaining time", () => {
  it("counts down to phaseEndsAt", () => {
    expect(remainingMs(running(), NOW)).toBe(10 * MIN);
  });

  it("clamps at zero rather than going negative once the phase has passed", () => {
    expect(remainingMs(running(), NOW + 30 * MIN)).toBe(0);
  });

  it("is undefined when nothing runs or the timestamp is unusable", () => {
    expect(remainingMs({ isRunning: false }, NOW)).toBeUndefined();
    expect(remainingMs(running({ phaseEndsAt: null }), NOW)).toBeUndefined();
    expect(remainingMs(running({ phaseEndsAt: "not a date" }), NOW)).toBeUndefined();
  });
});

describe("duration and mode name", () => {
  it("is undefined for a custom mode instead of inventing a total", () => {
    // Custom modes (id >= 100) live in the user's settings, which this plugin cannot read - the
    // countdown has to degrade to showing only the remaining time.
    expect(durationMinutes(running({ timerModeId: 100 }))).toBeUndefined();
    expect(modeName(running({ timerModeId: 100 }))).toBeUndefined();
  });

  it("resolves the built-in presets", () => {
    expect(durationMinutes(running())).toBe(25);
    expect(durationMinutes(running({ isBreak: true }))).toBe(5);
    expect(modeName(running())).toBe("Pomodoro Classic");
  });
});

describe("countdown formatting", () => {
  it("renders minutes:seconds with padding", () => {
    expect(formatCountdown(24 * MIN + 13_000)).toBe("24:13");
    expect(formatCountdown(9_000)).toBe("0:09");
    expect(formatCountdown(0)).toBe("0:00");
    expect(formatCountdown(-5_000)).toBe("0:00");
  });
});

describe("transitions", () => {
  // The wire shape has no "paused" flag - getting this wrong is silent, because the server drops
  // unknown JSON properties without complaint.
  it("pause stops the clock but keeps the session, round and break flag", () => {
    const next = transition(running({ isBreak: true, currentRound: 3 }), "pause", { now: NOW });
    expect(next.isRunning).toBe(false);
    expect(next.phaseEndsAt).toBeNull();
    expect(next.sessionId).toBe(42);
    expect(next.currentRound).toBe(3);
    expect(next.isBreak).toBe(true);
    expect("isPaused" in next).toBe(false);
  });

  it("stop ends the session and resets to round one", () => {
    const next = transition(running({ isBreak: true, currentRound: 3 }), "stop", { now: NOW });
    expect(next.isRunning).toBe(false);
    expect(next.phaseEndsAt).toBeNull();
    expect(next.sessionId).toBeNull();
    expect(next.currentRound).toBe(1);
    expect(next.isBreak).toBe(false);
  });

  it("start resumes the remainder of a paused phase rather than restarting it", () => {
    const paused = transition(running(), "pause", { now: NOW });
    const resumed = transition(paused, "start", { now: NOW });
    // A paused state carries no phaseEndsAt, so with no remembered resumeMs there is no
    // remainder to resume: a full phase.
    expect(Date.parse(resumed.phaseEndsAt as string) - NOW).toBe(25 * MIN);
  });

  it("start from a still-running state keeps the existing remainder", () => {
    const next = transition(running(), "start", { now: NOW });
    expect(Date.parse(next.phaseEndsAt as string) - NOW).toBe(10 * MIN);
  });

  it("start falls back to 25 minutes when the mode is unknown", () => {
    const next = transition({ isRunning: false, timerModeId: 100 }, "start", { now: NOW });
    expect(Date.parse(next.phaseEndsAt as string) - NOW).toBe(25 * MIN);
  });

  it("always sends clientNow so the server can translate the deadline for other devices", () => {
    expect(transition(undefined, "start", { now: NOW }).clientNow).toBe(new Date(NOW).toISOString());
  });
});

describe("resuming after a pause", () => {
  // The wire shape cannot carry the remainder: pausing sets phaseEndsAt to null, and StudyLife's
  // own client keeps it in a private field it never sends. Without resumeMs, pause was
  // indistinguishable from stopping the clock and starting the phase over.
  it("restarts the phase from the remembered remainder, not from the top", () => {
    const paused = transition(running(), "pause", { now: NOW });
    const resumed = transition(paused, "start", { now: NOW, resumeMs: 10 * MIN });
    expect(Date.parse(resumed.phaseEndsAt as string) - NOW).toBe(10 * MIN);
  });

  it("prefers a live phase over a stale remembered remainder", () => {
    // Started elsewhere while this key still held an old pause value.
    const resumed = transition(running(), "start", { now: NOW, resumeMs: 3 * MIN });
    expect(Date.parse(resumed.phaseEndsAt as string) - NOW).toBe(10 * MIN);
  });

  it("falls back to a full phase when the remainder is absent or used up", () => {
    const paused = transition(running(), "pause", { now: NOW });
    expect(Date.parse(transition(paused, "start", { now: NOW }).phaseEndsAt as string) - NOW).toBe(25 * MIN);
    expect(
      Date.parse(transition(paused, "start", { now: NOW, resumeMs: 0 }).phaseEndsAt as string) - NOW,
    ).toBe(25 * MIN);
  });
});

describe("tap cycling", () => {
  it("starts when idle or paused, pauses when running", () => {
    expect(nextTapAction(undefined)).toBe("start");
    expect(nextTapAction({ isRunning: false })).toBe("start");
    expect(nextTapAction({ isRunning: false, sessionId: 42 })).toBe("start");
    expect(nextTapAction(running())).toBe("pause");
  });
});
