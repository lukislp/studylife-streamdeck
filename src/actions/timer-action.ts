// Focus Timer key: tap cycles idle -> start -> pause -> resume, long-press stops. Polls
// TimerState.Get while visible on a device (onWillAppear/onWillDisappear) and writes through
// TimerState.Save on a tap. The timer is a single shared StudyLife resource - not owned per key -
// so every visible instance polls and renders the same state, exactly like the web app, the tray
// app and studylife-vscode's status bar all showing the same thing.
//
// v2 adds session booking: on a genuine stopped -> running transition this key remembers the
// course it (or, when this key instance has none of its own, the "Switch Course" fallback) had
// selected, and books that stretch as a session on stop - see runLog.ts's decide() for the exact
// "unless already planned" rule this plugin implements only once. A pause/resume in between never
// starts a new run: only a tap from "stopped" does, so a pause does not truncate the logged
// duration back to the last resume.
import streamDeck, {
  action,
  type DialAction,
  type KeyAction,
  KeyDownEvent,
  KeyUpEvent,
  SingletonAction,
  WillAppearEvent,
  WillDisappearEvent,
} from "@elgato/streamdeck";
import { StudyLifeApi } from "../api.js";
import { getCachedMetrics } from "../metricsCache.js";
import { timerKeyTitle } from "../render.js";
import { buildSessionRequest, decide, type TimerRun } from "../runLog.js";
import { readSettings } from "../settings.js";
import { type TimerState, nextTapAction, remainingMs, transition } from "../timer.js";

const POLL_MS = 5_000;
const LONG_PRESS_MS = 600;

export interface FocusTimerSettings {
  /** Binds this specific key instance to one course, overriding the Switch Course fallback. */
  courseId?: number | undefined;
  /** A default Topic sent with the session this key books on stop, when set - written once here,
   *  same "fixed text, not typed per press" shape as Quick Note's content field. Omitted, not
   *  sent as "", when unset - see runLog.ts's buildSessionRequest. */
  topic?: string | undefined;
  [key: string]: number | string | undefined;
}

/** The two concrete action instance types onWillAppear/onKeyUp hand us - never ActionContext,
 *  which onWillDisappear carries instead and which this action never needs to render into. */
type VisibleAction = DialAction<FocusTimerSettings> | KeyAction<FocusTimerSettings>;

@action({ UUID: "com.lukislp.studylife.timer" })
export class FocusTimerAction extends SingletonAction<FocusTimerSettings> {
  private readonly pollers = new Map<string, ReturnType<typeof setInterval>>();
  private readonly pressedAt = new Map<string, number>();
  /** Remembered remainder from a pause this plugin itself triggered - see timer.ts's
   *  TransitionOptions.resumeMs doc for why the wire shape cannot carry it. */
  private pausedRemainderMs: number | undefined;
  /** What this plugin started, if anything - see runLog.ts. Only ever set from a genuine
   *  stopped -> running transition, never from resuming a pause (see the file header). */
  private currentRun: TimerRun | undefined;

  override onWillAppear(ev: WillAppearEvent<FocusTimerSettings>): void | Promise<void> {
    this.refresh(ev.action);
    const timer = setInterval(() => void this.refresh(ev.action), POLL_MS);
    this.pollers.set(ev.action.id, timer);
  }

  override onWillDisappear(ev: WillDisappearEvent<FocusTimerSettings>): void | Promise<void> {
    const timer = this.pollers.get(ev.action.id);
    if (timer) clearInterval(timer);
    this.pollers.delete(ev.action.id);
    this.pressedAt.delete(ev.action.id);
  }

  override onKeyDown(ev: KeyDownEvent<FocusTimerSettings>): void | Promise<void> {
    this.pressedAt.set(ev.action.id, Date.now());
  }

