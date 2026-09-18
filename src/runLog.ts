// Deciding whether a finished timer run should become a study session.
//
// Ported verbatim in shape from studylife-vscode's runLog.ts - see that file's header for the
// full rationale, repeated briefly here: StudyLife's timer does not record time itself. The web
// app attaches it to a session the planner already created; the timer state carries neither a
// course nor a start time (TimerState has sessionId, isRunning, isBreak, currentRound,
// timerModeId and phaseEndsAt, and nothing else - see timer.ts). So a run started from this
// plugin, with nothing planned for that slot, would otherwise run its course and book nothing.
//
// This plugin therefore remembers what it started and, on stop, turns it into a session - unless
// a planned one was already attached, in which case StudyLife is already accounting for the time
// and a second row would double-count it.
import type { NewSession } from "./api.js";
import { berlinWallClockIso } from "./berlinTime.js";

/** What this plugin recorded when a key started a run. */
export interface TimerRun {
  courseId: number;
  courseName?: string;
  startedAt: number;
  /** The planned session the timer was attached to when it started, if any. */
  sessionId?: number | null;
  /** Focus Timer's per-key "default topic" (Property Inspector), captured at start so a mid-run
   *  settings edit cannot change what a run in progress books. Sent as NewSession's Topic when
   *  non-blank; omitted, not sent as "", when unset - see buildSessionRequest. */
  topic?: string;
}

/**
 * Below this a run is an accident - a start immediately undone, or a mis-tap on a key.
 *
 * Ten seconds, not the minute it started as: a deliberate one-minute focus block is a real
 * session, and dropping it silently is worse than recording something short.
 */
export const MINIMUM_LOGGABLE_MS = 10_000;

export type Decision =
  | { log: true; courseId: number; startedAt: number; endedAt: number }
  | { log: false; reason: "no-run" | "planned" | "too-short" };

/**
 * Whether stopping now should create a session.
 *
 * `plannedSessionId` is the sessionId on the timer state as it stood at the stop - if StudyLife
 * had a planned session attached, it is already accounting for this time.
 */
export function decide(run: TimerRun | undefined, plannedSessionId: number | null | undefined, now: number): Decision {
  if (!run) return { log: false, reason: "no-run" };
  if (typeof plannedSessionId === "number") return { log: false, reason: "planned" };
  if (now - run.startedAt < MINIMUM_LOGGABLE_MS) return { log: false, reason: "too-short" };
  return { log: true, courseId: run.courseId, startedAt: run.startedAt, endedAt: now };
}

/**
 * Builds the Sessions.Create payload for a run decide() said should be logged - split out from
 * timer-action.ts's bookRun so the "Topic omitted, not sent empty" rule is unit-testable without a
 * Stream Deck connection, same as decide() itself. CourseName is required non-empty by the
 * server's Validate() but its content is ignored (see NewSession's doc comment), so a run whose
 * name could not be resolved still falls back to a generic label rather than failing validation.
 */
export function buildSessionRequest(
  run: TimerRun | undefined,
  decision: Extract<Decision, { log: true }>,
  timerModeId: number | undefined,
): NewSession {
  const topic = run?.topic?.trim();
  return {
    courseId: decision.courseId,
    courseName: run?.courseName ?? "StudyLife session",
    startTime: berlinWallClockIso(decision.startedAt),
    endTime: berlinWallClockIso(decision.endedAt),
    ...(timerModeId === undefined ? {} : { timerModeId }),
    ...(topic ? { topic } : {}),
  };
}
