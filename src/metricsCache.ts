// Short-lived, plugin-wide cache for Metrics.GetSummary. Several actions (Study Status, Course
// Goal, Switch Course, and Focus Timer's idle-hours line) all want the same response on their own
// independent poll cadences; without this, having more than one of them visible at once turns
// into that many times the request rate for no new information between them.
//
// Deliberately a module-level singleton, not per-action-instance state: there is exactly one
// StudyLife connection per plugin process (see settings.ts), so one cache entry is correct
// regardless of how many keys are reading it.
import type { MetricsSummary, StudyLifeApi } from "./api.js";

const TTL_MS = 60_000;

let cached: { value: MetricsSummary; expiresAt: number } | undefined;

/**
 * Returns the cached summary when it is still fresh, otherwise fetches a new one. On a fetch
 * failure with no cached value yet, this rethrows - callers that treat the summary as decorative
 * (e.g. Focus Timer's idle-hours line) should catch that themselves rather than have every caller
 * silently swallow a real connectivity problem.
 */
export async function getCachedMetrics(api: StudyLifeApi, now: number): Promise<MetricsSummary> {
  if (cached && cached.expiresAt > now) return cached.value;
  try {
    const value = await api.getMetricsSummary();
    cached = { value, expiresAt: now + TTL_MS };
    return value;
  } catch (error) {
    // Serve the last known value rather than nothing, if there is one - a transient failure
    // should not blank out every action reading this cache at once.
    if (cached) return cached.value;
    throw error;
  }
}

/** Test-only reset so cases don't leak state into each other via the module-level cache. */
export function resetMetricsCacheForTests(): void {
  cached = undefined;
}
