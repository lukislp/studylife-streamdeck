# Privacy

This document describes what the StudyAtrium plugin for Stream Deck stores and where data
goes. The plugin runs only on your computer and talks only to the StudyAtrium instance you
connect it to. The operator of that instance is the contact for privacy questions and
requests.

## What the plugin stores on your machine

In the Stream Deck software's own settings storage (the SDK offers no separate secret store,
so everything is kept there, in plain settings):

- **Global settings:** the instance URL, **your API key**, the current course (id and name)
  that Switch Course selected, and the focus mode that Focus Mode selected.
- **Per-key settings** you enter in the property inspector, such as the course for a key and
  the preset text of a Quick Note key.

A 60-second in-memory cache of the metrics summary is kept while the plugin runs and is not
written to disk. Problems are written at info level or above to the Stream Deck plugin log
(error messages, such as "press failed"); the plugin has no telemetry.

## What is sent, and to whom

Only to your StudyAtrium instance, authenticated with your API key:

- polls for timer state, metrics and courses;
- timer transitions you trigger by pressing a key, and sessions the plugin books when you stop
  a timer it started;
- the preset note of a Quick Note key when you press it, and the course or mode you select.

The login opens your instance in the browser and receives the result on a loopback listener
(`127.0.0.1`). The one-time assertion is exchanged once for the API key.

No third-party services are contacted.

## Retention and deletion

- Use the disconnect function of the plugin to clear the API key from the global settings.
  This is local only: it does not revoke the key on the server. Revoke the key in the
  StudyAtrium web app (connected apps and API keys).
- Uninstalling the plugin removes its settings according to the Stream Deck software's own
  behaviour.
- Data already sent to StudyAtrium is held there under the instance's own retention rules and
  is deleted with your StudyAtrium account.

## Contact

Questions, access or deletion requests: contact the operator of the StudyAtrium instance you
use. Security issues: see [SECURITY.md](SECURITY.md).