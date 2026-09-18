// Course Goal key: a per-key countdown to one specific open course goal, from
// metrics.upcomingCourseGoals (see api.ts's file header for why that list, not a separate
// CourseGoals.GetAll call, is "the courses worth offering"). Lets someone pin several different
// course-goal countdowns to different physical keys side by side. Bindable either from the
// Property Inspector's dropdown or by pressing the key itself, which cycles to the next goal -
// see onKeyUp.
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
import { countdownBadgeDataUri } from "../countdownBadge.js";
import { nextCourse } from "../courseCycle.js";
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

  /**
   * A press cycles this key's own bound course through the open goals (same wraparound as
   * Switch Course's nextCourse), so the key can be configured entirely from the hardware -
   * useful on a device without an open Property Inspector handy, and the PI's course dropdown
   * (once open) reflects the change immediately via Stream Deck's own didReceiveSettings push.
   */
  override async onKeyUp(ev: KeyUpEvent<CourseGoalSettings>): Promise<void> {
    const global = await readSettings();
    if (!global.instanceUrl || !global.apiKey) {
      await ev.action.showAlert();
      return;
    }
    const api = new StudyLifeApi(global.instanceUrl, global.apiKey);
    try {
      const settings = await ev.action.getSettings();
      const metrics = await getCachedMetrics(api, Date.now());
      const goal = nextCourse(metrics.upcomingCourseGoals ?? [], settings.courseId);
      await ev.action.setSettings(goal === undefined ? {} : { courseId: goal.courseId });
    } catch (error) {
      streamDeck.logger.error("Course Goal: press failed", error);
      await ev.action.showAlert();
      return;
    }
    await this.refresh(ev.action);
  }

  private async refresh(target: VisibleAction): Promise<void> {
    if (!target.isKey()) return;
    const global = await readSettings();
    if (!global.instanceUrl || !global.apiKey) {
      await target.setTitle(courseGoalKeyTitle({ connected: false, configured: false }));
      // No goal at all yet - revert to the manifest's plain key art rather than leaving a
      // stale badge from whatever goal was last bound.
      await target.setImage();
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
      // Only a found, open goal has an honest daysLeft to badge - see countdownBadge.ts's file
      // header for why this is a day count, never a fabricated completion percentage. Unset or
      // no-longer-open reverts to the plain manifest key art instead of a stale badge.
      await target.setImage(goal === undefined ? undefined : countdownBadgeDataUri({ daysLeft: goal.daysLeft }));
    } catch (error) {
      streamDeck.logger.error("Course Goal: refresh failed", error);
      await target.showAlert();
    }
  }
}
