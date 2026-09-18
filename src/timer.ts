// Timer semantics, mirroring StudyLife's own TimerService and studylife-vscode's timer.ts so this
// plugin produces states the web app, Home Assistant and every other add-on already understand.
//
// The wire shape has no "paused" flag. Pause and stop both push isRunning: false with
// phaseEndsAt: null; what separates them is whether the session survives. Getting this wrong is
// invisible in a green build - the server accepts unknown JSON properties and silently drops
// them - so it is kept here, in one place, under test.

/** The built-in presets (ids 1-9). Custom modes start at 100 and live in the user's settings,
 *  which this plugin is not scoped to read - see durationMinutes. */
export const BUILT_IN_MODES: Record<number, { name: string; focus: number; break: number }> = {
  1: { name: "Pomodoro Classic", focus: 25, break: 5 },
  2: { name: "Flow State", focus: 52, break: 17 },
  3: { name: "Ultradian Rhythm", focus: 90, break: 20 },
  4: { name: "Claude Mode", focus: 40, break: 10 },
  5: { name: "Sprint Bursts", focus: 10, break: 3 },
  6: { name: "Micro Focus", focus: 5, break: 1 },
  7: { name: "Quick Burst", focus: 15, break: 3 },
  8: { name: "Deep Dive", focus: 120, break: 20 },
  9: { name: "Marathon Session", focus: 180, break: 30 },
};

export interface TimerState {
  sessionId?: number | null;
  isRunning: boolean;
  isBreak?: boolean;
  currentRound?: number;
  timerModeId?: number;
  /** Local-time ISO string, null whenever the timer is not running. */
  phaseEndsAt?: string | null;
  clientNow?: string;
  [key: string]: unknown;
}

/** The built-in mode ids, ascending - the cycle order Focus Mode's key/dial steps through. */
export const BUILT_IN_MODE_IDS: readonly number[] = Object.keys(BUILT_IN_MODES)
  .map(Number)
  .sort((a, b) => a - b);

/**
 * Only ever derived from the wire, which has no "paused" flag (see the file header) - so this is
 * "stopped", not "paused", for every non-running state, including one this plugin itself just
 * paused. An earlier version tried to infer "paused" here from `sessionId` being set, on the
 * theory that a fresh stop always nulls it out; in practice `sessionId` lingers on the server for
 * reasons unrelated to this plugin's own pause/resume (a session from another client, a planned
 * one already attached), so that state was frequently "paused" when the timer was actually simply
 * stopped - `startingFresh` in timer-action.ts's onKeyUp then wrongly skipped a fresh run's Focus
 * Mode pick and session-booking, always falling back to whatever timerModeId happened to be on
 * the server row instead of what was just selected. Whether *this* key is the one waiting to
 * resume a pause is tracked locally instead (FocusTimerAction.pausedRemainderMs) - see
 * render.ts's TimerRenderInput.pausedLocally for the one place that distinction still matters for
 * the UI.
 */
export type Phase = "stopped" | "focus" | "break";

export function phaseOf(state: TimerState | undefined): Phase {
  if (!state?.isRunning) return "stopped";
  return state.isBreak ? "break" : "focus";
}

/**
 * Minutes the current phase lasts, or undefined for a custom mode. Custom modes (id >= 100) are
 * stored in the user's settings and this plugin has no scope to read them - so the countdown
 * degrades to showing only the remaining time rather than inventing a total.
 */
export function durationMinutes(state: TimerState | undefined): number | undefined {
  const mode = state?.timerModeId === undefined ? undefined : BUILT_IN_MODES[state.timerModeId];
  if (!mode) return undefined;
  return state?.isBreak ? mode.break : mode.focus;
}

export function modeName(state: TimerState | undefined): string | undefined {
  const id = state?.timerModeId;
  return id === undefined ? undefined : BUILT_IN_MODES[id]?.name;
}

/** A mode may only be changed while the timer is stopped or paused: switching mid-phase would
 *  leave a running countdown measured against a length that no longer applies - ported from
 *  studylife-vscode's timer.ts canChangeMode(). */
export function canChangeMode(current: TimerState | undefined): boolean {
  return !current?.isRunning;
}

/**
 * Steps the built-in mode cycle by `steps` positions - positive forward (1 -> 2 -> ... -> 9 -> 1),
 * negative backward, wrapping at both ends. `current` outside the built-in range (undefined, or a
 * custom mode id >= 100 already in use - see BUILT_IN_MODES' doc comment) is treated as "the cycle
 * has not started yet", so the first forward step always lands on the first built-in rather than
 * skipping past it.
 */
