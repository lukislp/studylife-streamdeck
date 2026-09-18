import { describe, expect, it, vi } from "vitest";
import { ApiError, StudyLifeApi, openGoalCount } from "../src/api.js";

describe("openGoalCount", () => {
  it("counts the (already-open) upcoming course goals from Metrics.GetSummary", () => {
    expect(
      openGoalCount([
        { courseId: 1, courseName: "A", targetDate: "2026-10-01T00:00:00", daysLeft: 5 },
        { courseId: 2, courseName: "B", targetDate: "2026-10-05T00:00:00", daysLeft: 9 },
      ]),
    ).toBe(2);
  });

  it("is zero for an empty list or an absent one", () => {
    expect(openGoalCount([])).toBe(0);
    expect(openGoalCount(undefined)).toBe(0);
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

  it("marks a created session completed regardless of what the caller passed", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 1 }), { status: 200 }));
    const api = new StudyLifeApi("https://studylife.example.com", "k", fetchImpl as unknown as typeof fetch);
    await api.createSession({
      courseId: 1,
      courseName: "Maths",
      startTime: "2026-09-18T10:00:00",
      endTime: "2026-09-18T10:30:00",
    });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://studylife.example.com/api/sessions");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toMatchObject({ courseId: 1, isCompleted: true });
  });

  it("posts a note to /api/notes", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 1 }), { status: 200 }));
    const api = new StudyLifeApi("https://studylife.example.com", "k", fetchImpl as unknown as typeof fetch);
    await api.createNote({ title: "Hi", content: "Body" });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://studylife.example.com/api/notes");
    expect(JSON.parse(init.body as string)).toEqual({ title: "Hi", content: "Body" });
  });
});
