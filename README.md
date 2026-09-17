# StudyLife for Stream Deck

[![CI](https://github.com/lukislp/studylife-streamdeck/actions/workflows/ci.yml/badge.svg)](https://github.com/lukislp/studylife-streamdeck/actions/workflows/ci.yml) [![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/lukislp/studylife-streamdeck/badge)](https://scorecard.dev/viewer/?uri=github.com/lukislp/studylife-streamdeck) [![CodeQL](https://github.com/lukislp/studylife-streamdeck/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/lukislp/studylife-streamdeck/security/code-scanning)
[![Release](https://img.shields.io/github/v/release/lukislp/studylife-streamdeck)](https://github.com/lukislp/studylife-streamdeck/releases)
[![License: AGPL-3.0](https://img.shields.io/github/license/lukislp/studylife-streamdeck)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6)](https://www.typescriptlang.org/)

Control your [StudyLife](https://github.com/lukislp/studylife) focus timer and see your study
status from physical Elgato Stream Deck keys - the same shared timer as the web app, the tray app,
[studylife-vscode](https://github.com/lukislp/studylife-vscode) and Home Assistant.

## What it does

**Focus Timer key** - a single key that cycles through the timer: tap to start, tap again to
pause, tap again to resume; hold the key to stop. The key's title updates live with the phase and
a countdown while it is visible on a device, by polling `TimerState.Get` every 5 seconds.

**Study Status key** - shows this week's study hours and your current streak, refreshed once a
minute; pressing it refreshes immediately. Every number comes from StudyLife's own metrics
endpoint, the single place those are calculated, so this key can never quietly disagree with the
web app.

Both actions share one Property Inspector for the plugin's settings: an instance URL field and
Connect/Disconnect buttons.

## Requirements

- A self-hosted StudyLife instance you can reach from this machine
- Stream Deck software 6.4 or newer
- The client registered once on your instance (see below)

## Setup

### 1. Register the client on your instance

This plugin authenticates as a dynamically registered OAuth client, so it has to be registered
once per instance through [studylife-developers](https://github.com/lukislp/studylife-developers):

| Field | Value |
| --- | --- |
| Client ID | `studylife-streamdeck` |
| Redirect URIs | `http://127.0.0.1:8785/callback`, `http://127.0.0.1:8786/callback`, `http://127.0.0.1:8787/callback`, `http://127.0.0.1:8788/callback` |
| Scopes | `TimerState.Get`, `TimerState.Save`, `CourseGoals.GetAll`, `Courses.GetAll`, `Metrics.GetSummary` |

All four redirect URIs are needed because the login flow validates `redirect_uri` by **exact**
match, and the plugin binds whichever of those four loopback ports is free. They deliberately
differ from `studylife-vscode`'s 8775-8778 and `studylife-cli`'s 8765-8768 so all three can be
logged in at the same time.

### 2. Install the plugin

Download the latest `.streamDeckPlugin` from the [Releases](https://github.com/lukislp/studylife-streamdeck/releases)
page and double-click it; Stream Deck installs it and offers both actions in the action list under
the "StudyLife" category.

### 3. Connect

Add either action to a key, open its Property Inspector, enter your instance URL and press
**Connect**. You are sent to your browser to approve the connection; the approval comes back
through a one-time assertion which is redeemed for this installation's own API key. The key is
stored with the Stream Deck SDK's own global-settings mechanism, shared by both actions and never
sent anywhere but your instance.

## Privacy

The plugin talks to your instance and nowhere else. No telemetry, no third-party services. What
leaves your machine is: the poll for timer state and metrics, and timer transitions you trigger by
pressing a key.

## Development

```bash
npm install
npm run typecheck
npm test
npm run build      # bundle src/plugin.ts into com.lukislp.studylife.sdPlugin/bin/plugin.js
npm run package     # produce the .streamDeckPlugin
```

The modules without a Stream Deck connection (`oauth.ts`, `timer.ts`, `render.ts`, the pure
helpers in `api.ts`) hold the rules that are easy to get subtly wrong, and those are what the
tests cover - PKCE shape, constant-time state comparison, callback parsing, the timer transitions,
and the key-title rendering rules. `auth.ts`, `settings.ts` and `src/actions/*.ts` keep the
SDK-facing half separate precisely so the rest can be tested without a device.

`timer.ts` is worth reading before changing anything about the timer. The wire shape has no
"paused" flag, and the server accepts unknown JSON properties silently - so a wrong field name
produces a green build and a key that does nothing.

## Licence

AGPL-3.0-or-later - see [LICENSE](LICENSE).