  override async onKeyUp(ev: KeyUpEvent<FocusTimerSettings>): Promise<void> {
    const downAt = this.pressedAt.get(ev.action.id);
    this.pressedAt.delete(ev.action.id);
    const isLongPress = downAt !== undefined && Date.now() - downAt >= LONG_PRESS_MS;

    const settings = await readSettings();
    if (!settings.instanceUrl || !settings.apiKey) {
      await ev.action.showAlert();
      return;
    }
    const api = new StudyLifeApi(settings.instanceUrl, settings.apiKey);

    try {
      const current = await api.getTimerState();
      const action = isLongPress ? "stop" : nextTapAction(current);
      const now = Date.now();
      // Whether the server being stopped means "ready for a fresh run" or "this key is holding a
      // pause to resume" cannot be read off `current` - the wire has no paused flag, and
      // `sessionId` lingers on the server for reasons that have nothing to do with this plugin's
      // own pause (see timer.ts's phaseOf doc comment for the bug this replaced). Only this
      // action's own remembered remainder means "I am the one waiting to resume".
      const startingFresh = action === "start" && !current.isRunning && this.pausedRemainderMs === undefined;

      if (action === "pause") {
        this.pausedRemainderMs = remainingMs(current, now);
      }
      if (startingFresh) {
        await this.beginRun(
          api,
          ev.payload.settings.courseId,
          settings.currentCourseId,
          ev.payload.settings.topic,
          current,
          now,
        );
      }

      const resumeMs = action === "start" ? this.pausedRemainderMs : undefined;
      // The Focus Mode preset is only ever honoured on a genuine stopped -> running transition -
      // resuming a pause must keep measuring against the length already in progress (see
      // timer.ts's TransitionOptions.modeId and canChangeMode).
      const modeId = startingFresh ? settings.currentModeId : undefined;
      const next = transition(current, action, {
        now,
        ...(resumeMs === undefined ? {} : { resumeMs }),
        ...(modeId === undefined ? {} : { modeId }),
      });
      const saved = await api.saveTimerState(next);
      if (action !== "pause") this.pausedRemainderMs = undefined;

      if (action === "stop") await this.bookRun(api, ev.action, current.sessionId, next.timerModeId, now);

      await this.render(ev.action, saved);
    } catch (error) {
      streamDeck.logger.error("Focus Timer: key press failed", error);
      await ev.action.showAlert();
    }
  }

  /** Records what this key is starting, resolving the course from this key's own setting first
   *  and the plugin-wide Switch Course fallback second - see the class doc comment. Nothing is
   *  recorded (and stopping later books nothing) when neither is set, same as v1's "timer still
   *  starts/stops, just doesn't book a session" behaviour. */
  private async beginRun(
    api: StudyLifeApi,
    perKeyCourseId: number | undefined,
    fallbackCourseId: number | undefined,
    perKeyTopic: string | undefined,
    current: TimerState,
    now: number,
  ): Promise<void> {
    const courseId = perKeyCourseId ?? fallbackCourseId;
    if (courseId === undefined) {
      this.currentRun = undefined;
      return;
    }
    // Best-effort only: a missed course name still logs the session, just with a generic
    // CourseName placeholder (see NewSession's doc comment - the server ignores it anyway).
    const courseName = await getCachedMetrics(api, now)
      .then((metrics) => metrics.upcomingCourseGoals?.find((g) => g.courseId === courseId)?.courseName)
      .catch(() => undefined);
    this.currentRun = {
      courseId,
      startedAt: now,
      sessionId: current.sessionId ?? null,
      ...(courseName === undefined ? {} : { courseName }),
      ...(perKeyTopic === undefined ? {} : { topic: perKeyTopic }),
    };
  }

  private async bookRun(
    api: StudyLifeApi,
    target: VisibleAction,
    plannedSessionId: number | null | undefined,
    timerModeId: number | undefined,
    now: number,
  ): Promise<void> {
    const run = this.currentRun;
    const decision = decide(run, plannedSessionId, now);
    this.currentRun = undefined;
    if (!decision.log) return;

    const session = buildSessionRequest(run, decision, timerModeId);
    try {
      await api.createSession(session);
    } catch (error) {
      // Losing the session silently would be the worst outcome - the user stopped a timer they
      // believed was being recorded.
      streamDeck.logger.error("Focus Timer: booking the finished run failed", error);
      if (target.isKey()) await target.showAlert();
    }
  }

  private async refresh(target: VisibleAction): Promise<void> {
    const settings = await readSettings();
    if (!settings.instanceUrl || !settings.apiKey) {
      if (target.isKey()) await target.setTitle(timerKeyTitle({ connected: false, now: Date.now() }));
      return;
    }
    const api = new StudyLifeApi(settings.instanceUrl, settings.apiKey);
    try {
      const now = Date.now();
      const [state, weekHours] = await Promise.all([
        api.getTimerState(),
        getCachedMetrics(api, now)
          .then((m) => m.hours?.week)
          .catch(() => undefined),
      ]);
      await this.render(target, state, weekHours);
    } catch (error) {
      streamDeck.logger.error("Focus Timer: poll failed", error);
    }
  }

  private async render(target: VisibleAction, state: TimerState, weekHours?: number): Promise<void> {
    if (!target.isKey()) return;
    await target.setTitle(
      timerKeyTitle({
        connected: true,
        state,
        now: Date.now(),
        weekHours,
        pausedLocally: this.pausedRemainderMs !== undefined,
      }),
    );
  }
}
