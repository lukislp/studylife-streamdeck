// Typed client for exactly the endpoints this plugin is scoped for. Every method maps to one
// entry the client requests at registration; adding a call here means adding the scope there (and
// having it be publicly grantable server-side), never the other way round. Modeled on
// studylife-vscode's api.ts.
//
// v2 drops Courses.GetAll and CourseGoals.GetAll: "which courses to offer" now comes entirely
// from Metrics.GetSummary's upcomingCourseGoals, the same server-computed "courses I am currently
// working towards" list studylife-vscode's panelModel.ts already uses - see that file's
// activeGoals() doc comment for why the full course catalogue and the raw course-goals endpoint
// are not needed here. It adds Sessions.Create, Sessions.GetHistory and Notes.Create for the run
// -> session booking (see runLog.ts) and the Quick Note action.
import { trimBase } from "./oauth.js";
export type { TimerState } from "./timer.js";
import type { TimerState } from "./timer.js";

export interface UpcomingGoal {
  courseId: number;
  courseName: string;
  targetDate: string;
  daysLeft: number;
  [key: string]: string | number;
}

export interface MetricsSummary {
  streak?: { current?: number };
  /** The API has no "today" figure - only week, month and total (MetricsHoursDto). Today is
   *  summed from Sessions.GetHistory instead - see history.ts. */
  hours?: { week?: number; month?: number; total?: number };
  /** Open goals with a target date, soonest first, capped at 5 server-side
   *  (StudyMetrics.CalcUpcomingCourseGoals) - the same cap studylife-vscode's course picker lives
   *  with, in exchange for not needing a separate CourseGoals.GetAll scope/call. */
  upcomingCourseGoals?: UpcomingGoal[];
  [key: string]: unknown;
}

/** Only the fields this plugin reads off a StudySessionDto - see history.ts's sumTodayHours. */
export interface SessionRecord {
  startTime?: string;
  endTime?: string;
  [key: string]: unknown;
}

/**
 * What this plugin sends to create a session. CourseName is required non-empty by the server's
 * Validate() for backward compatibility, but its content is ignored: SessionService.CreateAsync
 * re-resolves CourseName/CourseColor from CourseId server-side. StartTime/EndTime must be
 * Europe/Berlin wall-clock strings - see berlinTime.ts.
 */
export interface NewSession {
  courseId: number;
  courseName: string;
  startTime: string;
  endTime: string;
  topic?: string;
  timerModeId?: number;
}

/** What this plugin sends to create a note. Title/Content are the only fields the server actually
 *  persists from a client write here; Tags/Summary/RelatedNoteIds are enrichment-only and
 *  read-only from the client's point of view (see NotesController). */
export interface NewNote {
  title: string;
  content: string;
  courseId?: number;
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

  getMetricsSummary(): Promise<MetricsSummary> {
    return this.request<MetricsSummary>("/api/metrics/summary");
  }

  /**
   * A short recent window, completed sessions only, for summing today's hours - see
   * history.ts's sumTodayHours. Two days rather than one: the window is server-side and
   * day-aligned, so this covers "today" regardless of what time zone the query itself was issued
   * in; the Europe/Berlin day-boundary filtering happens client-side afterwards.
   */
  getTodayHistory(): Promise<SessionRecord[]> {
    return this.request<SessionRecord[]>("/api/sessions/history?days=2&onlyCompleted=true");
  }

  /** Always marks the session completed: by the time this plugin books one, the run it describes
   *  has already finished. */
  createSession(session: NewSession): Promise<unknown> {
    return this.request("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ ...session, isCompleted: true }),
    });
  }

  createNote(note: NewNote): Promise<unknown> {
    return this.request("/api/notes", {
      method: "POST",
      body: JSON.stringify(note),
    });
  }
}

/** Count of open course goals - used for the Study Status key's fallback third line when there is
 *  no streak yet. upcomingCourseGoals is already filtered to open goals server-side (see
 *  MetricsSummary's doc comment), so this is just its length; split out so the call sites read
 *  the same either way and the fallback stays unit-testable without a server. */
export function openGoalCount(goals: UpcomingGoal[] | undefined): number {
  return goals?.length ?? 0;
}
