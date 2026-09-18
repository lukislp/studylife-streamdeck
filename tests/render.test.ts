import { describe, expect, it } from "vitest";
import {
  courseGoalKeyTitle,
  focusModeKeyTitle,
  formatDue,
  statusKeyTitle,
  switchCourseKeyTitle,
  timerKeyTitle,
  wrapTitle,
} from "../src/render.js";
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

  it("wraps a course name too long for one line instead of overflowing the key", () => {
    const goal = {
      courseId: 1,
      courseName: "Object-Oriented Programming",
      targetDate: "2026-10-01T00:00:00",
      daysLeft: 3,
    };
    expect(courseGoalKeyTitle({ connected: true, configured: true, goal })).toBe(
      "Object-Oriented\nProgramming\nin 3 days",
    );
  });

  it("ellipsises a course name that still would not fit in two wrapped lines", () => {
    const goal = {
      courseId: 1,
      courseName: "Projekt Objektorientierte und funktionale Programmierung mit Python",
      targetDate: "2026-10-01T00:00:00",
      daysLeft: 3,
    };
    const title = courseGoalKeyTitle({ connected: true, configured: true, goal });
    expect(title.split("\n")).toHaveLength(3);
    expect(title).toContain("…");
    expect(title.endsWith("in 3 days")).toBe(true);
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

  it("wraps a course name too long for one line instead of overflowing the key", () => {
    expect(switchCourseKeyTitle({ connected: true, courseName: "Object-Oriented Programming" })).toBe(
      "Object-Oriented\nProgramming",
    );
  });
});

describe("focusModeKeyTitle", () => {
  it("shows a not-connected title first", () => {
    expect(focusModeKeyTitle({ connected: false, modeId: 1 })).toBe("Not\nconnected");
  });

  it("shows an unknown-mode fallback for a custom (non-built-in) mode id", () => {
    expect(focusModeKeyTitle({ connected: true, modeId: 100 })).toBe("Unknown\nmode");
  });

  it("wraps every built-in preset's two-word name onto its own two lines, plus focus/break", () => {
    expect(focusModeKeyTitle({ connected: true, modeId: 1 })).toBe("Pomodoro\nClassic\n25m/5m");
    expect(focusModeKeyTitle({ connected: true, modeId: 6 })).toBe("Micro\nFocus\n5m/1m");
    expect(focusModeKeyTitle({ connected: true, modeId: 9 })).toBe("Marathon\nSession\n180m/30m");
  });

  it("keeps a short enough name on one line rather than wrapping needlessly", () => {
    expect(focusModeKeyTitle({ connected: true, modeId: 8 })).toBe("Deep Dive\n120m/20m");
  });
});

describe("wrapTitle", () => {
  it("returns the text unwrapped when it already fits", () => {
    expect(wrapTitle("Biology", 9)).toEqual(["Biology"]);
  });

  it("wraps at word boundaries, never mid-word", () => {
    expect(wrapTitle("Micro Focus", 9)).toEqual(["Micro", "Focus"]);
  });

  it("keeps a single word longer than the limit whole rather than splitting it", () => {
    expect(wrapTitle("Objektorientierte", 9)).toEqual(["Objektorientierte"]);
  });

  it("folds extra lines into the last kept one with an ellipsis when maxLines is exceeded", () => {
    const lines = wrapTitle("Projekt Objektorientierte und funktionale Programmierung", 9, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1]?.endsWith("…")).toBe(true);
  });

  it("does not truncate when the wrapped text already fits within maxLines", () => {
    expect(wrapTitle("Micro Focus", 9, 3)).toEqual(["Micro", "Focus"]);
  });
});
