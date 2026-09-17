// Typed client for exactly the five endpoints this plugin is scoped for. Every method maps to one
// entry the client requests at registration; adding a call here means adding the scope there (and
// having it be publicly grantable server-side), never the other way round. Modeled on
// studylife-vscode's api.ts, trimmed to this plugin's narrower scope list (no Sessions.*, no
// Notes.*, no Webhooks.*).
import { trimBase } from "./oauth.js";
export type { TimerState } from "./timer.js";
import type { TimerState } from "./timer.js";

export interface Course {
  id: number;
  name: string;
  color?: string;
  icon?: string;
  semester?: number;
}

/** Mirrors CourseGoalDto (src/StudyLife.Shared/Dtos.cs) - only the fields this plugin reads. */
export interface CourseGoal {
  courseId: number;
  courseName: string;
  targetDate?: string | null;
  completedAt?: string | null;
  [key: string]: unknown;
}

export interface UpcomingGoal {
  courseId: number;
  courseName: string;
  targetDate: string;
  daysLeft: number;
}

export interface MetricsSummary {
  streak?: { current?: number };
  /** The API has no "today" figure - only week, month and total (MetricsHoursDto). */
  hours?: { week?: number; month?: number; total?: number };
  upcomingCourseGoals?: UpcomingGoal[];
  [key: string]: unknown;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class StudyLifeApi {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await this.fetchImpl(`${trimBase(this.baseUrl)}${path}`, {
      ...init,
      headers: {
        "X-Api-Key": this.apiKey,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (!response.ok) {
      // 403 is the one worth naming: it means the key authenticated but the endpoint is outside
      // the scopes this installation was granted, which no amount of retrying fixes.
      const hint =
        response.status === 403
          ? " - this installation was not granted that permission; reconnect and approve it"
          : "";
      throw new ApiError(`${init?.method ?? "GET"} ${path} failed (${response.status})${hint}`, response.status);
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  getTimerState(): Promise<TimerState> {
    return this.request<TimerState>("/api/timerstate");
  }

  /**
   * Writes the timer. The server is last-write-wins and answers 200 with the authoritative row
   * rather than 409 (see TimerStateService.SaveAsync), so the returned state - not the one we
   * sent - is what must be rendered afterwards.
   */
  saveTimerState(state: TimerState): Promise<TimerState> {
    return this.request<TimerState>("/api/timerstate", {
      method: "PUT",
      body: JSON.stringify(state),
    });
  }

  getCourses(): Promise<Course[]> {
    return this.request<Course[]>("/api/courses");
  }

  getCourseGoals(): Promise<CourseGoal[]> {
    return this.request<CourseGoal[]>("/api/coursegoals");
  }

  getMetricsSummary(): Promise<MetricsSummary> {
    return this.request<MetricsSummary>("/api/metrics/summary");
  }
}

/** Count of course goals not yet completed - used for the Study Status key's third line. Split
 *  out so the filter rule is unit-testable without a server. */
export function openGoalCount(goals: CourseGoal[]): number {
  return goals.filter((g) => !g.completedAt).length;
}
