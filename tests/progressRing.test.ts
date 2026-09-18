import { describe, expect, it } from "vitest";
import { progressRingSvg, progressRingDataUri, ringVisualFor, type RingVisual } from "../src/progressRing.js";

describe("ringVisualFor", () => {
  it("is idle whenever the phase is stopped, regardless of what fraction was passed", () => {
    expect(ringVisualFor("stopped", undefined, 0)).toEqual({ kind: "idle" });
    // Even a stray leftover fraction from a previous run must never leak into the idle visual -
    // stopped always wins.
    expect(ringVisualFor("stopped", 0.5, 0)).toEqual({ kind: "idle" });
  });

  it("is indeterminate when running with an unknown fraction (a custom timer mode)", () => {
    expect(ringVisualFor("focus", undefined, 1_000)).toEqual({ kind: "indeterminate", now: 1_000 });
    expect(ringVisualFor("break", undefined, 1_000)).toEqual({ kind: "indeterminate", now: 1_000 });
  });

  it("is a progress visual carrying the given fraction when running with a known one", () => {
    expect(ringVisualFor("focus", 0.42, 0)).toEqual({ kind: "progress", fraction: 0.42 });
  });

  it("clamps an out-of-range fraction rather than drawing an invalid arc", () => {
    expect(ringVisualFor("focus", 1.5, 0)).toEqual({ kind: "progress", fraction: 1 });
    expect(ringVisualFor("focus", -0.5, 0)).toEqual({ kind: "progress", fraction: 0 });
  });
});

describe("progressRingSvg", () => {
  it("renders a valid, non-empty SVG document for every visual kind", () => {
    const visuals: RingVisual[] = [
      { kind: "idle" },
      { kind: "progress", fraction: 0.3 },
      { kind: "indeterminate", now: 5_000 },
    ];
    for (const visual of visuals) {
      const svg = progressRingSvg(visual);
      expect(svg.startsWith("<svg")).toBe(true);
      expect(svg.endsWith("</svg>")).toBe(true);
      expect(svg).toContain("<circle");
    }
  });

  it("draws the idle ring as a single track circle with no accent arc", () => {
    const svg = progressRingSvg({ kind: "idle" });
    expect(svg).not.toContain("#4F46E5");
    expect((svg.match(/<circle/g) ?? []).length).toBe(1);
  });

  it("draws a progress ring with both a track and an accent arc colored in the brand indigo", () => {
    const svg = progressRingSvg({ kind: "progress", fraction: 0.5 });
    expect(svg).toContain("#4F46E5");
    expect((svg.match(/<circle/g) ?? []).length).toBe(2);
  });

  it("scales the accent arc's dash length with the fraction", () => {
    const quarter = progressRingSvg({ kind: "progress", fraction: 0.25 });
    const full = progressRingSvg({ kind: "progress", fraction: 1 });
    const dashOf = (svg: string) => Number(/stroke-dasharray="([\d.]+) /.exec(svg)?.[1]);
    expect(dashOf(full)).toBeGreaterThan(dashOf(quarter));
    expect(dashOf(quarter)).toBeGreaterThan(0);
  });

  it("draws the indeterminate visual as a short accent arc, never the full circle", () => {
    const svg = progressRingSvg({ kind: "indeterminate", now: 0 });
    const dash = Number(/stroke-dasharray="([\d.]+) ([\d.]+)"/.exec(svg)?.[1]);
    const gap = Number(/stroke-dasharray="([\d.]+) ([\d.]+)"/.exec(svg)?.[2]);
    // A short segment, not close to a full progress ring - it must never be mistaken for a real
    // high percentage.
    expect(dash).toBeLessThan(gap);
  });

  it("rotates the indeterminate arc over time so consecutive polls visibly differ", () => {
    const early = progressRingSvg({ kind: "indeterminate", now: 0 });
    const later = progressRingSvg({ kind: "indeterminate", now: 5_000 });
    expect(early).not.toBe(later);
  });

  it("repeats the indeterminate rotation on a fixed period rather than growing unbounded", () => {
    const start = progressRingSvg({ kind: "indeterminate", now: 0 });
    const oneCycleLater = progressRingSvg({ kind: "indeterminate", now: 20_000 });
    expect(start).toBe(oneCycleLater);
  });
});

describe("progressRingDataUri", () => {
  it("produces a base64 SVG data URI that decodes back to the same markup", () => {
    const visual: RingVisual = { kind: "progress", fraction: 0.75 };
    const uri = progressRingDataUri(visual);
    expect(uri.startsWith("data:image/svg+xml;base64,")).toBe(true);
    const decoded = Buffer.from(uri.split(",")[1] ?? "", "base64").toString("utf8");
    expect(decoded).toBe(progressRingSvg(visual));
  });
});
