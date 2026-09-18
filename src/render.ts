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
  /** True while `state` is stopped AND the Focus Timer action itself is the one holding a
   *  remembered remainder to resume (FocusTimerAction.pausedRemainderMs) - the wire has no paused
   *  flag (see timer.ts's phaseOf doc comment), so this can only ever be known locally, never
   *  read off `state`. Ignored for a state that is actually running. */
  pausedLocally?: boolean | undefined;
}

/** Multi-line title for the Focus Timer key - Stream Deck key titles wrap on "\n". */
export function timerKeyTitle(input: TimerRenderInput): string {
  if (!input.connected) return "Not\nconnected";
  const phase = phaseOf(input.state);
  const label = phase === "stopped" && input.pausedLocally ? "Paused" : phaseLabel(phase);
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

/** Conservative per-line budget for a Stream Deck key title. Empirically, a single line around
 *  10-11 characters ("Micro Focus") already overflows the key face at the default title font,
 *  while 10 ("68d streak") is the last one observed to still fit - so this stays a little under
 *  that boundary on purpose: an extra short line reads better than clipped text. */
const MAX_TITLE_LINE_CHARS = 9;

/**
 * Greedy word-wrap for a Stream Deck key title: breaks `text` into lines of at most `maxChars`
 * each, only ever at a space, never mid-word - a title has no hyphenation, and a word broken mid-
 * way reads worse than one that simply runs a little wide. A single word longer than `maxChars`
 * is kept whole on its own line rather than split. When `maxLines` is given and wrapping would
 * exceed it, the extra lines are folded into the last kept one with a trailing ellipsis.
 */
export function wrapTitle(text: string, maxChars: number, maxLines?: number): string[] {
  const words = text.split(" ").filter((w) => w.length > 0);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  if (lines.length === 0) lines.push(text);
  if (maxLines === undefined || lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  const last = kept[maxLines - 1] ?? "";
  kept[maxLines - 1] =
    last.length > maxChars - 1 ? `${last.slice(0, maxChars - 1)}…` : `${last}…`;
  return kept;
}

export interface CourseGoalRenderInput {
  connected: boolean;
  /** Whether this key instance has a courseId bound in its Property Inspector settings, as
   *  opposed to the goal simply not being found (e.g. it was completed since being picked). */
  configured: boolean;
  goal?: UpcomingGoal | undefined;
}

/** Multi-line title for the Course Goal key: the tracked course's name and countdown. The name
 *  wraps (and, if it still does not fit, is ellipsised) rather than overflowing the key - course
 *  names are free text and often longer than a key face can show on one line. */
export function courseGoalKeyTitle(input: CourseGoalRenderInput): string {
  if (!input.connected) return "Not\nconnected";
  if (!input.configured) return "No course\nset";
  if (!input.goal) return "Goal not\nopen";
  const name = wrapTitle(input.goal.courseName, MAX_TITLE_LINE_CHARS, 2).join("\n");
  return `${name}\n${formatDue(input.goal.daysLeft)}`;
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

/** Title for the Switch Course key: the plugin-wide "current course" it just cycled to. Wrapped
 *  for the same reason as courseGoalKeyTitle - a course name is free text with no length cap. */
export function switchCourseKeyTitle(input: SwitchCourseRenderInput): string {
  if (!input.connected) return "Not\nconnected";
  if (!input.courseName) return "No course";
  return wrapTitle(input.courseName, MAX_TITLE_LINE_CHARS, 3).join("\n");
}

export interface FocusModeRenderInput {
  connected: boolean;
  /** The built-in mode id currently displayed: the confirmed "next session" pick, or - while a
   *  Stream Deck + dial is mid-rotation - the not-yet-confirmed candidate under the user's
   *  finger. Ignored when `connected` is false. */
  modeId: number;
}

/** Multi-line title for the Focus Mode key/dial: the preset's name and its focus/break minutes,
 *  same "/Xm" shape as timerKeyTitle's duration suffix. Every built-in name is two words and at
 *  least one of them (e.g. "Micro Focus", "Pomodoro Classic") is too wide for the key face on one
 *  line, so the name is wrapped rather than left to overflow - see MAX_TITLE_LINE_CHARS. */
export function focusModeKeyTitle(input: FocusModeRenderInput): string {
  if (!input.connected) return "Not\nconnected";
  const mode = BUILT_IN_MODES[input.modeId];
  if (!mode) return "Unknown\nmode";
  const name = wrapTitle(mode.name, MAX_TITLE_LINE_CHARS, 2).join("\n");
  return `${name}\n${String(mode.focus)}m/${String(mode.break)}m`;
}
