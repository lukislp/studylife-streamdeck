// Quick Note key: a press calls Notes.Create with a fixed Content chosen once in the Property
// Inspector, optionally tagged with a course. Stream Deck hardware has no keyboard, so this is
// deliberately a preset/macro note - not free text typed per press - see README.md's "Quick Note"
// section for that limitation spelled out for users.
import streamDeck, { action, KeyUpEvent, SingletonAction } from "@elgato/streamdeck";
import { type NewNote, StudyLifeApi } from "../api.js";
import { noteTitle } from "../noteTitle.js";
import { readSettings } from "../settings.js";

export interface QuickNoteSettings {
  /** The preset note text, written once at configure time. */
  content?: string | undefined;
  /** Optional course to tag the note with, picked from metrics.upcomingCourseGoals. */
  courseId?: number | undefined;
  [key: string]: string | number | undefined;
}

@action({ UUID: "com.lukislp.studylife.quicknote" })
export class QuickNoteAction extends SingletonAction<QuickNoteSettings> {
  override async onKeyUp(ev: KeyUpEvent<QuickNoteSettings>): Promise<void> {
    const global = await readSettings();
    if (!global.instanceUrl || !global.apiKey) {
      await ev.action.showAlert();
      return;
    }
    const content = ev.payload.settings.content?.trim();
    if (!content) {
      streamDeck.logger.warn("Quick Note: pressed with no preset text configured");
      await ev.action.showAlert();
      return;
    }
    const api = new StudyLifeApi(global.instanceUrl, global.apiKey);
    const courseId = ev.payload.settings.courseId;
    const note: NewNote = {
      title: noteTitle(content),
      content,
      ...(courseId === undefined ? {} : { courseId }),
    };
    try {
      await api.createNote(note);
      if (ev.action.isKey()) await ev.action.showOk();
    } catch (error) {
      streamDeck.logger.error("Quick Note: create failed", error);
      await ev.action.showAlert();
    }
  }
}