export function stepMode(current: number | undefined, steps: number): number {
  const ids = BUILT_IN_MODE_IDS;
  const length = ids.length;
  const index = current === undefined ? -1 : ids.indexOf(current);
  const wrapped = (((index + steps) % length) + length) % length;
  return ids[wrapped] ?? 1;
}

/** One forward step of stepMode - what a Focus Mode key press, or a single dial detent, applies. */
export function nextMode(current: number | undefined): number {
  return stepMode(current, 1);
}

/** Milliseconds until the phase ends, clamped at zero. undefined when nothing is running. */
export function remainingMs(state: TimerState | undefined, now: number): number | undefined {
  if (!state?.isRunning || !state.phaseEndsAt) return undefined;
  const ends = Date.parse(state.phaseEndsAt);
  if (Number.isNaN(ends)) return undefined;
  return Math.max(0, ends - now);
}

/**
 * Fraction of the current phase elapsed, from 0 (just started) to 1 (about to end) - undefined
 * whenever there is no honest way to compute one: nothing running (see remainingMs), or a custom
 * mode whose total length this plugin cannot read (id >= 100, see durationMinutes). Deliberately
 * never estimated from wall-clock time alone or guessed at a round number - without a known total
 * there is no fraction to report, so callers (progressRing.ts) render an explicitly indeterminate
 * visual instead of inventing one, the same discipline durationMinutes/timerKeyTitle already
 * apply to the text rendering.
 */
export function progress(state: TimerState | undefined, now: number): number | undefined {
  const remaining = remainingMs(state, now);
  if (remaining === undefined) return undefined;
  const totalMinutes = durationMinutes(state);
  if (totalMinutes === undefined) return undefined;
  const totalMs = totalMinutes * 60_000;
  if (totalMs <= 0) return undefined;
  const elapsed = totalMs - remaining;
  return Math.min(1, Math.max(0, elapsed / totalMs));
}

/** "24:13" - a countdown, unlike a plain duration string. */
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export interface TransitionOptions {
  /**
   * Milliseconds left in the phase when it was paused, to resume instead of restarting.
   *
   * This has to be carried by the caller because the wire shape cannot hold it: pausing sets
   * phaseEndsAt to null, and StudyLife's own client keeps the remainder in memory
   * (TimerService.Pause writes it to a private _secondsLeft field that is never sent). Without
   * it, "pause" is indistinguishable from "stop the clock and start over".
   */
  resumeMs?: number;
  /** Switches the preset for the *next* session - honoured on start only, same as
   *  studylife-vscode's TransitionOptions.modeId: applying it mid-phase would re-measure a
   *  countdown already running against a length that no longer applies (see canChangeMode). */
  modeId?: number;
  now: number;
}

/**
 * The next timer state for an action, built from the current one.
 *
 * start   - runs the remainder of the phase, or a fresh phase when nothing was pending
 * pause   - stops the clock but keeps the session, round and break flag
 * stop    - ends the session outright and resets to round one
 */
export function transition(
  current: TimerState | undefined,
  action: "start" | "pause" | "stop",
  options: TransitionOptions,
): TimerState {
  const base: TimerState = {
    sessionId: current?.sessionId ?? null,
    isRunning: false,
    isBreak: current?.isBreak ?? false,
    currentRound: current?.currentRound ?? 1,
    timerModeId: options.modeId ?? current?.timerModeId ?? 1,
    phaseEndsAt: null,
    clientNow: new Date(options.now).toISOString(),
  };

  if (action === "stop") {
    return { ...base, sessionId: null, isBreak: false, currentRound: 1 };
  }
  if (action === "pause") {
    return base;
  }

  // start: resume the live phase, then a remembered pause, and only then a full phase.
  const live = remainingMs(current, options.now);
  const resume = options.resumeMs !== undefined && options.resumeMs > 0 ? options.resumeMs : undefined;
  const minutes = durationMinutes(base);
  const durationMs = live && live > 0 ? live : (resume ?? (minutes ?? 25) * 60_000);
  return {
    ...base,
    isRunning: true,
    phaseEndsAt: new Date(options.now + durationMs).toISOString(),
  };
}

/**
 * What a single key tap should do next, for the tap-cycles-through-phases behaviour: idle -> start,
 * running -> pause, paused -> resume (itself just "start" again - see transition's start branch).
 */
export function nextTapAction(state: TimerState | undefined): "start" | "pause" {
  return state?.isRunning ? "pause" : "start";
}
