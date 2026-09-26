// Study Status key: shows this week's and today's hours plus streak from Metrics.GetSummary and
// Sessions.GetHistory, refreshed periodically while visible, with an immediate refresh on a
// press. Every number comes from StudyLife's own metrics/history endpoints - the single place
// those are calculated (see MetricsController, SessionsController) - so this key can never
// quietly disagree with the web app, exactly like studylife-vscode's status bar.
import type { JsonObject } from "@elgato/utils";
import streamDeck, {
  action,
  type DialAction,
  type KeyAction,
  KeyUpEvent,
  type NeoInfobarAction,
  SingletonAction,
  WillAppearEvent,
  WillDisappearEvent,
} from "@elgato/streamdeck";
import { openGoalCount, StudyLifeApi } from "../api.js";
import { sumTodayHours } from "../history.js";
import { getCachedMetrics } from "../metricsCache.js";
import { statusKeyTitle } from "../render.js";
import { readSettings } from "../settings.js";

const POLL_MS = 60_000;

/** See timer-action.ts's VisibleAction for why this excludes ActionContext but includes
 *  NeoInfobarAction. This action has no per-key settings, hence the plain JsonObject. */
type VisibleAction = DialAction<JsonObject> | KeyAction<JsonObject> | NeoInfobarAction<JsonObject>;

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

  // onKeyUp, not onKeyDown: matches the Stream Deck press convention the Focus Timer action
  // already follows (see timer-action.ts) - triggering on release, not on press, is what lets a
  // user cancel a press by dragging off the key before releasing.
  override async onKeyUp(ev: KeyUpEvent): Promise<void> {
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
      const now = Date.now();
      const [metrics, history] = await Promise.all([getCachedMetrics(api, now), api.getTodayHistory()]);
      await target.setTitle(
        statusKeyTitle({
          connected: true,
          metrics,
          todayHours: sumTodayHours(history, now),
          openGoals: openGoalCount(metrics.upcomingCourseGoals),
        }),
      );
    } catch (error) {
      streamDeck.logger.error("Study Status: refresh failed", error);
      await target.showAlert();
    }
  }
}
