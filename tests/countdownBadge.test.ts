import { describe, expect, it } from "vitest";
import { countdownBadgeDataUri, countdownBadgeSvg, isUrgent } from "../src/countdownBadge.js";

describe("isUrgent", () => {
  it("treats today and every overdue day as urgent", () => {
    expect(isUrgent(0)).toBe(true);
    expect(isUrgent(-1)).toBe(true);
    expect(isUrgent(-30)).toBe(true);
  });

  it("treats every future day as not urgent", () => {
    expect(isUrgent(1)).toBe(false);
    expect(isUrgent(30)).toBe(false);
  });
});

describe("countdownBadgeSvg", () => {
  it("renders a valid, non-empty SVG document", () => {
    const svg = countdownBadgeSvg({ daysLeft: 3 });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
    expect(svg).toContain("<circle");
    expect(svg).toContain("<text");
  });

  it("shows the plain day count for a future goal, colored in the neutral brand indigo", () => {
    const svg = countdownBadgeSvg({ daysLeft: 5 });
    expect(svg).toContain(">5<");
    expect(svg).toContain("#4F46E5");
    expect(svg).not.toContain("#DC2626");
  });

  it("switches to the warning color, still showing 0, when the goal is due today", () => {
    const svg = countdownBadgeSvg({ daysLeft: 0 });
    expect(svg).toContain(">0<");
    expect(svg).toContain("#DC2626");
    expect(svg).not.toContain("#4F46E5");
  });

  it("switches to the warning color and shows the unsigned overdue count", () => {
    const svg = countdownBadgeSvg({ daysLeft: -4 });
    // The sign only ever changes the color, never the number shown - matches render.ts's
    // formatDue, which also reports the overdue magnitude via Math.abs.
    expect(svg).toContain(">4<");
    expect(svg).not.toContain(">-4<");
    expect(svg).toContain("#DC2626");
  });

  it("never invents a completion percentage - only ever the day count appears", () => {
    const svg = countdownBadgeSvg({ daysLeft: 7 });
    expect(svg).not.toMatch(/%/);
  });

  it("caps an absurdly large day count instead of overflowing the badge", () => {
    const svg = countdownBadgeSvg({ daysLeft: 5000 });
    expect(svg).toContain(">999+<");
  });
});

describe("countdownBadgeDataUri", () => {
  it("produces a base64 SVG data URI that decodes back to the same markup", () => {
    const input = { daysLeft: 2 };
    const uri = countdownBadgeDataUri(input);
    expect(uri.startsWith("data:image/svg+xml;base64,")).toBe(true);
    const decoded = Buffer.from(uri.split(",")[1] ?? "", "base64").toString("utf8");
    expect(decoded).toBe(countdownBadgeSvg(input));
  });
});
