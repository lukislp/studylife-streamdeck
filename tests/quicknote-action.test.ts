import { describe, expect, it } from "vitest";
import { noteTitle } from "../src/noteTitle.js";

describe("noteTitle", () => {
  it("uses the first non-blank line as the title", () => {
    expect(noteTitle("Idea for the essay intro\nMore detail below.")).toBe("Idea for the essay intro");
  });

  it("skips leading blank lines", () => {
    expect(noteTitle("\n\nActual first line")).toBe("Actual first line");
  });

  it("falls back to a fixed label when the content is only whitespace", () => {
    expect(noteTitle("   \n  \n")).toBe("Quick Note");
    expect(noteTitle("")).toBe("Quick Note");
  });

  it("truncates a very long first line rather than exceeding NoteDto's practical title length", () => {
    const longLine = "x".repeat(120);
    const title = noteTitle(longLine);
    expect(title.length).toBe(80);
    expect(title.endsWith("…")).toBe(true);
  });
});
