# StudyLife for Stream Deck

[![CI](https://github.com/lukislp/studylife-streamdeck/actions/workflows/ci.yml/badge.svg)](https://github.com/lukislp/studylife-streamdeck/actions/workflows/ci.yml) [![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/lukislp/studylife-streamdeck/badge)](https://scorecard.dev/viewer/?uri=github.com/lukislp/studylife-streamdeck) [![CodeQL](https://github.com/lukislp/studylife-streamdeck/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/lukislp/studylife-streamdeck/security/code-scanning)
[![Release](https://img.shields.io/github/v/release/lukislp/studylife-streamdeck)](https://github.com/lukislp/studylife-streamdeck/releases)
[![License: AGPL-3.0](https://img.shields.io/github/license/lukislp/studylife-streamdeck)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6)](https://www.typescriptlang.org/)

Control your [StudyLife](https://github.com/lukislp/studylife) focus timer, see your study status,
track course-goal countdowns and drop preset notes from physical Elgato Stream Deck keys - the
same shared timer as the web app, the tray app,
[studylife-vscode](https://github.com/lukislp/studylife-vscode) and Home Assistant.

## What it does

**Focus Timer key** - a single key that cycles through the timer: tap to start, tap again to
pause, tap again to resume; hold the key to stop. The key's title updates live with the phase and
a countdown while it is visible on a device, by polling `TimerState.Get` every 5 seconds; when
idle it shows this week's hours instead of sitting blank. Optionally bind this specific key
instance to one course in its Property Inspector; when unset it falls back to whatever the
**Switch Course** key currently has selected, and when that is unset too the timer still
starts/stops normally, it just does not book a session.

When a run this plugin started (not one already attached to a planned session) is stopped and
lasted at least 10 seconds, it is automatically logged as a study session via `Sessions.Create` -
see "Session booking" below.

**Study Status key** - shows this week's and today's study hours plus your current streak,
refreshed once a minute; pressing it refreshes immediately. Every number comes from StudyLife's
own metrics/history endpoints, the single place those are calculated, so this key can never
quietly disagree with the web app.

**Course Goal key** - a per-key countdown to one specific open course goal, picked once in its
Property Inspector from your currently open goals. Pin several of these to different physical
keys to see several course deadlines side by side.

**Quick Note key** - a press saves a *preset* note (written once in the Property Inspector, not
typed per press - Stream Deck hardware has no keyboard) via `Notes.Create`, optionally tagged with
a course. Shows a green checkmark on success, a warning triangle on failure.

**Switch Course key** - cycles through your open course goals as the plugin-wide "current
course", the fallback source for any Focus Timer or Quick Note key with no course of its own
bound. Its title shows the course it just switched to, or "No course" once cycled past the end.

All five actions share one Property Inspector for the plugin's settings: an instance URL field and
Connect/Disconnect buttons, plus a course dropdown (Focus Timer, Course Goal, Quick Note) and a
preset-text field (Quick Note) shown depending on which action the key is running.

### Session booking

StudyLife's timer carries neither a course nor a start time - starting it from a Stream Deck key
with nothing already planned would otherwise book nothing. This plugin therefore remembers what a
key started and, on stop, books that stretch as a session - unless a planned session was already
attached to the timer, in which case StudyLife is already accounting for the time and a second row
would double-count it. Runs under 10 seconds (an accidental tap) are not logged. `StartTime`/
`EndTime` are always constructed as Europe/Berlin wall-clock time, regardless of what timezone the
machine running this plugin is in - StudyLife's API expects every `DateTime` as naive local time
in its own timezone, with no offset in the JSON.

### Quick Note is a preset, not free text

Because Stream Deck hardware has no keyboard, the Quick Note key's Content is written once in its
Property Inspector and sent verbatim on every press. This is a deliberate scope decision, not a
missing feature: if you need different text per press, write it in the app instead and use a
Quick Note key for a fixed macro (e.g. "Reviewed flashcards", a recurring TODO, a link you paste
often).

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
| Scopes | `TimerState.Get`, `TimerState.Save`, `Metrics.GetSummary`, `Sessions.Create`, `Sessions.GetHistory`, `Notes.Create` |

`Courses.GetAll` and `CourseGoals.GetAll` are deliberately not requested: every "which course"
picker in this plugin (Focus Timer, Course Goal, Quick Note, Switch Course) sources its list from
`Metrics.GetSummary`'s `upcomingCourseGoals` instead - the same server-computed "courses you are
currently working towards" list `studylife-vscode`'s course picker uses, capped at 5 open goals.
That keeps the scope list (and the browser consent screen) to only what each action actually
calls.

All four redirect URIs are needed because the login flow validates `redirect_uri` by **exact**
match, and the plugin binds whichever of those four loopback ports is free. They deliberately
differ from `studylife-vscode`'s 8775-8778 and `studylife-cli`'s 8765-8768 so all three can be
logged in at the same time.

### 2. Install the plugin

Download the latest `.streamDeckPlugin` from the [Releases](https://github.com/lukislp/studylife-streamdeck/releases)
page and double-click it; Stream Deck installs it and offers all five actions in the action list
under the "StudyLife" category.

### 3. Connect

Add any action to a key, open its Property Inspector, enter your instance URL and press
**Connect**. You are sent to your browser to approve the connection; the approval comes back
through a one-time assertion which is redeemed for this installation's own API key. The key is
stored with the Stream Deck SDK's own global-settings mechanism, shared by every action and never
sent anywhere but your instance.

## Privacy

The plugin talks to your instance and nowhere else. No telemetry, no third-party services. What
leaves your machine is: the poll for timer state and metrics, timer transitions you trigger by
pressing a key, sessions this plugin books when you stop a timer it started, and notes/course
selections you explicitly create or pick.

## Development

```bash
npm install
npm run typecheck
npm test
npm run build      # bundle src/plugin.ts into com.lukislp.studylife.sdPlugin/bin/plugin.js
npm run package     # produce the .streamDeckPlugin
npx @elgato/cli validate com.lukislp.studylife.sdPlugin   # manifest/PI/image checks
```

The modules without a Stream Deck connection (`oauth.ts`, `timer.ts`, `render.ts`, `runLog.ts`,
`history.ts`, `berlinTime.ts`, `courseCycle.ts`, `noteTitle.ts`, the pure helpers in `api.ts`) hold
the rules that are easy to get subtly wrong, and those are what the tests cover - PKCE shape,
constant-time state comparison, callback parsing, the timer transitions, the key-title rendering
rules, the run-to-session decision, today's-hours summation, Europe/Berlin wall-clock construction
and the Switch Course cycling order. `auth.ts`, `settings.ts`, `metricsCache.ts` and
`src/actions/*.ts` keep the SDK-facing half separate precisely so the rest can be tested without a
device.

`timer.ts` is worth reading before changing anything about the timer. The wire shape has no
"paused" flag, and the server accepts unknown JSON properties silently - so a wrong field name
produces a green build and a key that does nothing.

`berlinTime.ts` is worth reading before changing anything that sends a `DateTime` to StudyLife's
API. Every `DateTime` it sends or expects is naive local time in the server's own Europe/Berlin
timezone, never UTC and never the client machine's own timezone, with no offset in the JSON -
getting this wrong is invisible in a green build and silently books sessions at the wrong hour.

## Licence

AGPL-3.0-or-later - see [LICENSE](LICENSE).
