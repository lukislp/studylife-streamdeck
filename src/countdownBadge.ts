// Pure SVG rendering for Course Goal's key: a countdown badge showing the actual day count,
// colored by urgency. Metrics.GetSummary's upcomingCourseGoals gives a target date and daysLeft,
// never a start date (see api.ts's UpcomingGoal), so there is no honest way to compute a
// completion fraction the way progressRing.ts can for Focus Timer - a badge with the real day
// count is the honest representation here, not a fabricated progress bar. Mirrors render.ts's
// formatDue for the equivalent text rendering.
import { svgToDataUri } from "./svgImage.js";

const SIZE = 200;
/** StudyLife's brand indigo - see com.lukislp.studylife.sdPlugin/ui/property-inspector.html's
 *  CSS for the canonical hex this is copied from. */
const ACCENT_COLOR = "#4F46E5";
/** Due today or overdue - a distinct warning color, never the neutral brand indigo. */
const WARNING_COLOR = "#DC2626";
const TEXT_COLOR = "#FFFFFF";

export interface CountdownBadgeInput {
  daysLeft: number;
}

/** True once a goal's target date has arrived or passed - the same today-or-overdue threshold
 *  render.ts's formatDue uses for its "today"/"overdue" text branches, kept here as its own named
 *  predicate so the badge's color rule and the title's wording can never drift apart. */
export function isUrgent(daysLeft: number): boolean {
  return daysLeft <= 0;
}

/** The badge's centered label: an unsigned day count. "Overdue" carries the same magnitude as
 *  "due in N days" - the sign only ever changes the color (see isUrgent), never the number shown,
 *  matching formatDue's own Math.abs use. Clamped to a fixed width so a goal left un-checked for
 *  a very long time cannot overflow the badge's circle. */
function badgeLabel(daysLeft: number): string {
  const abs = Math.abs(daysLeft);
  return abs > 999 ? "999+" : String(abs);
}

/**
 * The badge's SVG markup for a known days-left count - a filled circle colored by urgency with
 * the day count centered inside. A plain string builder (no DOM/canvas), so it is testable with
 * ordinary string assertions.
 */
export function countdownBadgeSvg(input: CountdownBadgeInput): string {
  const color = isUrgent(input.daysLeft) ? WARNING_COLOR : ACCENT_COLOR;
  const label = badgeLabel(input.daysLeft);
  const fontSize = label.length > 2 ? 64 : 84;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">` +
    `<circle cx="${SIZE / 2}" cy="${SIZE / 2}" r="${SIZE / 2 - 8}" fill="${color}" />` +
    `<text x="${SIZE / 2}" y="${SIZE / 2}" text-anchor="middle" dominant-baseline="central" ` +
    `font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${fontSize}" ` +
    `fill="${TEXT_COLOR}">${label}</text></svg>`
  );
}

/** `action.setImage()`-ready data URI for `input`. */
export function countdownBadgeDataUri(input: CountdownBadgeInput): string {
  return svgToDataUri(countdownBadgeSvg(input));
}
