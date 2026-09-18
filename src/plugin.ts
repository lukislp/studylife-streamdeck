// Plugin entry point: registers both actions and wires the Property Inspector's Connect/Disconnect
// buttons to the loopback OAuth flow. The PI itself is a sandboxed webview with no Node access, so
// the flow (binding a listener, opening the browser, redeeming the assertion) runs here and reports
// back over streamDeck.ui.sendToPropertyInspector - the same shape studylife-vscode's webview panel
// uses to talk to its extension host.
import streamDeck from "@elgato/streamdeck";
import type { UpcomingGoal } from "./api.js";
import { StudyLifeApi } from "./api.js";
import { DEFAULT_CLIENT_ID } from "./oauth.js";
import { LoginError, runLogin } from "./auth.js";
import { FocusTimerAction } from "./actions/timer-action.js";
import { StudyStatusAction } from "./actions/status-action.js";
import { CourseGoalAction } from "./actions/coursegoal-action.js";
import { QuickNoteAction } from "./actions/quicknote-action.js";
import { SwitchCourseAction } from "./actions/switchcourse-action.js";
import { getCachedMetrics } from "./metricsCache.js";
import { clearConnection, readSettings, storeConnection } from "./settings.js";

streamDeck.logger.setLevel("info");

streamDeck.actions.registerAction(new FocusTimerAction());
streamDeck.actions.registerAction(new StudyStatusAction());
streamDeck.actions.registerAction(new CourseGoalAction());
streamDeck.actions.registerAction(new QuickNoteAction());
streamDeck.actions.registerAction(new SwitchCourseAction());

// Both interfaces need an explicit index signature (and `| undefined` rather than a bare `?:` on
// every optional field) to structurally satisfy the SDK's JsonObject/JsonValue constraint under
// this project's `exactOptionalPropertyTypes` - see settings.ts's GlobalSettings for the same
// pattern.
interface PiMessage {
  event: "connect" | "disconnect" | "getStatus" | "getCourses";
  instanceUrl?: string | undefined;
  [key: string]: string | undefined;
}

interface PiStatus {
  event: "status";
  connected: boolean;
  instanceUrl: string | undefined;
  error: string | undefined;
  [key: string]: string | boolean | undefined;
}

/** Sent to the Property Inspector for the Focus Timer, Course Goal and Quick Note pages, which
 *  all offer the same "which course" dropdown - see ui/course-picker.js for the shared population
 *  logic on the other side of this message. */
interface PiCourses {
  event: "courses";
  goals: UpcomingGoal[];
  error: string | undefined;
  [key: string]: string | UpcomingGoal[] | undefined;
}

streamDeck.ui.onSendToPlugin<PiMessage>(async (ev) => {
  const message = ev.payload;
  if (message.event === "getStatus") {
    await sendStatus();
    return;
  }
  if (message.event === "getCourses") {
    await sendCourses();
    return;
  }
  if (message.event === "disconnect") {
    await clearConnection();
    await sendStatus();
    return;
  }
  if (message.event === "connect") {
    if (!message.instanceUrl) {
      await streamDeck.ui.sendToPropertyInspector({
        event: "status",
        connected: false,
        instanceUrl: undefined,
        error: "Enter an instance URL first.",
      } satisfies PiStatus);
      return;
    }
    try {
      const apiKey = await runLogin(message.instanceUrl, DEFAULT_CLIENT_ID);
      await storeConnection(message.instanceUrl, apiKey);
      await sendStatus();
    } catch (error) {
      const text = error instanceof LoginError ? error.message : "Connecting failed - see the plugin log.";
      streamDeck.logger.error("Property inspector connect failed", error);
      await streamDeck.ui.sendToPropertyInspector({
        event: "status",
        connected: false,
        instanceUrl: undefined,
        error: text,
      } satisfies PiStatus);
    }
  }
});

async function sendStatus(): Promise<void> {
  const settings = await readSettings();
  await streamDeck.ui.sendToPropertyInspector({
    event: "status",
    connected: Boolean(settings.apiKey),
    instanceUrl: settings.instanceUrl,
    error: undefined,
  } satisfies PiStatus);
}

async function sendCourses(): Promise<void> {
  const settings = await readSettings();
  if (!settings.instanceUrl || !settings.apiKey) {
    await streamDeck.ui.sendToPropertyInspector({
      event: "courses",
      goals: [],
      error: "Connect first.",
    } satisfies PiCourses);
    return;
  }
  const api = new StudyLifeApi(settings.instanceUrl, settings.apiKey);
  try {
    const metrics = await getCachedMetrics(api, Date.now());
    await streamDeck.ui.sendToPropertyInspector({
      event: "courses",
      goals: metrics.upcomingCourseGoals ?? [],
      error: undefined,
    } satisfies PiCourses);
  } catch (error) {
    streamDeck.logger.error("Property inspector getCourses failed", error);
    await streamDeck.ui.sendToPropertyInspector({
      event: "courses",
      goals: [],
      error: "Could not load courses - see the plugin log.",
    } satisfies PiCourses);
  }
}

// Not top-level `await`: the bundle is CommonJS (see build.mjs) so Stream Deck's `node bin/plugin.js`
// can run it directly without an ESM package.json in the plugin folder.
void streamDeck.connect();
