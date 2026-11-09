import fc from "fast-check";
import { describe, it } from "vitest";
import {
  BUILT_IN_MODE_IDS,
  BUILT_IN_MODES,
  formatCountdown,
  nextMode,
  progress,
  remainingMs,
  stepMode,
  type TimerState,
} from "../src/timer.js";

const modeIds = fc.oneof(
  fc.constantFrom(...Object.keys(BUILT_IN_MODES).map(Number)),
  fc.integer({ min: 100, max: 1000 }),
);

const timerState = fc.record({
  isRunning: fc.boolean(),
  isBreak: fc.boolean(),
  timerModeId: modeIds,
  phaseEndsAt: fc.oneof(
    fc.constant(null),
    fc
      .date({ min: new Date("2000-01-01"), max: new Date("2100-01-01"), noInvalidDate: true })
      .map((d) => d.toISOString()),
    fc.string(),
  ),
}) satisfies fc.Arbitrary<TimerState>;

const instant = fc.integer({ min: 946_684_800_000, max: 4_102_444_800_000 });

describe("timer (property-based)", () => {
  it("remainingMs is never negative and never reported for a stopped timer", () => {
    fc.assert(
      fc.property(timerState, instant, (state, now) => {
        const remaining = remainingMs(state, now);
        if (!state.isRunning) return remaining === undefined;
        return remaining === undefined || (remaining >= 0 && Number.isFinite(remaining));
      }),
    );
  });

  it("progress is always within [0, 1] when it is reported", () => {
    fc.assert(
      fc.property(timerState, instant, (state, now) => {
        const p = progress(state, now);
        return p === undefined || (p >= 0 && p <= 1);
      }),
    );
  });

  it("formatCountdown renders m:ss with seconds below 60 and inverts to the floored second count", () => {
    fc.assert(
      fc.property(fc.integer({ min: -1_000_000, max: 10_000_000_000 }), (ms) => {
        const match = /^(\d+):(\d{2})$/.exec(formatCountdown(ms));
        if (!match) return false;
        const seconds = Number(match[2]);
        return seconds < 60 && Number(match[1]) * 60 + seconds === Math.floor(Math.max(0, ms) / 1000);
      }),
    );
  });

  it("stepMode always lands on a built-in mode, wraps by the cycle length, and is undone by the opposite step", () => {
    const current = fc.oneof(fc.constant(undefined), modeIds);
    fc.assert(
      fc.property(current, fc.integer({ min: -1000, max: 1000 }), (from, steps) => {
        const to = stepMode(from, steps);
        if (!BUILT_IN_MODE_IDS.includes(to)) return false;
        if (stepMode(from, steps + BUILT_IN_MODE_IDS.length) !== to) return false;
        // Only a mode already on the cycle can be stepped back to itself.
        return from === undefined || !BUILT_IN_MODE_IDS.includes(from) || stepMode(to, -steps) === from;
      }),
    );
  });

  it("nextMode visits every built-in mode exactly once per lap", () => {
    fc.assert(
      fc.property(fc.constantFrom(...BUILT_IN_MODE_IDS), (start) => {
        const seen = new Set<number>();
        let mode = start;
        for (let i = 0; i < BUILT_IN_MODE_IDS.length; i++) {
          seen.add(mode);
          mode = nextMode(mode);
        }
        return seen.size === BUILT_IN_MODE_IDS.length && mode === start;
      }),
    );
  });
});
