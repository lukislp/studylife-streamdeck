// Pure SVG rendering for Course Goal's key: a flat background colored by urgency, replacing
// key.png's default indigo. Metrics.GetSummary's upcomingCourseGoals gives a target date and
// daysLeft, never a start date (see api.ts's UpcomingGoal), so there is no honest way to compute
// a completion fraction the way progressRing.ts can for Focus Timer - urgency-by-color is the
// honest signal this can add on top of what's already true. The actual day count is left to the
// key's title text (render.ts's courseGoalKeyTitle already includes it) rather than also being
// drawn into this image - an earlier version baked a large centered number in here too, which
// collided directly with that title text once both render (both ending up white-on-indigo,
// fighting for the same central space).
import { svgToDataUri } from "./svgImage.js";

const SIZE = 200;
/** StudyLife's brand indigo - see com.lukislp.studylife.sdPlugin/ui/property-inspector.html's
 *  CSS for the canonical hex this is copied from. */
const ACCENT_COLOR = "#4F46E5";
/** Due today or overdue - a distinct warning color, never the neutral brand indigo. */
const WARNING_COLOR = "#DC2626";

export interface CountdownBadgeInput {
  daysLeft: number;
}

/** True once a goal's target date has arrived or passed - the same today-or-overdue threshold
 *  render.ts's formatDue uses for its "today"/"overdue" text branches, kept here as its own named
 *  predicate so the badge's color rule and the title's wording can never drift apart. */
export function isUrgent(daysLeft: number): boolean {
  return daysLeft <= 0;
}

/**
 * The badge's SVG markup for a known days-left count - a flat background colored by urgency,
 * filling the whole key (not an inset shape): action.setImage() *replaces* the whole key face, so
 * anything less than full-canvas would leave the rest transparent and fall back to Stream Deck's
 * own default (black) backdrop instead of matching every other key's flat-colored look. A plain
 * string builder (no DOM/canvas), so it is testable with ordinary string assertions.
 */
export function countdownBadgeSvg(input: CountdownBadgeInput): string {
  const color = isUrgent(input.daysLeft) ? WARNING_COLOR : ACCENT_COLOR;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">` +
    `<rect width="${SIZE}" height="${SIZE}" fill="${color}" /></svg>`
  );
}

/** `action.setImage()`-ready data URI for `input`. */
export function countdownBadgeDataUri(input: CountdownBadgeInput): string {
  return svgToDataUri(countdownBadgeSvg(input));
}
