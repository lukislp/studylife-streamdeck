// The plugin-wide config both actions share: the instance URL and the connected API key. Stored
// with the Stream Deck SDK's own global-settings mechanism (streamDeck.settings.*), which is the
// idiomatic place for cross-action plugin config in this SDK - analogous to studylife-vscode's
// context.secrets, except there is only one storage tier available here, so both the URL and the
// key live in it. There is no separate "secret storage" tier in the Stream Deck SDK.
import streamDeck from "@elgato/streamdeck";

export interface GlobalSettings {
  instanceUrl?: string | undefined;
  apiKey?: string | undefined;
  [key: string]: string | undefined;
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
