// Wraps hand-built SVG markup as a data URI `action.setImage()` accepts for an in-memory image
// with no file on disk - see @elgato/streamdeck's SetImage payload doc: "a base64 encoded string
// with the mime type declared (e.g. PNG, JPEG, etc.)". Split out so progressRing.ts and
// countdownBadge.ts share one implementation rather than each rolling their own.

/** `data:image/svg+xml;base64,...` for `svg` - pure and dependency-free, unlike the build-time
 *  icon pipeline (scripts/render-icons.mjs), which rasterizes to PNG with @resvg/resvg-js. The
 *  dynamic key art here stays as SVG: Stream Deck's own software renders it directly, so there is
 *  no need to pull a rasterizer into the runtime plugin bundle just to redraw a ring or a badge
 *  every few seconds. */
export function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}
