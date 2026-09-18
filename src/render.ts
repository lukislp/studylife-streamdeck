// Pure title-text rules for every key action. Split out from the actions themselves so the text
// is unit-testable without a Stream Deck connection, mirroring studylife-vscode's statusBar.ts
// render functions.
import type { MetricsSummary, UpcomingGoal } from "./api.js";
import {
  BUILT_IN_MODES,
  type Phase,
  type TimerState,
  durationMinutes,
  formatCountdown,
  phaseOf,
  remainingMs,
} from "./timer.js";

export interface TimerRenderInput {
  connected: boolean;
  state?: TimerState | undefined;
  now: number;
  /** This week's hours from Metrics.GetSummary - shown on the idle/paused label instead of
   *  leaving it blank ("show as much useful info as possible" is an explicit v2 goal). Omitted
   *  while a phase is actively counting down: the countdown already uses the key's lines. */
  weekHours?: number | undefined;
}

/** Multi-line title for the Focus Timer key - Stream Deck key titles wrap on "\n". */
export function timerKeyTitle(input: TimerRenderInput): string {
  if (!input.connected) return "Not\nconnected";
  const phase = phaseOf(input.state);
  const label = phaseLabel(phase);
  const remaining = remainingMs(input.state, input.now);
  if (remaining === undefined) {
    return input.weekHours === undefined ? label : `${label}\n${formatHours(input.weekHours)} wk`;
  }
  const total = durationMinutes(input.state);
  const suffix = total === undefined ? "" : `\n/${total}m`;
  return `${label}\n${formatCountdown(remaining)}${suffix}`;
}

function phaseLabel(phase: Phase): string {
  switch (phase) {
    case "focus":
      return "Focus";
    case "break":
      return "Break";
    case "paused":
      return "Paused";
    case "stopped":
      return "Start";
  }
}

export interface StatusRenderInput {
  connected: boolean;
  metrics?: MetricsSummary | undefined;
  /** Summed client-side from Sessions.GetHistory - the metrics API carries no daily figure, see
   *  history.ts. */
  todayHours?: number | undefined;
  openGoals?: number | undefined;
}

/** Multi-line title for the Study Status key: week and (when known) today's hours plus streak or
 *  open-goal count. Labels are abbreviated rather than dropping a stat - key titles wrap onto
 *  several short lines, so there is room for all of it. */
export function statusKeyTitle(input: StatusRenderInput): string {
  if (!input.connected) return "Not\nconnected";
  const lines: string[] = [];
  const week = input.metrics?.hours?.week;
  lines.push(week === undefined ? "Wk --h" : `Wk ${formatHours(week)}`);
  if (input.todayHours !== undefined) lines.push(`Tdy ${formatHours(input.todayHours)}`);
  const streak = input.metrics?.streak?.current;
  if (streak !== undefined) lines.push(`${String(streak)}d streak`);
  else if (input.openGoals !== undefined) lines.push(`${String(input.openGoals)} goals`);
  return lines.join("\n");
}

/** "2.5h" - short enough for a key face, unlike a full "2 h 30 min". */
export function formatHours(hours: number): string {
  return `${(Math.round(hours * 10) / 10).toString()}h`;
}

export interface CourseGoalRenderInput {
  connected: boolean;
  /** Whether this key instance has a courseId bound in its Property Inspector settings, as
   *  opposed to the goal simply not being found (e.g. it was completed since being picked). */
  configured: boolean;
  goal?: UpcomingGoal | undefined;
}

/** Multi-line title for the Course Goal key: the tracked course's name and countdown. */
export function courseGoalKeyTitle(input: CourseGoalRenderInput): string {
  if (!input.connected) return "Not\nconnected";
  if (!input.configured) return "No course\nset";
  if (!input.goal) return "Goal not\nopen";
  return `${input.goal.courseName}\n${formatDue(input.goal.daysLeft)}`;
}

/** "in 3 days", "today", "2 days overdue" - ported from studylife-raycast's courseGoals.ts, which
 *  uses the same shape studylife-vscode's panel does. */
export function formatDue(daysLeft: number): string {
  if (daysLeft < 0) return `${String(Math.abs(daysLeft))} day${Math.abs(daysLeft) === 1 ? "" : "s"} overdue`;
  if (daysLeft === 0) return "today";
  return `in ${String(daysLeft)} day${daysLeft === 1 ? "" : "s"}`;
}

export interface SwitchCourseRenderInput {
  connected: boolean;
  courseName?: string | undefined;
}

/** Title for the Switch Course key: the plugin-wide "current course" it just cycled to. */
export function switchCourseKeyTitle(input: SwitchCourseRenderInput): string {
  if (!input.connected) return "Not\nconnected";
  return input.courseName ?? "No course";
}

export interface FocusModeRenderInput {
  connected: boolean;
  /** The built-in mode id currently displayed: the confirmed "next session" pick, or - while a
   *  Stream Deck + dial is mid-rotation - the not-yet-confirmed candidate under the user's
   *  finger. Ignored when `connected` is false. */
  modeId: number;
}

/** Multi-line title for the Focus Mode key/dial: the preset's name and its focus/break minutes,
 *  same "/Xm" shape as timerKeyTitle's duration suffix. */
export function focusModeKeyTitle(input: FocusModeRenderInput): string {
  if (!input.connected) return "Not\nconnected";
  const mode = BUILT_IN_MODES[input.modeId];
  if (!mode) return "Unknown\nmode";
  return `${mode.name}\n${String(mode.focus)}m/${String(mode.break)}m`;
}
