import fc from "fast-check";
import { describe, it } from "vitest";
import type { SessionRecord, UpcomingGoal } from "../src/api.js";
import { berlinDayBoundsPretendUtc, berlinWallClockIso, parseNaiveBerlin } from "../src/berlinTime.js";
import { nextCourse } from "../src/courseCycle.js";
import { sumTodayHours } from "../src/history.js";
import { noteTitle } from "../src/noteTitle.js";

const instant = fc.integer({ min: 946_684_800_000, max: 4_102_444_800_000 });

describe("berlinTime (property-based)", () => {
  it("berlinWallClockIso always produces a string parseNaiveBerlin accepts", () => {
    fc.assert(
      fc.property(instant, (ms) => {
        const iso = berlinWallClockIso(ms);
        return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(iso) && parseNaiveBerlin(iso) !== undefined;
      }),
    );
  });

  it("the wall-clock string differs from the real instant by at most Berlin's UTC offset (1-2 h) and keeps order", () => {
    fc.assert(
      fc.property(instant, instant, (a, b) => {
        const pa = parseNaiveBerlin(berlinWallClockIso(a));
        const pb = parseNaiveBerlin(berlinWallClockIso(b));
        if (pa === undefined || pb === undefined) return false;
        const offset = pa - Math.floor(a / 1000) * 1000;
        const withinOffset = offset === 3_600_000 || offset === 7_200_000;
        return withinOffset && (a - b) * (pa - pb) >= 0;
      }),
    );
  });

  it("parseNaiveBerlin never throws on arbitrary text and only returns finite numbers", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const ms = parseNaiveBerlin(s);
        return ms === undefined || Number.isFinite(ms);
      }),
    );
  });

  it("the Berlin day bounds are exactly 24 h wide and contain the pretend-UTC reading of now", () => {
    fc.assert(
      fc.property(instant, (now) => {
        const { start, end } = berlinDayBoundsPretendUtc(now);
        const pretendNow = parseNaiveBerlin(berlinWallClockIso(now));
        return end - start === 86_400_000 && pretendNow !== undefined && start <= pretendNow && pretendNow < end;
      }),
    );
  });
});

describe("sumTodayHours (property-based)", () => {
  const naive = fc
    .date({ min: new Date("2020-01-01"), max: new Date("2040-01-01"), noInvalidDate: true })
    .map((d) => d.toISOString().slice(0, 19));
  const session: fc.Arbitrary<SessionRecord> = fc.record(
    { startTime: fc.oneof(naive, fc.string()), endTime: fc.oneof(naive, fc.string()) },
    { requiredKeys: [] },
  );

  it("is finite, non-negative and at most 24 hours per session, whatever the sessions look like", () => {
    fc.assert(
      fc.property(fc.array(session, { maxLength: 20 }), instant, (sessions, now) => {
        const hours = sumTodayHours(sessions, now);
        return Number.isFinite(hours) && hours >= 0 && hours <= sessions.length * 24;
      }),
    );
  });

  it("a single session never contributes more than 24 hours or more than its own length", () => {
    fc.assert(
      fc.property(naive, naive, instant, (a, b, now) => {
        const hours = sumTodayHours([{ startTime: a, endTime: b }], now);
        const own = Math.max(0, (Date.parse(`${b}Z`) - Date.parse(`${a}Z`)) / 3_600_000);
        return hours >= 0 && hours <= 24 && hours <= own + 1e-9;
      }),
    );
  });
});

describe("noteTitle (property-based)", () => {
  it("is never empty, never longer than 80 characters, and never contains a line break", () => {
    fc.assert(
      fc.property(fc.string(), (content) => {
        const title = noteTitle(content);
        return title.length > 0 && [...title].length <= 80 && !title.includes("\n");
      }),
    );
  });

  it("is trimmed and comes from the first non-blank line of the content", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (content) => {
        const title = noteTitle(content);
        if (title === "Quick Note") return true;
        const first = content
          .split("\n")
          .map((l) => l.trim())
          .find((l) => l.length > 0);
        return title === title.trim() && first !== undefined && first.startsWith(title.replace(/…$/, ""));
      }),
    );
  });
});

describe("nextCourse (property-based)", () => {
  const goal = (courseId: number): UpcomingGoal => ({ courseId, courseName: `c${courseId}`, targetDate: "2030-01-01", daysLeft: 1 });
  const goals = fc.uniqueArray(fc.integer({ min: 1, max: 1000 }), { maxLength: 8 }).map((ids) => ids.map(goal));

  it("cycling visits every goal once from a fresh start and then returns to 'no course'", () => {
    fc.assert(
      fc.property(goals, (list) => {
        const visited: number[] = [];
        let current: UpcomingGoal | undefined = nextCourse(list, undefined);
        while (current !== undefined) {
          visited.push(current.courseId);
          current = nextCourse(list, current.courseId);
        }
        return visited.length === list.length && visited.every((id, i) => id === list[i]?.courseId);
      }),
    );
  });

  it("always returns a member of the list or undefined, even for an unknown current course", () => {
    fc.assert(
      fc.property(goals, fc.option(fc.integer({ min: -5, max: 2000 }), { nil: undefined }), (list, current) => {
        const next = nextCourse(list, current);
        return next === undefined || list.includes(next);
      }),
    );
  });
});
