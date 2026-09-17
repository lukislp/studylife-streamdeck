// Focus Timer key: tap cycles idle -> start -> pause -> resume, long-press stops. Polls
// TimerState.Get while visible on a device (onWillAppear/onWillDisappear) and writes through
// TimerState.Save on a tap. The timer is a single shared StudyLife resource - not owned per key -
// so every visible instance polls and renders the same state, exactly like the web app, the tray
// app and studylife-vscode's status bar all showing the same thing.
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
import { timerKeyTitle } from "../render.js";
import { readSettings } from "../settings.js";
import { type TimerState, nextTapAction, remainingMs, transition } from "../timer.js";

const POLL_MS = 5_000;
const LONG_PRESS_MS = 600;

/** The two concrete action instance types onWillAppear/onKeyUp hand us - never ActionContext,
 *  which onWillDisappear carries instead and which this action never needs to render into. */
type VisibleAction = DialAction | KeyAction;

@action({ UUID: "com.lukislp.studylife.timer" })
export class FocusTimerAction extends SingletonAction {
  private readonly pollers = new Map<string, ReturnType<typeof setInterval>>();
  private readonly pressedAt = new Map<string, number>();
  /** Remembered remainder from a pause this plugin itself triggered - see timer.ts's
   *  TransitionOptions.resumeMs doc for why the wire shape cannot carry it. */
  private pausedRemainderMs: number | undefined;

  override onWillAppear(ev: WillAppearEvent): void | Promise<void> {
    this.refresh(ev.action);
    const timer = setInterval(() => void this.refresh(ev.action), POLL_MS);
    this.pollers.set(ev.action.id, timer);
  }

  override onWillDisappear(ev: WillDisappearEvent): void | Promise<void> {
    const timer = this.pollers.get(ev.action.id);
    if (timer) clearInterval(timer);
    this.pollers.delete(ev.action.id);
    this.pressedAt.delete(ev.action.id);
  }

  override onKeyDown(ev: KeyDownEvent): void | Promise<void> {
    this.pressedAt.set(ev.action.id, Date.now());
  }

  override async onKeyUp(ev: KeyUpEvent): Promise<void> {
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
      if (action === "pause") {
        this.pausedRemainderMs = remainingMs(current, Date.now());
      }
      const resumeMs = action === "start" ? this.pausedRemainderMs : undefined;
      const next = transition(
        current,
        action,
        resumeMs === undefined ? { now: Date.now() } : { now: Date.now(), resumeMs },
      );
      const saved = await api.saveTimerState(next);
      if (action !== "pause") this.pausedRemainderMs = undefined;
      await this.render(ev.action, saved);
    } catch (error) {
      streamDeck.logger.error("Focus Timer: key press failed", error);
      await ev.action.showAlert();
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
      const state = await api.getTimerState();
      await this.render(target, state);
    } catch (error) {
      streamDeck.logger.error("Focus Timer: poll failed", error);
    }
  }

  private async render(target: VisibleAction, state: TimerState): Promise<void> {
    if (!target.isKey()) return;
    await target.setTitle(timerKeyTitle({ connected: true, state, now: Date.now() }));
  }
}
