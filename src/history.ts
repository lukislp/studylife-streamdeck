// Today's studied hours, summed from Sessions.GetHistory - the metrics API carries no daily
// figure (MetricsHoursDto has week, month and total only), same as studylife-vscode's
// getTodayHours/sumHoursOn. Split out so the date arithmetic is testable without a server.
//
// Unlike studylife-vscode's sumHoursOn, the day boundary here is computed in Europe/Berlin, not
// the host machine's own local day - see berlinTime.ts's file header for why that distinction
// matters for anyone not running this plugin in Germany.
import type { SessionRecord } from "./api.js";
import { berlinDayBoundsPretendUtc, parseNaiveBerlin } from "./berlinTime.js";

export function sumTodayHours(sessions: SessionRecord[] | undefined, now: number): number {
  const { start, end } = berlinDayBoundsPretendUtc(now);
  let ms = 0;
  for (const s of sessions ?? []) {
    if (!s?.startTime || !s?.endTime) continue;
    const from = parseNaiveBerlin(s.startTime);
    const to = parseNaiveBerlin(s.endTime);
    if (from === undefined || to === undefined || to <= from) continue;
    // Clipped to the day, so a session spanning midnight counts only its part of today.
    const overlap = Math.min(to, end) - Math.max(from, start);
    if (overlap > 0) ms += overlap;
  }
  return ms / 3_600_000;
}
