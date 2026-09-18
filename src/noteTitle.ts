// A short title derived from a Quick Note's preset content - split out from quicknote-action.ts
// so it is testable without pulling in the Stream Deck SDK (that file's @action decorator is not
// something vitest's transform needs to touch just to check this one pure rule), the same
// separation render.ts/timer.ts/runLog.ts already keep from src/actions/*.ts.

/**
 * The preset content's first non-blank line, or a fixed fallback when there is none - the
 * "sensible Title" NoteDto needs (Title is [MaxLength(500)], so this is trimmed well under that).
 */
export function noteTitle(content: string): string {
  const firstLine = content
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (!firstLine) return "Quick Note";
  return firstLine.length > 80 ? `${firstLine.slice(0, 79)}…` : firstLine;
}
