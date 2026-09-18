import { describe, expect, it } from "vitest";
import { berlinDayBoundsPretendUtc, berlinWallClockIso, parseNaiveBerlin } from "../src/berlinTime.js";

describe("berlinWallClockIso", () => {
  it("renders a plain UTC instant as its Berlin wall-clock equivalent (CET, UTC+1)", () => {
    // 2026-01-15 is outside DST - Berlin is UTC+1.
    const instant = Date.parse("2026-01-15T09:00:00.000Z");
    expect(berlinWallClockIso(instant)).toBe("2026-01-15T10:00:00");
  });

  it("rolls over to the next Berlin calendar day before UTC midnight (CEST, UTC+2)", () => {
    // 2026-09-17T22:30:00Z is already 2026-09-18T00:30:00+02:00 in Berlin (September is CEST) -
    // the exact kind of near-midnight edge case a naive `new Date(ms).toISOString()` or a
    // machine-local-timezone read would get wrong.
    const instant = Date.parse("2026-09-17T22:30:00.000Z");
    expect(berlinWallClockIso(instant)).toBe("2026-09-18T00:30:00");
  });

  it("never emits a timezone offset or a trailing Z", () => {
    const iso = berlinWallClockIso(Date.parse("2026-09-17T22:30:00.000Z"));
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
  });
});

describe("parseNaiveBerlin", () => {
  it("round-trips with berlinWallClockIso for the same instant", () => {
    const instant = Date.parse("2026-09-17T22:30:00.000Z");
    const iso = berlinWallClockIso(instant);
    const parsed = parseNaiveBerlin(iso);
    // Not equal to the real instant (pretend-UTC, not real UTC - see the file header), but
    // internally consistent: re-formatting the parsed pretend-UTC value as a naive-Berlin string
    // gives back the exact same wall clock.
    expect(parsed).toBeDefined();
    const [y, mo, d, h, mi, s] = iso.split(/[-T:]/).map(Number);
    expect(new Date(parsed as number).toISOString()).toBe(
      `${String(y)}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}T${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}:${String(s).padStart(2, "0")}.000Z`,
    );
  });

  it("is undefined for an unparsable string", () => {
    expect(parseNaiveBerlin("not a date")).toBeUndefined();
    expect(parseNaiveBerlin("")).toBeUndefined();
  });

  it("accepts a datetime with no seconds", () => {
    expect(parseNaiveBerlin("2026-09-18T00:30")).toBeDefined();
  });
});

describe("berlinDayBoundsPretendUtc", () => {
  it("spans exactly 24 hours", () => {
    const { start, end } = berlinDayBoundsPretendUtc(Date.parse("2026-09-17T12:00:00.000Z"));
    expect(end - start).toBe(86_400_000);
  });

  it("puts the near-midnight CEST instant in the NEXT Berlin day, not the UTC one", () => {
    // Same instant as the rollover test above: UTC calendar day is the 17th, but the Berlin
    // wall-clock day is already the 18th.
    const instant = Date.parse("2026-09-17T22:30:00.000Z");
    const bounds = berlinDayBoundsPretendUtc(instant);
    const parsedStart = parseNaiveBerlin("2026-09-18T00:00:00");
    expect(bounds.start).toBe(parsedStart);
  });

  it("agrees with berlinWallClockIso/parseNaiveBerlin: 'now' always falls inside its own day bounds", () => {
    for (const iso of ["2026-01-15T09:00:00.000Z", "2026-09-17T22:30:00.000Z", "2026-06-01T00:00:00.000Z"]) {
      const instant = Date.parse(iso);
      const bounds = berlinDayBoundsPretendUtc(instant);
      const parsedNow = parseNaiveBerlin(berlinWallClockIso(instant)) as number;
      expect(parsedNow).toBeGreaterThanOrEqual(bounds.start);
      expect(parsedNow).toBeLessThan(bounds.end);
    }
  });
});
