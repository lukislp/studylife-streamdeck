import { describe, expect, it } from "vitest";
import {
  type TimerState,
  canChangeMode,
  durationMinutes,
  formatCountdown,
  modeName,
  nextMode,
  nextTapAction,
  phaseOf,
  remainingMs,
  stepMode,
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
  it("distinguishes stopped, focus and break - purely from the wire, never guessing paused", () => {
    expect(phaseOf(undefined)).toBe("stopped");
    expect(phaseOf({ isRunning: false })).toBe("stopped");
    // A lingering sessionId on an otherwise-stopped state must NOT read as "paused" - the wire
    // has no paused flag, and sessionId lingers for reasons unrelated to this plugin's own
    // pause/resume (another client's session, one already planned). Whether a resume is pending
    // is tracked locally instead - see render.ts's TimerRenderInput.pausedLocally.
    expect(phaseOf({ isRunning: false, sessionId: 42 })).toBe("stopped");
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

  it("honours an explicit modeId over whatever the current state already carries", () => {
    const next = transition(running({ timerModeId: 1 }), "stop", { now: NOW, modeId: 8 });
    expect(next.timerModeId).toBe(8);
  });

  it("falls back to the current state's mode, then 1, when no modeId is given", () => {
    expect(transition(running({ timerModeId: 3 }), "pause", { now: NOW }).timerModeId).toBe(3);
    expect(transition(undefined, "start", { now: NOW }).timerModeId).toBe(1);
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

describe("canChangeMode", () => {
  it("allows a change while stopped or paused, refuses it while running", () => {
    expect(canChangeMode(undefined)).toBe(true);
    expect(canChangeMode({ isRunning: false })).toBe(true);
    expect(canChangeMode({ isRunning: false, sessionId: 42 })).toBe(true);
    expect(canChangeMode(running())).toBe(false);
  });
});

describe("mode cycling", () => {
  it("steps through the nine built-ins in order, one press at a time", () => {
    let id: number | undefined;
    const seen: number[] = [];
    for (let i = 0; i < 9; i++) {
      id = nextMode(id);
      seen.push(id);
    }
    expect(seen).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("wraps from the last built-in back to the first", () => {
    expect(nextMode(9)).toBe(1);
  });

  it("starts at the first built-in when nothing is set yet", () => {
    expect(nextMode(undefined)).toBe(1);
  });

  it("treats a custom mode (id >= 100) as unset, restarting the cycle rather than erroring", () => {
    // Custom modes live in the user's settings, which this plugin cannot read - see
    // BUILT_IN_MODES' doc comment.
    expect(nextMode(100)).toBe(1);
  });

  it("steps backward for a negative count, wrapping past the first built-in to the last", () => {
    expect(stepMode(1, -1)).toBe(9);
    expect(stepMode(5, -1)).toBe(4);
  });

  it("steps by more than one detent at once, as a dial rotation reports multiple ticks", () => {
    expect(stepMode(1, 3)).toBe(4);
    expect(stepMode(1, 9)).toBe(1);
    expect(stepMode(1, -3)).toBe(7);
  });
});
