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
  it("renders a valid, non-empty SVG document with a full-canvas background and no text", () => {
    const svg = countdownBadgeSvg({ daysLeft: 3 });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
    expect(svg).toContain("<rect");
    // The day count is left to the key's title text (courseGoalKeyTitle) - baking it in here too
    // used to collide with that title once both rendered white-on-indigo in the same spot.
    expect(svg).not.toContain("<text");
  });

  it("is the neutral brand indigo for a future goal", () => {
    const svg = countdownBadgeSvg({ daysLeft: 5 });
    expect(svg).toContain("#4F46E5");
    expect(svg).not.toContain("#DC2626");
  });

  it("switches to the warning color when the goal is due today", () => {
    const svg = countdownBadgeSvg({ daysLeft: 0 });
    expect(svg).toContain("#DC2626");
    expect(svg).not.toContain("#4F46E5");
  });

  it("switches to the warning color once overdue", () => {
    const svg = countdownBadgeSvg({ daysLeft: -4 });
    expect(svg).toContain("#DC2626");
    expect(svg).not.toContain("#4F46E5");
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
