import { describe, expect, it } from "vitest";
import { svgToDataUri } from "../src/svgImage.js";

describe("svgToDataUri", () => {
  it("wraps the SVG as a base64 data URI with the SVG mime type declared", () => {
    const svg = "<svg xmlns=\"http://www.w3.org/2000/svg\"><circle r=\"1\" /></svg>";
    const uri = svgToDataUri(svg);
    expect(uri.startsWith("data:image/svg+xml;base64,")).toBe(true);
  });

  it("round-trips back to the exact original markup", () => {
    const svg = "<svg><text>hello</text></svg>";
    const uri = svgToDataUri(svg);
    const decoded = Buffer.from(uri.split(",")[1] ?? "", "base64").toString("utf8");
    expect(decoded).toBe(svg);
  });
});
