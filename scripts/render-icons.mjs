// Regenerates every static plugin icon (action list icons, key faces, category icon, plugin
// icon) from the hand-written SVG glyphs under assets/icons/. Run with `npm run icons` after
// changing a glyph - nothing under com.lukislp.studylife.sdPlugin/imgs/ should be hand-edited or
// hand-committed as a one-off binary; this script is the only source of truth for how those PNGs
// are produced.
//
// @resvg/resvg-js is a devDependency only, used here at build time - it is never imported by
// src/plugin.ts or bundled into the runtime plugin (see build.mjs's entry point), so it never
// ships to end users.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const ICONS_DIR = join(ROOT, "assets", "icons");
const IMGS_DIR = join(ROOT, "com.lukislp.studylife.sdPlugin", "imgs");

/** StudyLife's brand indigo - see com.lukislp.studylife.sdPlugin/ui/property-inspector.html's
 *  CSS for the canonical hex this is copied from. */
const BRAND_INDIGO = "#4F46E5";

/** A near-black neutral for the action-list icon's glyph - indigo is a mid-tone and reads as
 *  weak/washed-out at the tiny sizes that panel renders (20x20/40x40), even though it is not
 *  literally invisible the way white was. Dark neutral gives the strongest possible contrast
 *  against a light panel without needing to match its exact background shade. */
const ICON_DARK = "#18181B";

/** Each action's glyph source file and the directory its rendered icon.png/icon@2x.png/key.png/
 *  key@2x.png live under - both already fixed by manifest.json, only the pixel content changes
 *  here. */
const ACTIONS = [
  { glyph: "timer", dir: "timer" },
  { glyph: "status", dir: "status" },
  { glyph: "coursegoal", dir: "coursegoal" },
  { glyph: "quicknote", dir: "quicknote" },
  { glyph: "switchcourse", dir: "switchcourse" },
  { glyph: "focusmode", dir: "focusmode" },
];

/**
 * Pulls the inner markup out of a hand-written glyph SVG (which is itself a complete, valid,
 * previewable document) so it can be recomposed into differently-sized/backgrounded wrapper
 * documents below, without pulling in a full XML parser for what is always simple, well-formed
 * markup written by hand in this repo.
 */
function glyphInnerMarkup(name) {
  const source = readFileSync(join(ICONS_DIR, `${name}.svg`), "utf8");
  const match = /<svg[^>]*>([\s\S]*)<\/svg>/.exec(source);
  if (!match) throw new Error(`assets/icons/${name}.svg is not a well-formed single <svg> document`);
  return match[1].trim();
}

/**
 * Recolors a glyph written with white (#FFFFFF) shapes - every hand-written glyph under
 * assets/icons/ uses white so it previews sensibly on its own, and so indigoSvg() below can use
 * it unmodified against the indigo key/plugin-icon background it composes onto.
 */
function withColor(glyphMarkup, color) {
  return glyphMarkup.replace(/#FFFFFF/gi, color);
}

/** A transparent-background icon document - used for the tiny action-list icon and the category
 *  icon. Stream Deck's own action-list panel is light, not dark, so this variant recolors to a
 *  near-black neutral (ICON_DARK) rather than leaving the glyph's own white - brand indigo was
 *  tried first but is too light a mid-tone to read clearly at this size against that panel. */
function transparentSvg(glyphMarkup) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${withColor(glyphMarkup, ICON_DARK)}</svg>`;
}

/** A solid brand-indigo-background icon document - used for key faces and the plugin icon,
 *  matching the flat indigo fill the placeholder key art already used. */
function indigoSvg(glyphMarkup) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
    `<rect width="100" height="100" fill="${BRAND_INDIGO}" />${glyphMarkup}</svg>`
  );
}

function renderPng(svg, size) {
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: size } });
  return resvg.render().asPng();
}

function writePng(path, svg, size) {
  writeFileSync(path, renderPng(svg, size));
  console.log(`wrote ${path} (${size}x${size})`);
}

for (const { glyph, dir } of ACTIONS) {
  const markup = glyphInnerMarkup(glyph);
  const actionDir = join(IMGS_DIR, "actions", dir);
  writePng(join(actionDir, "icon.png"), transparentSvg(markup), 20);
  writePng(join(actionDir, "icon@2x.png"), transparentSvg(markup), 40);
  writePng(join(actionDir, "key.png"), indigoSvg(markup), 72);
  writePng(join(actionDir, "key@2x.png"), indigoSvg(markup), 144);
}

// The plugin's own category icon (manifest.json's CategoryIcon) and app icon (manifest.json's
// Icon) get the same treatment rather than being left as placeholders now that this pipeline
// exists - a simple abstracted mark (the stopwatch glyph alone, no wordmark) rather than an
// arbitrary new design.
const stopwatch = glyphInnerMarkup("timer");
writePng(join(IMGS_DIR, "category-icon.png"), transparentSvg(stopwatch), 28);
writePng(join(IMGS_DIR, "category-icon@2x.png"), transparentSvg(stopwatch), 56);
writePng(join(IMGS_DIR, "plugin-icon.png"), indigoSvg(stopwatch), 256);
writePng(join(IMGS_DIR, "plugin-icon@2x.png"), indigoSvg(stopwatch), 512);
