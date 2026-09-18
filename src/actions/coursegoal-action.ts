// Course Goal key: a per-key countdown to one specific open course goal, picked once in the
// Property Inspector from metrics.upcomingCourseGoals (see api.ts's file header for why that
// list, not a separate CourseGoals.GetAll call, is "the courses worth offering"). Lets someone
// pin several different course-goal countdowns to different physical keys side by side.
import streamDeck, {
  action,
  type DialAction,
  type KeyAction,
  KeyUpEvent,
  SingletonAction,
  WillAppearEvent,
  WillDisappearEvent,
} from "@elgato/streamdeck";
import { StudyLifeApi } from "../api.js";
import { getCachedMetrics } from "../metricsCache.js";
import { courseGoalKeyTitle } from "../render.js";
import { readSettings } from "../settings.js";

const POLL_MS = 60_000;

export interface CourseGoalSettings {
  /** The course this key instance tracks, picked once in the Property Inspector. */
  courseId?: number | undefined;
  [key: string]: number | undefined;
}

type VisibleAction = DialAction<CourseGoalSettings> | KeyAction<CourseGoalSettings>;

@action({ UUID: "com.lukislp.studylife.coursegoal" })
export class CourseGoalAction extends SingletonAction<CourseGoalSettings> {
  private readonly pollers = new Map<string, ReturnType<typeof setInterval>>();

  override onWillAppear(ev: WillAppearEvent<CourseGoalSettings>): void | Promise<void> {
    this.refresh(ev.action);
    const timer = setInterval(() => void this.refresh(ev.action), POLL_MS);
    this.pollers.set(ev.action.id, timer);
  }

  override onWillDisappear(ev: WillDisappearEvent<CourseGoalSettings>): void | Promise<void> {
    const timer = this.pollers.get(ev.action.id);
    if (timer) clearInterval(timer);
    this.pollers.delete(ev.action.id);
  }

  override async onKeyUp(ev: KeyUpEvent<CourseGoalSettings>): Promise<void> {
    await this.refresh(ev.action);
  }

  private async refresh(target: VisibleAction): Promise<void> {
    if (!target.isKey()) return;
    const global = await readSettings();
    if (!global.instanceUrl || !global.apiKey) {
      await target.setTitle(courseGoalKeyTitle({ connected: false, configured: false }));
      return;
    }
    const api = new StudyLifeApi(global.instanceUrl, global.apiKey);
    try {
      const settings = await target.getSettings();
      const metrics = await getCachedMetrics(api, Date.now());
      const goal = metrics.upcomingCourseGoals?.find((g) => g.courseId === settings.courseId);
      await target.setTitle(
        courseGoalKeyTitle({ connected: true, configured: settings.courseId !== undefined, goal }),
      );
    } catch (error) {
      streamDeck.logger.error("Course Goal: refresh failed", error);
      await target.showAlert();
    }
  }
}
