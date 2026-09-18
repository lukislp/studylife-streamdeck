// Pure cycling logic for the Switch Course key - split out so the wraparound (goal -> goal ->
// "no course" -> back to the first goal) is testable without a Stream Deck connection.
import type { UpcomingGoal } from "./api.js";

/**
 * The course after `currentCourseId` in the list, or undefined ("no course") once the end is
 * reached - one extra "slot" past the last goal, so cycling can always get back to "no course"
 * bound rather than being forced onto one of the open goals.
 *
 * A course no longer present in the list (completed, or fallen out of the metrics endpoint's
 * top-5 window since it was picked) is treated the same as "nothing selected yet": cycling
 * restarts from the first goal rather than getting stuck looking for an id that will never match
 * again.
 */
export function nextCourse(goals: UpcomingGoal[], currentCourseId: number | undefined): UpcomingGoal | undefined {
  if (goals.length === 0) return undefined;
  const currentIndex = currentCourseId === undefined ? -1 : goals.findIndex((g) => g.courseId === currentCourseId);
  const nextIndex = currentIndex + 1;
  return nextIndex >= goals.length ? undefined : goals[nextIndex];
}
