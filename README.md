# boxing-timer

React Native (Expo SDK 54) boxing round / interval timer.

## Features

- **One-tap start.** Opens straight to the active profile; tap **Start** to begin a 3-second pre-countdown (with beeps), then the configured timers run in order.
- **Two nested layers.** A *round* is one full pass through the timer sequence (default: 60s **Rest** → 180s **Fight**). A *cycle* is a full block of rounds, and a profile can repeat that block N times with a configurable rest in between — so a pyramid can climb-and-descend twice with a minute of breathing room between the two passes.
- **Audible cues.** Short beep on the last 3 seconds of each interval and a longer bell at 0 before auto-advancing.
- **Pause / Resume / Stop**, including during the pre-countdown.
- **Background-safe clock.** The session is anchored to the wall clock, not to accumulated ticks, so a suspended or throttled JS thread (app backgrounded, device dozing) never loses time — coming back resyncs to the true position in one step, silently, instead of replaying every boundary it slept through.
- **Beeps keep sounding with the screen off** (Android). A foreground service replays the session's cue schedule natively — see [Background audio on Android](#background-audio-on-android).
- **Screen stays awake** for as long as a session is active (`expo-keep-awake`), released as soon as it stops.
- **Top-bar HUD.** Total elapsed / total session time (top-left); cycle + round position (top-right).
- **Settings.** Profile picker, session structure (rounds, cycles, rest between cycles), the timer sequence inside one round, and the resulting total with an optional round-by-round breakdown. An **Advanced** switch in the header reveals the raw rule/trigger machine for power users.
- **Profiles.** Create from a template (copy current / Classic / Pyramid / blank), switch, rename, duplicate, delete.

## How a timer's length evolves

Most workouts are one of four shapes, so the timer editor offers them directly:

| Preset | Meaning |
|---|---|
| **Same every round** | Fixed duration. |
| **Longer each round** | `+step` each round, optionally flattening at a cap. |
| **Shorter each round** | `-step` each round, optionally flattening at a floor. |
| **Pyramid** | `+step` up to a peak, then `-step` back down. |
| **Custom** | Hand-written triggers and rules (below). |

The editor shows a live per-round preview computed with the same function the
engine runs, and recognises an existing timer's shape so a profile built by hand
still opens on the right preset. Presets compile down to **triggers**; nothing
special-cases them at runtime.

### Triggers and rules (advanced)

**Triggers** are a stateful, ordered state machine: at most one is active at a
time, it applies its action every round, and it stays active until the *next*
trigger's condition fires (which takes over). Progression is strictly forward —
trigger 2 cannot fire before trigger 1 has. That is what expresses a pyramid:

1. `on round == 1 -> then previous + 10 each round` (ramp up)
2. `on this timer >= 60 -> then previous - 10 each round` (ramp down)

Over 11 rounds a 10s Fight timer runs **10 → 20 → 30 → 40 → 50 → 60 → 50 → 40 → 30 → 20 → 10**. This is the shipping **Pyramid** profile.

