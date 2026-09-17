import { describe, expect, it } from "vitest";
import { statusKeyTitle, timerKeyTitle } from "../src/render.js";
import type { TimerState } from "../src/timer.js";

const NOW = Date.parse("2026-09-16T12:00:00.000Z");
const MIN = 60_000;

describe("timerKeyTitle", () => {
  it("shows a not-connected title when there is no key stored yet", () => {
    expect(timerKeyTitle({ connected: false, now: NOW })).toBe("Not\nconnected");
  });

  it("invites a tap to start when stopped", () => {
    expect(timerKeyTitle({ connected: true, state: { isRunning: false }, now: NOW })).toBe("Start");
  });

  it("shows Paused for a state this plugin itself paused", () => {
    const state: TimerState = { isRunning: false, sessionId: 42 };
    expect(timerKeyTitle({ connected: true, state, now: NOW })).toBe("Paused");
  });

  it("counts down focus and break phases with the phase label and total", () => {
    const state: TimerState = {
      isRunning: true,
      isBreak: false,
      timerModeId: 1,
      phaseEndsAt: new Date(NOW + 10 * MIN).toISOString(),
    };
    expect(timerKeyTitle({ connected: true, state, now: NOW })).toBe("Focus\n10:00\n/25m");

    const breakState: TimerState = { ...state, isBreak: true, phaseEndsAt: new Date(NOW + 2 * MIN).toISOString() };
    expect(timerKeyTitle({ connected: true, state: breakState, now: NOW })).toBe("Break\n2:00\n/5m");
  });

  it("drops the total for a custom mode instead of inventing one", () => {
    const state: TimerState = {
      isRunning: true,
      timerModeId: 100,
      phaseEndsAt: new Date(NOW + 90_000).toISOString(),
    };
    expect(timerKeyTitle({ connected: true, state, now: NOW })).toBe("Focus\n1:30");
  });
});

describe("statusKeyTitle", () => {
  it("shows a not-connected title when there is no key stored yet", () => {
    expect(statusKeyTitle({ connected: false })).toBe("Not\nconnected");
  });

  it("shows the week figure and streak", () => {
    expect(
      statusKeyTitle({ connected: true, metrics: { hours: { week: 12.4 }, streak: { current: 3 } } }),
    ).toBe("12.4h\nweek\n3d streak");
  });

  it("falls back to open goal count when the streak is absent", () => {
    expect(statusKeyTitle({ connected: true, metrics: { hours: { week: 2 } }, openGoals: 4 })).toBe(
      "2h\nweek\n4 goals",
    );
  });

  it("shows a dash when the metrics summary carried no week figure", () => {
    expect(statusKeyTitle({ connected: true, metrics: {} })).toBe("--h");
  });
});
