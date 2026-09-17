// Pure title-text rules for both key actions. Split out from the actions themselves so the text
// is unit-testable without a Stream Deck connection, mirroring studylife-vscode's statusBar.ts
// render functions.
import type { MetricsSummary } from "./api.js";
import { type Phase, type TimerState, durationMinutes, formatCountdown, phaseOf, remainingMs } from "./timer.js";

export interface TimerRenderInput {
  connected: boolean;
  state?: TimerState | undefined;
  now: number;
}

/** Multi-line title for the Focus Timer key - Stream Deck key titles wrap on "\n". */
export function timerKeyTitle(input: TimerRenderInput): string {
  if (!input.connected) return "Not\nconnected";
  const phase = phaseOf(input.state);
  const label = phaseLabel(phase);
  const remaining = remainingMs(input.state, input.now);
  if (remaining === undefined) return label;
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
  openGoals?: number | undefined;
}

/** Multi-line title for the Study Status key: today is not in the API (see api.ts), so this shows
 *  the week figure StudyLife's own metrics endpoint actually calculates. */
export function statusKeyTitle(input: StatusRenderInput): string {
  if (!input.connected) return "Not\nconnected";
  const lines: string[] = [];
  const week = input.metrics?.hours?.week;
  lines.push(week === undefined ? "--h" : `${formatHours(week)}\nweek`);
  const streak = input.metrics?.streak?.current;
  if (streak !== undefined) lines.push(`${streak}d streak`);
  else if (input.openGoals !== undefined) lines.push(`${input.openGoals} goals`);
  return lines.join("\n");
}

/** "2.5h" - short enough for a key face, unlike a full "2 h 30 min". */
export function formatHours(hours: number): string {
  return `${(Math.round(hours * 10) / 10).toString()}h`;
}