**Rules** are the stateless counterpart: every matching rule is re-checked each
round and the last match wins. Each has a **When** (a condition on `round`, on
`this timer`'s incoming length, or on total `elapsed` seconds) and an **Apply**
(`+ - * /` against the timer's **base** duration or its **previous** round's
value). `appliesTo: previous` is a no-op on a timer's first round.

Rule/trigger carry-over state resets at the start of every cycle, so each cycle
replays the same progression.

The math lives in [`src/engine/rules.ts`](src/engine/rules.ts) (pure, testable),
the presets in [`src/engine/presets.ts`](src/engine/presets.ts), and the full
schedule is pre-computed by [`src/engine/plan.ts`](src/engine/plan.ts) so the UI
can show an accurate total session time even when triggers are active.

## Project layout

```
App.tsx                       root: persistence + screen toggle
index.ts                      Expo entry
src/
  types.ts                    Timer / Rule / Trigger / Profile types
  theme.ts                    colors / radii / spacing
  utils/                      id + time-format helpers
  store/
    defaults.ts               Classic + Pyramid seeds, templates, deep clone
    storage.ts                AsyncStorage wrapper + schema migration
  engine/
    rules.ts                  resolveTimer() — pure, testable
    presets.ts                progression <-> trigger compiler + detector
    plan.ts                   buildPlan() — flat (cycle, round, timer) schedule
    timer.ts                  useTimerEngine() — wall-clock anchored session
    labels.ts                 shared position / notification wording
    background.ts             buildCueSchedule() — the schedule handed to Android
  sound/
    beeps.ts                  expo-audio wrapper around assets/beep-*.wav
  screens/
    HomeScreen.tsx
    SettingsScreen.tsx
  components/
    NumberStepper.tsx
    DurationField.tsx         mm:ss entry with quick-pick chips
    Segmented.tsx
    ConditionEditor.tsx       shared editor for one rule or one trigger
    TimerEditor.tsx
    ProfileManager.tsx
    SchedulePreview.tsx
assets/
  icon.png
  beep-short.wav              ~150ms 880Hz (the 3-2-1 ticks)
  beep-long.wav               ~700ms 660Hz (the round-end bell)
modules/
  background-session/         local Expo module — the Android foreground service
    index.ts                  JS API; no-ops where the native module is absent
    android/src/main/
      AndroidManifest.xml     WAKE_LOCK / FOREGROUND_SERVICE* / POST_NOTIFICATIONS
      .../BackgroundSessionService.kt   the service: cues, notification, wake lock
      .../CueSchedule.kt      buildCues() — boundaries -> beeps (unit-tested)
      res/raw/beep_*.wav      copies of assets/beep-*.wav, played natively
```

## Background audio on Android

Anchoring the clock (above) keeps the timer *correct* across a suspension, but
it cannot make it *audible*: React Native's `JavaTimerManager` removes its
TIMERS_EVENTS frame callback in `onHostPause`, so every JS `setTimeout` and
`setInterval` stops firing the moment the activity is paused. Lock the phone and
the JS engine simply is not running to play the round-end gong.

So the schedule and the playback both move to native for the duration of a
session. On **Start** (and again on **Resume**, which moves every boundary),
`useTimerEngine` hands
[`modules/background-session`](modules/background-session) the wall-clock instant
of every phase boundary plus the line to show for each phase.
`BackgroundSessionService` then:

- runs in the foreground with an ongoing, silent notification (channel
  importance `LOW`) carrying the current phase and a **Stop** action, which is
  relayed back to JS as an `onStopRequested` event;
- holds a **partial wake lock** — time-bounded to the session's own length plus
  half an hour — so the CPU stays scheduled through Doze;
- plays the ticks and the gong itself from `res/raw/beep_*.wav`, re-deriving each
  wait from `System.currentTimeMillis()` after every cue so it self-corrects
  instead of drifting, and staying silent for any cue it woke up more than a
  second late for (the same catch-up rule the JS engine uses);
- stops itself — wake lock, notification and all — on the last gong.

While the service has the cues, JS stays quiet; otherwise every beep would sound
twice. `startBackgroundSession` returns whether the service actually took over,
and a `false` (web, iOS, Expo Go, or a service that refused to start) leaves the
existing `expo-audio` path in charge, so nothing regresses where there is no
foreground service to run.

`POST_NOTIFICATIONS` is requested on first start but not required: denying it
only hides the notification — the service, and therefore the audio, still runs.

The two wav files under `res/raw/` are copies of the ones in `assets/`, which
the JS side still uses. **Change one and change the other**: a native service
cannot reach into the JS bundle's assets.

### Verifying it

`modules/background-session` is a local Expo module, so it is picked up by
`npx expo prebuild` autolinking with no `plugins` entry in `app.json`.

```sh
npx expo prebuild --platform android --clean --no-install
cd android
./gradlew :background-session:testReleaseUnitTest   # cue-expansion unit tests
./gradlew :app:assembleRelease                      # compile + manifest merge
```

Whether the beeps actually survive a locked screen can only be confirmed on a
real device — build an APK and try it.

## Running locally

```sh
nvm use 20            # Expo SDK 54 requires Node 18 or 20
npm install
npm run start         # Expo dev server (scan QR with Expo Go, or press 'a' / 'i' / 'w')
npm run web           # web build via Metro
npm run typecheck     # tsc --noEmit
```

## State persistence

Everything lives in a single `AsyncStorage` key (`boxing-timer.state.v1`): the
full `AppState` (all profiles + active id + the advanced-mode preference). State
is saved automatically on every change, and `migrate()` in
[`src/store/storage.ts`](src/store/storage.ts) fills in fields added by newer
versions (a profile saved before cycles existed loads as a single cycle, i.e.
unchanged behaviour).
