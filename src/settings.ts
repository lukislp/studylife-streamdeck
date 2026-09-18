// The plugin-wide config every action shares: the instance URL, the connected API key, and the
// "current course" Switch Course cycles - Focus Timer and Quick Note instances with no per-key
// course of their own fall back to it (see switchcourse-action.ts, timer-action.ts and
// quicknote-action.ts). Stored with the Stream Deck SDK's own global-settings mechanism
// (streamDeck.settings.*), which is the idiomatic place for cross-action plugin config in this
// SDK - analogous to studylife-vscode's context.secrets, except there is only one storage tier
// available here, so everything plugin-wide lives in it. There is no separate "secret storage"
// tier in the Stream Deck SDK.
import streamDeck from "@elgato/streamdeck";

export interface GlobalSettings {
  instanceUrl?: string | undefined;
  apiKey?: string | undefined;
  currentCourseId?: number | undefined;
  currentCourseName?: string | undefined;
  [key: string]: string | number | undefined;
}

export async function readSettings(): Promise<GlobalSettings> {
  return streamDeck.settings.getGlobalSettings<GlobalSettings>();
}

export async function storeConnection(instanceUrl: string, apiKey: string): Promise<void> {
  const current = await readSettings();
  await streamDeck.settings.setGlobalSettings<GlobalSettings>({ ...current, instanceUrl, apiKey });
}

export async function clearConnection(): Promise<void> {
  const current = await readSettings();
  await streamDeck.settings.setGlobalSettings<GlobalSettings>({ ...current, apiKey: undefined });
}

/** Sets (or clears, when `course` is undefined) the plugin-wide "current course" Switch Course
 *  just cycled to. Split from storeConnection/clearConnection because it is written far more
 *  often, from a different action, and should never disturb the connection fields. */
export async function setCurrentCourse(course: { courseId: number; courseName: string } | undefined): Promise<void> {
  const current = await readSettings();
  await streamDeck.settings.setGlobalSettings<GlobalSettings>({
    ...current,
    currentCourseId: course?.courseId,
    currentCourseName: course?.courseName,
  });
}
