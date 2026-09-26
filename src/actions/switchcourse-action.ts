// Switch Course key: cycles through the user's open course goals as the plugin-wide "current
// course" (global settings), the fallback source Focus Timer and Quick Note instances read when
// they have no course of their own bound - see timer-action.ts's beginRun and
// quicknote-action.ts's per-key courseId.
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
import { StudyLifeApi } from "../api.js";
import { nextCourse } from "../courseCycle.js";
import { getCachedMetrics } from "../metricsCache.js";
import { switchCourseKeyTitle } from "../render.js";
import { readSettings, setCurrentCourse } from "../settings.js";

const POLL_MS = 60_000;

/** See timer-action.ts's VisibleAction for why this excludes ActionContext but includes
 *  NeoInfobarAction. This action has no per-key settings, hence the plain JsonObject. */
type VisibleAction = DialAction<JsonObject> | KeyAction<JsonObject> | NeoInfobarAction<JsonObject>;

@action({ UUID: "com.lukislp.studylife.switchcourse" })
export class SwitchCourseAction extends SingletonAction {
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

  override async onKeyUp(ev: KeyUpEvent): Promise<void> {
    const settings = await readSettings();
    if (!settings.instanceUrl || !settings.apiKey) {
      await ev.action.showAlert();
      return;
    }
    const api = new StudyLifeApi(settings.instanceUrl, settings.apiKey);
    try {
      const metrics = await getCachedMetrics(api, Date.now());
      const goal = nextCourse(metrics.upcomingCourseGoals ?? [], settings.currentCourseId);
      await setCurrentCourse(goal === undefined ? undefined : { courseId: goal.courseId, courseName: goal.courseName });
      if (ev.action.isKey()) {
        await ev.action.setTitle(switchCourseKeyTitle({ connected: true, courseName: goal?.courseName }));
      }
    } catch (error) {
      streamDeck.logger.error("Switch Course: press failed", error);
      await ev.action.showAlert();
    }
  }

  private async refresh(target: VisibleAction): Promise<void> {
    if (!target.isKey()) return;
    const settings = await readSettings();
    if (!settings.instanceUrl || !settings.apiKey) {
      await target.setTitle(switchCourseKeyTitle({ connected: false }));
      return;
    }
    await target.setTitle(switchCourseKeyTitle({ connected: true, courseName: settings.currentCourseName }));
  }
}
