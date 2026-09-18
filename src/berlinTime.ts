// Europe/Berlin wall-clock helpers. StudyLife's API sends and expects every DateTime as naive
// local time in the server's own timezone (Europe/Berlin) - no offset in the JSON, and NOT the
// timezone of whatever machine happens to run this plugin. Getting this wrong silently books
// sessions at the wrong hour (see the README, and studylife-raycast's courseGoals.ts, which uses
// the same Intl.DateTimeFormat technique for the same reason).
//
// The trick used throughout this file: since every StudyLife DateTime we read or write is
// naive-Berlin, arithmetic between them never needs a real UTC instant - only a value that is
// INTERNALLY consistent. Date.UTC(...) applied to the Berlin wall-clock's own numbers gives
// exactly that ("pretend UTC"): two naive-Berlin instants compare and subtract correctly no
// matter what timezone this process is actually running in, because both sides are built the
// same way. Never mix a "pretend UTC" value from this file with a real Date.now()/Date.parse()
// instant - the two are not interchangeable.

const BERLIN_TZ = "Europe/Berlin";

interface WallClockParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** The Europe/Berlin wall-clock reading of a real instant, regardless of the host machine's own
 *  timezone. */
function berlinWallClockParts(epochMs: number): WallClockParts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: BERLIN_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(epochMs));
  const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? "0");
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * The naive-local ISO-ish string StudyLife's API expects for a real instant (e.g. "now") -
 * Berlin wall-clock, no "Z", no offset. Use this for Sessions.Create's StartTime/EndTime; never
 * `new Date(ms).toISOString()`, which is UTC and silently books at the wrong hour outside UTC+0
 * (see studylife-vscode's extension.ts, which does exactly that - not ported here on purpose).
 */
export function berlinWallClockIso(epochMs: number): string {
  const p = berlinWallClockParts(epochMs);
  return `${String(p.year)}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`;
}

/**
 * Reads a naive-Berlin datetime string (as sent by StudyLife's API) into a "pretend UTC" instant
 * - see the file header. Not a real UTC instant; only ever compare it against other values built
 * the same way (this function's output, or berlinDayBoundsPretendUtc's).
 */
export function parseNaiveBerlin(value: string): number | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(value);
  if (!match) return undefined;
  const [, y, mo, d, h, mi, s] = match;
  const ms = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), s ? Number(s) : 0);
  return Number.isNaN(ms) ? undefined : ms;
}

/**
 * Midnight-to-midnight bounds of "today" in Europe/Berlin, as pretend-UTC instants comparable
 * with parseNaiveBerlin's output - see the file header for why pretend-UTC is safe here and never
 * safe to compare against a real epoch timestamp.
 */
export function berlinDayBoundsPretendUtc(now: number): { start: number; end: number } {
  const p = berlinWallClockParts(now);
  const start = Date.UTC(p.year, p.month - 1, p.day);
  return { start, end: start + 86_400_000 };
}
