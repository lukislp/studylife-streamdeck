import { describe, expect, it, vi } from "vitest";
import { ApiError, StudyLifeApi, openGoalCount } from "../src/api.js";

describe("openGoalCount", () => {
  it("counts goals without a completedAt", () => {
    expect(
      openGoalCount([
        { courseId: 1, courseName: "A", completedAt: null },
        { courseId: 2, courseName: "B", completedAt: "2026-01-01T00:00:00Z" },
        { courseId: 3, courseName: "C" },
      ]),
    ).toBe(2);
  });

  it("is zero for an empty list", () => {
    expect(openGoalCount([])).toBe(0);
  });
});

describe("StudyLifeApi", () => {
  it("sends the API key and JSON content type on every request", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ isRunning: false }), { status: 200 }));
    const api = new StudyLifeApi("https://studylife.example.com/", "the-key", fetchImpl as unknown as typeof fetch);
    await api.getTimerState();
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://studylife.example.com/api/timerstate",
      expect.objectContaining({
        headers: expect.objectContaining({ "X-Api-Key": "the-key", "Content-Type": "application/json" }),
      }),
    );
  });

  it("throws ApiError with the status code on a non-2xx response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("nope", { status: 403 }));
    const api = new StudyLifeApi("https://studylife.example.com", "k", fetchImpl as unknown as typeof fetch);
    await expect(api.getMetricsSummary()).rejects.toBeInstanceOf(ApiError);
    await expect(api.getMetricsSummary()).rejects.toMatchObject({ status: 403 });
  });

  it("returns the authoritative state saveTimerState responds with, not the one sent", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ isRunning: true, sessionId: 99 }), { status: 200 }));
    const api = new StudyLifeApi("https://studylife.example.com", "k", fetchImpl as unknown as typeof fetch);
    const result = await api.saveTimerState({ isRunning: false });
    expect(result).toEqual({ isRunning: true, sessionId: 99 });
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("PUT");
  });
});
