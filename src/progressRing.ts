// Pure SVG rendering for Focus Timer's key: a circular progress ring reflecting timer.ts's
// progress() fraction. Mirrors the "never fabricate a fraction you can't honestly compute"
// discipline render.ts's timerKeyTitle already follows for text: progress() is undefined for a
// custom timer mode (id >= 100, see timer.ts) because this plugin cannot read that mode's total
// length, and this module renders that as its own honestly-indeterminate visual rather than
// guessing 0%, 50%, or drawing a leftover full/empty ring.
import { svgToDataUri } from "./svgImage.js";
import type { Phase } from "./timer.js";

const SIZE = 200;
const STROKE = 18;
const RADIUS = (SIZE - STROKE) / 2;
const CENTER = SIZE / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** StudyLife's brand indigo - see com.lukislp.studylife.sdPlugin/ui/property-inspector.html's
 *  CSS for the canonical hex this is copied from. Used for the key's background (see
 *  background()) - never for the arc itself, since an indigo arc on an indigo background would
 *  be invisible. */
const ACCENT_COLOR = "#4F46E5";
/** The active arc's own color - solid white reads clearly against the indigo background,
 *  matching Focus Mode's already-established white-ring-on-indigo look. */
const ARC_COLOR = "#FFFFFF";
const TRACK_COLOR = "rgba(255, 255, 255, 0.28)";
/** A calmer, slightly dimmer track for the idle ring - distinct from the "actively tracking"
 *  track color so idle never reads as merely "0% progress". */
const IDLE_TRACK_COLOR = "rgba(255, 255, 255, 0.18)";

/** Length, as a fraction of the full ring, the indeterminate arc is drawn at - short enough to
 *  read as "a moving segment", never long enough to be mistaken for a real, high percentage. */
const INDETERMINATE_ARC_FRACTION = 0.22;
/** How long one full rotation of the indeterminate arc takes, in ms - long enough that Focus
 *  Timer's 5s poll (see timer-action.ts's POLL_MS) visibly moves it between refreshes without
 *  looking jumpy or like a stall. */
const INDETERMINATE_PERIOD_MS = 20_000;

export type RingVisual =
  | { kind: "idle" }
  | { kind: "progress"; fraction: number }
  | { kind: "indeterminate"; now: number };

/**
 * Which ring visual to draw for a given phase and progress fraction. `fraction` is expected to
 * already be timer.ts's progress() result (undefined for a custom mode). A stopped phase always
 * gets its own calm outline - never a leftover full or empty ring from whatever the previous run
 * last drew - regardless of what `fraction` happens to be (progress() is itself always undefined
 * while stopped, but this keeps that mapping explicit rather than relying on the overlap).
 */
export function ringVisualFor(phase: Phase, fraction: number | undefined, now: number): RingVisual {
  if (phase === "stopped") return { kind: "idle" };
  if (fraction === undefined) return { kind: "indeterminate", now };
  return { kind: "progress", fraction: Math.min(1, Math.max(0, fraction)) };
}

/**
 * The key's own indigo background, matching key.png's flat fill - action.setImage() *replaces*
 * the whole key face, not just overlays on top of it, so without painting this ourselves every
 * call here would silently drop back to Stream Deck's own default (black) backdrop the moment
 * this image is first set, not just look slightly different colored.
 */
function background(): string {
  return `<rect width="${SIZE}" height="${SIZE}" fill="${ACCENT_COLOR}" />`;
}

function trackCircle(color: string): string {
  return `<circle cx="${CENTER}" cy="${CENTER}" r="${RADIUS}" fill="none" stroke="${color}" stroke-width="${STROKE}" />`;
}

/** An accent arc covering `fraction` of the ring, starting at 12 o'clock and sweeping clockwise,
 *  then rotated a further `rotationDeg` on top of that - used both for a real progress fraction
 *  (rotationDeg 0) and for the indeterminate segment (rotationDeg animated from `now`). */
function arcCircle(fraction: number, rotationDeg: number): string {
  const dash = CIRCUMFERENCE * fraction;
  const gap = CIRCUMFERENCE - dash;
  return (
    `<circle cx="${CENTER}" cy="${CENTER}" r="${RADIUS}" fill="none" stroke="${ARC_COLOR}" ` +
    `stroke-width="${STROKE}" stroke-linecap="round" stroke-dasharray="${dash} ${gap}" ` +
    `transform="rotate(${rotationDeg - 90} ${CENTER} ${CENTER})" />`
  );
}

/** The ring's SVG markup for a given visual - a plain string builder (no DOM/canvas), so it is
 *  testable with ordinary string assertions and safe to build inside the Stream Deck plugin
 *  process on every poll. */
export function progressRingSvg(visual: RingVisual): string {
  let body: string;
  if (visual.kind === "idle") {
    body = `${background()}${trackCircle(IDLE_TRACK_COLOR)}`;
  } else if (visual.kind === "progress") {
    body = `${background()}${trackCircle(TRACK_COLOR)}${arcCircle(visual.fraction, 0)}`;
  } else {
    const rotationDeg = ((visual.now % INDETERMINATE_PERIOD_MS) / INDETERMINATE_PERIOD_MS) * 360;
    body = `${background()}${trackCircle(TRACK_COLOR)}${arcCircle(INDETERMINATE_ARC_FRACTION, rotationDeg)}`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">${body}</svg>`;
}

/** `action.setImage()`-ready data URI for `visual`. */
export function progressRingDataUri(visual: RingVisual): string {
  return svgToDataUri(progressRingSvg(visual));
}
