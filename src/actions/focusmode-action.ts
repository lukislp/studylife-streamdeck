// Focus Mode key/dial: cycles the built-in focus preset (see timer.ts's BUILT_IN_MODES) that
// Focus Timer applies on its *next* genuine start - the same plugin-wide "current X" fallback
// shape Switch Course gives currentCourseId, stored the same way (see settings.ts's
// setCurrentMode). Only the built-in nine are ever offered: custom modes (id >= 100) live in the
// user's StudyLife settings, which this plugin has no scope to read - see BUILT_IN_MODES' doc
// comment.
//
// Keypad behaviour (any Stream Deck): a press steps the cycle by one and applies it immediately.
// Encoder behaviour (Stream Deck + only): rotating the dial scrubs a candidate - shown on the
// dial's touch display live, but not yet applied - and pushing the dial confirms it, the same
// apply this key's own press performs. A rotate never touches the server or global settings; only
// a confirmed pick (keypad press, or dial push) does.
//
// A mode may only be changed while the timer is stopped or paused (timer.ts's canChangeMode) -
// switching mid-phase would re-measure a countdown already running against a length that no
// longer applies. A refused apply shows an alert, exactly like every other write in this plugin.
import streamDeck, {
  action,
  type DialAction,
  DialDownEvent,
  DialRotateEvent,
  type KeyAction,
  KeyUpEvent,
  SingletonAction,
  WillAppearEvent,
  WillDisappearEvent,
} from "@elgato/streamdeck";
import { StudyLifeApi } from "../api.js";
import { focusModeKeyTitle } from "../render.js";
import { readSettings, setCurrentMode } from "../settings.js";
import { BUILT_IN_MODE_IDS, canChangeMode, nextMode, stepMode, type TimerState } from "../timer.js";

const POLL_MS = 60_000;
const DEFAULT_MODE_ID = BUILT_IN_MODE_IDS[0] ?? 1;

/** See timer-action.ts's VisibleAction for why this excludes ActionContext. */
type VisibleAction = DialAction | KeyAction;

@action({ UUID: "com.lukislp.studylife.focusmode" })
export class FocusModeAction extends SingletonAction {
  private readonly pollers = new Map<string, ReturnType<typeof setInterval>>();
  /** The not-yet-confirmed mode a dial is currently scrubbed to, keyed by action instance id -
   *  only ever populated/read for Encoder instances; a Keypad instance applies immediately on
   *  press, so it never needs one. Reset to the committed value on every appear/refresh. */
  private readonly candidates = new Map<string, number>();

  override onWillAppear(ev: WillAppearEvent): void | Promise<void> {
    this.refresh(ev.action);
    const timer = setInterval(() => void this.refresh(ev.action), POLL_MS);
    this.pollers.set(ev.action.id, timer);
  }

  override onWillDisappear(ev: WillDisappearEvent): void | Promise<void> {
    const timer = this.pollers.get(ev.action.id);
    if (timer) clearInterval(timer);
    this.pollers.delete(ev.action.id);
    this.candidates.delete(ev.action.id);
  }

  override async onKeyUp(ev: KeyUpEvent): Promise<void> {
    const settings = await readSettings();
    if (!settings.instanceUrl || !settings.apiKey) {
      await ev.action.showAlert();
      return;
    }
    const api = new StudyLifeApi(settings.instanceUrl, settings.apiKey);
    try {
      const current = await api.getTimerState();
      if (!canChangeMode(current)) {
        await ev.action.showAlert();
        return;
      }
      const modeId = nextMode(settings.currentModeId);
      await this.apply(api, current, modeId);
      if (ev.action.isKey()) await ev.action.setTitle(focusModeKeyTitle({ connected: true, modeId }));
    } catch (error) {
      streamDeck.logger.error("Focus Mode: key press failed", error);
      await ev.action.showAlert();
    }
  }

  override async onDialRotate(ev: DialRotateEvent): Promise<void> {
    const settings = await readSettings();
    if (!settings.instanceUrl || !settings.apiKey) return;
    const base = this.candidates.get(ev.action.id) ?? settings.currentModeId;
    const candidate = stepMode(base, ev.payload.ticks);
    this.candidates.set(ev.action.id, candidate);
    await ev.action.setTitle(focusModeKeyTitle({ connected: true, modeId: candidate }));
  }

  override async onDialDown(ev: DialDownEvent): Promise<void> {
    const settings = await readSettings();
    if (!settings.instanceUrl || !settings.apiKey) {
      await ev.action.showAlert();
      return;
    }
    const api = new StudyLifeApi(settings.instanceUrl, settings.apiKey);
    try {
      const current = await api.getTimerState();
      if (!canChangeMode(current)) {
        // Revert the touch display to the still-committed pick - the scrub under the user's
        // finger never took effect.
        const committed = settings.currentModeId ?? DEFAULT_MODE_ID;
        this.candidates.set(ev.action.id, committed);
        await ev.action.setTitle(focusModeKeyTitle({ connected: true, modeId: committed }));
        await ev.action.showAlert();
        return;
      }
      const modeId = this.candidates.get(ev.action.id) ?? nextMode(settings.currentModeId);
      await this.apply(api, current, modeId);
      await ev.action.setTitle(focusModeKeyTitle({ connected: true, modeId }));
    } catch (error) {
      streamDeck.logger.error("Focus Mode: dial press failed", error);
      await ev.action.showAlert();
    }
  }

  /** Commits `modeId` as the plugin-wide "next session" pick and, best-effort, writes it through
   *  to the currently-stopped/paused TimerState too - same as studylife-vscode's pickTimerMode,
   *  so the panel and every other device show the new preset before the next session starts
   *  rather than only finding out once one does. */
  private async apply(api: StudyLifeApi, current: TimerState, modeId: number): Promise<void> {
    await setCurrentMode(modeId);
    try {
      await api.saveTimerState({ ...current, timerModeId: modeId });
    } catch (error) {
      // Not worth failing the whole action over: the pick is already durable in this plugin's
      // own global settings, and the next genuine start reads that regardless. Only the
      // immediate cross-device visibility is lost.
      streamDeck.logger.warn("Focus Mode: write-through to the server failed", error);
    }
  }

  private async refresh(target: VisibleAction): Promise<void> {
    const settings = await readSettings();
    if (!settings.instanceUrl || !settings.apiKey) {
      await target.setTitle(focusModeKeyTitle({ connected: false, modeId: DEFAULT_MODE_ID }));
      return;
    }
    const modeId = settings.currentModeId ?? DEFAULT_MODE_ID;
    this.candidates.set(target.id, modeId);
    await target.setTitle(focusModeKeyTitle({ connected: true, modeId }));
  }
}
