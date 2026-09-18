import { describe, expect, it } from "vitest";
import type { UpcomingGoal } from "../src/api.js";
import { nextCourse } from "../src/courseCycle.js";

function goal(courseId: number, courseName = `Course ${String(courseId)}`): UpcomingGoal {
  return { courseId, courseName, targetDate: "2026-10-01T00:00:00", daysLeft: 5 };
}

describe("nextCourse", () => {
  it("is undefined ('no course') when there are no open goals at all", () => {
    expect(nextCourse([], undefined)).toBeUndefined();
    expect(nextCourse([], 1)).toBeUndefined();
  });

  it("starts at the first goal when nothing is currently selected", () => {
    const goals = [goal(1), goal(2)];
    expect(nextCourse(goals, undefined)).toEqual(goal(1));
  });

  it("advances to the next goal in list order", () => {
    const goals = [goal(1), goal(2), goal(3)];
    expect(nextCourse(goals, 1)).toEqual(goal(2));
    expect(nextCourse(goals, 2)).toEqual(goal(3));
  });

  it("wraps past the last goal to 'no course' rather than looping straight back", () => {
    const goals = [goal(1), goal(2)];
    expect(nextCourse(goals, 2)).toBeUndefined();
  });

  it("restarts from the first goal once 'no course' cycles again", () => {
    const goals = [goal(1), goal(2)];
    const afterLast = nextCourse(goals, 2);
    expect(afterLast).toBeUndefined();
    expect(nextCourse(goals, afterLast?.courseId)).toEqual(goal(1));
  });

  it("restarts from the first goal when the current selection is no longer in the list", () => {
    const goals = [goal(1), goal(2)];
    // courseId 99 was cycled to earlier but has since been completed / fell out of the top-5.
    expect(nextCourse(goals, 99)).toEqual(goal(1));
  });
});
