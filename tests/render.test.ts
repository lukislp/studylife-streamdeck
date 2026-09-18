import { describe, expect, it } from "vitest";
import { courseGoalKeyTitle, formatDue, statusKeyTitle, switchCourseKeyTitle, timerKeyTitle } from "../src/render.js";
import type { TimerState } from "../src/timer.js";

const NOW = Date.parse("2026-09-16T12:00:00.000Z");
const MIN = 60_000;

describe("timerKeyTitle", () => {
  it("shows a not-connected title when there is no key stored yet", () => {
    expect(timerKeyTitle({ connected: false, now: NOW })).toBe("Not\nconnected");
  });

  it("invites a tap to start when stopped, with no week figure known yet", () => {
    expect(timerKeyTitle({ connected: true, state: { isRunning: false }, now: NOW })).toBe("Start");
  });

  it("shows this week's hours on the idle label instead of leaving it blank", () => {
    expect(timerKeyTitle({ connected: true, state: { isRunning: false }, now: NOW, weekHours: 12.4 })).toBe(
      "Start\n12.4h wk",
    );
  });

  it("shows Paused for a state this plugin itself paused, with the week figure too", () => {
    const state: TimerState = { isRunning: false, sessionId: 42 };
    expect(timerKeyTitle({ connected: true, state, now: NOW, weekHours: 3 })).toBe("Paused\n3h wk");
  });

  it("counts down focus and break phases with the phase label and total, dropping the week figure", () => {
    const state: TimerState = {
      isRunning: true,
      isBreak: false,
      timerModeId: 1,
      phaseEndsAt: new Date(NOW + 10 * MIN).toISOString(),
    };
    expect(timerKeyTitle({ connected: true, state, now: NOW, weekHours: 12.4 })).toBe("Focus\n10:00\n/25m");

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

  it("shows week, today and streak on their own abbreviated lines", () => {
    expect(
      statusKeyTitle({
        connected: true,
        metrics: { hours: { week: 12.4 }, streak: { current: 3 } },
        todayHours: 1.25,
      }),
    ).toBe("Wk 12.4h\nTdy 1.3h\n3d streak");
  });

  it("falls back to open goal count when the streak is absent", () => {
    expect(statusKeyTitle({ connected: true, metrics: { hours: { week: 2 } }, openGoals: 4 })).toBe(
      "Wk 2h\n4 goals",
    );
  });

  it("omits the today line entirely when it was not computed", () => {
    expect(statusKeyTitle({ connected: true, metrics: { hours: { week: 2 }, streak: { current: 1 } } })).toBe(
      "Wk 2h\n1d streak",
    );
  });

  it("shows a dash for the week figure when the metrics summary carried none", () => {
    expect(statusKeyTitle({ connected: true, metrics: {} })).toBe("Wk --h");
  });
});

describe("formatDue", () => {
  it("renders future, today and overdue goals", () => {
    expect(formatDue(3)).toBe("in 3 days");
    expect(formatDue(1)).toBe("in 1 day");
    expect(formatDue(0)).toBe("today");
    expect(formatDue(-1)).toBe("1 day overdue");
    expect(formatDue(-2)).toBe("2 days overdue");
  });
});

describe("courseGoalKeyTitle", () => {
  it("shows a not-connected title first", () => {
    expect(courseGoalKeyTitle({ connected: false, configured: false })).toBe("Not\nconnected");
  });

  it("prompts for setup when this key has no course bound yet", () => {
    expect(courseGoalKeyTitle({ connected: true, configured: false })).toBe("No course\nset");
  });

  it("says the goal is not open when the bound course fell out of the upcoming list", () => {
    expect(courseGoalKeyTitle({ connected: true, configured: true })).toBe("Goal not\nopen");
  });

  it("shows the course name and countdown when the goal is found", () => {
    const goal = { courseId: 1, courseName: "Biology", targetDate: "2026-10-01T00:00:00", daysLeft: 3 };
    expect(courseGoalKeyTitle({ connected: true, configured: true, goal })).toBe("Biology\nin 3 days");
  });
});

describe("switchCourseKeyTitle", () => {
  it("shows a not-connected title first", () => {
    expect(switchCourseKeyTitle({ connected: false })).toBe("Not\nconnected");
  });

  it("shows the current course name", () => {
    expect(switchCourseKeyTitle({ connected: true, courseName: "Biology" })).toBe("Biology");
  });

  it("shows a fallback when nothing is currently selected", () => {
    expect(switchCourseKeyTitle({ connected: true })).toBe("No course");
  });
});
