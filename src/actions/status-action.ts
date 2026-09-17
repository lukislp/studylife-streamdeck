// Study Status key: shows this week's hours and streak from Metrics.GetSummary, refreshed
// periodically while visible, with an immediate refresh on a press. Every number comes from
// StudyLife's own metrics endpoint - the single place those are calculated (see MetricsController)
// - so this key can never quietly disagree with the web app, exactly like studylife-vscode's
// status bar.
import streamDeck, {
  action,
  type DialAction,
  type KeyAction,
  KeyDownEvent,
  SingletonAction,
  WillAppearEvent,
  WillDisappearEvent,
} from "@elgato/streamdeck";
import { StudyLifeApi, openGoalCount } from "../api.js";
import { statusKeyTitle } from "../render.js";
import { readSettings } from "../settings.js";

const POLL_MS = 60_000;

/** See timer-action.ts's VisibleAction for why this excludes ActionContext. */
type VisibleAction = DialAction | KeyAction;

@action({ UUID: "com.lukislp.studylife.status" })
export class StudyStatusAction extends SingletonAction {
  private readonly pollers = new Map<string, ReturnType<typeof setInterval>>();

  override onWillAppear(ev: WillAppearEvent): void | Promise<void> {
    this.refresh(ev.action);
    const timer = setInterval(() => void this.refresh(ev.action), POLL_MS);
    this.pollers.set(ev.action.id, timer);
  }

  override onWillDisappear(ev: WillDisappearEvent): void | Promise<void> {
    const timer = this.pollers.get(ev.action.id);
    if (timer) clearInterval(timer);
    this.pollers.delete(ev.action.id);
  }

  override async onKeyDown(ev: KeyDownEvent): Promise<void> {
    await this.refresh(ev.action);
  }

  private async refresh(target: VisibleAction): Promise<void> {
    if (!target.isKey()) return;
    const settings = await readSettings();
    if (!settings.instanceUrl || !settings.apiKey) {
      await target.setTitle(statusKeyTitle({ connected: false }));
      return;
    }
    const api = new StudyLifeApi(settings.instanceUrl, settings.apiKey);
    try {
      const [metrics, goals] = await Promise.all([api.getMetricsSummary(), api.getCourseGoals()]);
      await target.setTitle(statusKeyTitle({ connected: true, metrics, openGoals: openGoalCount(goals) }));
    } catch (error) {
      streamDeck.logger.error("Study Status: refresh failed", error);
      await target.showAlert();
    }
  }
}
