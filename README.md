# StudyLife for Stream Deck

[![CI](https://github.com/lukislp/studylife-streamdeck/actions/workflows/ci.yml/badge.svg)](https://github.com/lukislp/studylife-streamdeck/actions/workflows/ci.yml) [![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/lukislp/studylife-streamdeck/badge)](https://scorecard.dev/viewer/?uri=github.com/lukislp/studylife-streamdeck) [![CodeQL](https://github.com/lukislp/studylife-streamdeck/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/lukislp/studylife-streamdeck/security/code-scanning)
[![Release](https://img.shields.io/github/v/release/lukislp/studylife-streamdeck)](https://github.com/lukislp/studylife-streamdeck/releases)
[![License: AGPL-3.0](https://img.shields.io/github/license/lukislp/studylife-streamdeck)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6)](https://www.typescriptlang.org/)

Control your [StudyLife](https://github.com/lukislp/studylife) focus timer, pick its preset, see
your study status, track course-goal countdowns and drop preset notes from physical Elgato Stream
Deck keys - and, on Stream Deck +, its dials - the same shared timer as the web app, the tray app,
[studylife-vscode](https://github.com/lukislp/studylife-vscode) and Home Assistant.

## What it does

**Focus Timer key** - a single key that cycles through the timer: tap to start, tap again to
pause, tap again to resume; hold the key to stop. The key's title updates live with the phase and
a countdown while it is visible on a device, by polling `TimerState.Get` every 5 seconds; when
idle it shows this week's hours instead of sitting blank. The key face also renders a live
circular progress ring behind the title: full while idle it shows a calm empty outline, while
running it fills clockwise with the current phase's real elapsed fraction, and for a custom timer
mode (id ≥ 100, whose total length this plugin cannot read) it shows an explicitly indeterminate
rotating segment rather than a fabricated percentage - see "Real icon artwork and dynamic key
images" below. Optionally bind this specific key instance to one course in its Property Inspector;
when unset it falls back to whatever the **Switch Course** key currently has selected, and when
that is unset too the timer still starts/stops normally, it just does not book a session.

When a run this plugin started (not one already attached to a planned session) is stopped and
lasted at least 10 seconds, it is automatically logged as a study session via `Sessions.Create` -
see "Session booking" below.

**Study Status key** - shows this week's and today's study hours plus your current streak,
refreshed once a minute; pressing it refreshes immediately. Every number comes from StudyLife's
own metrics/history endpoints, the single place those are calculated, so this key can never
quietly disagree with the web app.

**Course Goal key** - a per-key countdown to one specific open course goal, picked once in its
Property Inspector from your currently open goals. Pin several of these to different physical
keys to see several course deadlines side by side. The key face also renders a small countdown
badge with the actual day count, colored a neutral indigo normally and shifting to a warning
color once the goal is due today or overdue - see "Real icon artwork and dynamic key images"
below for why this is a day count, not a fabricated completion percentage.

**Quick Note key** - a press saves a *preset* note (written once in the Property Inspector, not
typed per press - Stream Deck hardware has no keyboard) via `Notes.Create`, optionally tagged with
a course. Shows a green checkmark on success, a warning triangle on failure.

**Switch Course key** - cycles through your open course goals as the plugin-wide "current
course", the fallback source for any Focus Timer or Quick Note key with no course of its own
bound. Its title shows the course it just switched to, or "No course" once cycled past the end.

**Focus Mode key/dial** - cycles the nine built-in focus presets (see "Only the built-in nine"
below) that Focus Timer applies on its *next* genuine start, the same plugin-wide fallback shape
Switch Course gives the current course. On any Stream Deck, pressing the key steps the cycle by
one and applies it immediately; on Stream Deck +, the dial's touch display shows the preset name
and its focus/break minutes, rotating it *scrubs* a candidate live without applying anything, and
pushing the dial confirms the candidate shown - the same apply a keypad press performs. A mode can
only be changed while the timer is stopped or paused: changing it mid-phase would re-measure a
countdown already running against a length that no longer applies, so a press or a dial push while
the timer is running shows an alert instead.

All six actions share one Property Inspector for the plugin's settings: an instance URL field and
Connect/Disconnect buttons, plus a course dropdown (Focus Timer, Course Goal, Quick Note), a
preset-text field (Quick Note) and a default-topic field (Focus Timer), shown depending on which
action the key is running. Focus Mode has no per-key settings of its own.

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

### Default topic

Focus Timer's Property Inspector has an optional "Default topic" text field. When set, it is sent
as the session's `Topic` on the `Sessions.Create` call that key's stop produces (see "Session
booking" above); when left blank, `Topic` is simply omitted, exactly as before this field existed.
It is captured once, when a run starts, so editing it mid-session never changes what that run
books.

### Only the built-in nine

Focus Mode (and the mode a Focus Timer key applies on its next start) only ever offers the nine
built-in presets:

| Id | Name | Focus | Break |
| -- | --- | --- | --- |
| 1 | Pomodoro Classic | 25m | 5m |
| 2 | Flow State | 52m | 17m |
| 3 | Ultradian Rhythm | 90m | 20m |
| 4 | Claude Mode | 40m | 10m |
| 5 | Sprint Bursts | 10m | 3m |
| 6 | Micro Focus | 5m | 1m |
| 7 | Quick Burst | 15m | 3m |
| 8 | Deep Dive | 120m | 20m |
| 9 | Marathon Session | 180m | 30m |

Custom modes (id ≥ 100) live in your StudyLife instance's own settings, and this plugin has no
scope to read them - it can neither name nor time one, so it never offers or overwrites one. If a
session is currently running on a custom mode, Focus Mode still shows and cycles the built-in
nine; applying one of them only ever takes effect on the *next* start, never mid-phase, so a
custom mode already running is left alone until you stop it yourself. This is a deliberate scope
decision, not a missing feature - the same one `studylife-vscode`'s `pickTimerMode` command makes.

### Course goals stay capped at five, on purpose

Every "which course" picker in this plugin (Focus Timer, Course Goal, Quick Note, Switch Course)
sources its list from `Metrics.GetSummary`'s `upcomingCourseGoals`, which the server caps at 5 open
goals (`StudyMetrics.CalcUpcomingCourseGoals`). This plugin does not request `CourseGoals.GetAll`
or any other scope to lift that cap - it is a deliberate, explicit product decision shared across
every StudyLife client, not a limitation of this one.

### Real icon artwork and dynamic key images

Every action icon and key face is real, hand-drawn artwork sharing one visual language - the
same brand indigo (`#4F46E5`) fill, white glyphs, consistent stroke widths - rather than the flat
placeholder-color squares earlier versions shipped. The source of truth is a set of plain SVG
glyphs under `assets/icons/`; `npm run icons` (backed by `scripts/render-icons.mjs` and
`@resvg/resvg-js`, a build-time-only dependency never bundled into the runtime plugin) rasterizes
each one to every PNG size Stream Deck needs. Changing the look of an action means editing its
SVG and re-running that script, never hand-editing a PNG.

Two keys go further and render a *dynamic* image on top of that static art while they are visible,
via `action.setImage()` with an inline `data:image/svg+xml;base64,...` URI (Stream Deck's own
software renders SVG directly, so no rasterizer is needed at runtime for this):

- **Focus Timer** draws a circular progress ring (`src/progressRing.ts`) from timer.ts's
  `progress()` fraction. Stopped is its own calm outline ring, a running built-in mode fills
  clockwise with the real elapsed fraction, and a running *custom* mode (id ≥ 100, whose total
  length this plugin has no scope to read) shows a short rotating segment rather than guessing a
  percentage - the same "never fabricate a number you can't honestly compute" rule `timer.ts`'s
  `durationMinutes` and `render.ts`'s `timerKeyTitle` already apply to the text rendering.
- **Course Goal** draws a countdown badge (`src/countdownBadge.ts`) showing the goal's actual
  `daysLeft`, colored a neutral indigo normally and a warning red once it is due today or
  overdue. `Metrics.GetSummary` gives a target date and days-left, never a start date, so there is
  no honest way to compute a completion fraction the way Focus Timer's ring can - a real day
  count is the honest visual here, not an invented progress bar.

Both are plain, dependency-free string builders with no Stream Deck SDK or DOM involved, so they
are unit-tested directly (`tests/progressRing.test.ts`, `tests/countdownBadge.test.ts`), the same
pure/tested split `render.ts`, `courseCycle.ts` and `noteTitle.ts` already use. Study Status,
Quick Note, Switch Course and Focus Mode keep clean text titles for now - their data does not back
an equally honest visual, so this stays scoped to the two cases above rather than inventing one.

### Multi-Action support

None of the six actions set `SupportedInMultiActions: false` in `manifest.json`, so every one of
them already works inside Stream Deck's own native Multi-Action feature - chaining several
actions onto a single key press - with no plugin code needed for it. A couple of chains worth
setting up:

- **Switch Course → Focus Timer**: cycle the plugin-wide current course to the one you want, then
  start the timer, both from one press - useful when Focus Timer's own key has no course bound
  and you want a single key per course anyway.
- **Switch Course → Quick Note**: tag a quick note to a specific course without first pressing a
  separate Switch Course key.

To set one up: add a Multi-Action key in the Stream Deck app, drag the actions onto it in order,
and configure each one's own settings exactly as you would standalone.

### No webhook management here

This plugin does not manage StudyLife webhook subscriptions. A physical-button CRUD surface for
webhook subscriptions is a poor fit for Stream Deck hardware and is deliberately scoped to
[studylife-raycast](https://github.com/lukislp/studylife-raycast) instead, where a list UI already
exists for exactly that.

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
page and double-click it; Stream Deck installs it and offers all six actions in the action list
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
npm run icons       # regenerate every action/key/plugin PNG from assets/icons/*.svg
npm run build      # bundle src/plugin.ts into com.lukislp.studylife.sdPlugin/bin/plugin.js
npm run package     # produce the .streamDeckPlugin
npx @elgato/cli validate com.lukislp.studylife.sdPlugin   # manifest/PI/image checks
```

The modules without a Stream Deck connection (`oauth.ts`, `timer.ts`, `render.ts`, `runLog.ts`,
`history.ts`, `berlinTime.ts`, `courseCycle.ts`, `noteTitle.ts`, `progressRing.ts`,
`countdownBadge.ts`, `svgImage.ts`, the pure helpers in `api.ts`) hold the rules that are easy to
get subtly wrong, and those are what the tests cover - PKCE shape, constant-time state comparison,
callback parsing, the timer transitions, the key-title and key-image rendering rules, the
run-to-session decision, today's-hours summation, Europe/Berlin wall-clock construction and the
Switch Course cycling order. `auth.ts`, `settings.ts`, `metricsCache.ts` and `src/actions/*.ts`
keep the SDK-facing half separate precisely so the rest can be tested without a device.

`timer.ts` is worth reading before changing anything about the timer. The wire shape has no
"paused" flag, and the server accepts unknown JSON properties silently - so a wrong field name
produces a green build and a key that does nothing.

`berlinTime.ts` is worth reading before changing anything that sends a `DateTime` to StudyLife's
API. Every `DateTime` it sends or expects is naive local time in the server's own Europe/Berlin
timezone, never UTC and never the client machine's own timezone, with no offset in the JSON -
getting this wrong is invisible in a green build and silently books sessions at the wrong hour.

## Licence

AGPL-3.0-or-later - see [LICENSE](LICENSE).
