# boxing-timer

React Native (Expo SDK 54) boxing round / interval timer.

## Features

- **One-tap start.** Opens straight to the active profile; tap **Start** to begin a 3-second pre-countdown (with beeps), then the configured timers run in order.
- **Two nested layers.** A *round* is one full pass through the timer sequence (default: 60s **Rest** → 180s **Fight**). A *cycle* is a full block of rounds, and a profile can repeat that block N times with a configurable rest in between — so a pyramid can climb-and-descend twice with a minute of breathing room between the two passes.
- **Audible cues.** Short beep on the last 3 seconds of each interval and a longer bell at 0 before auto-advancing.
- **Pause / Resume / Stop**, including during the pre-countdown.
- **Background-safe clock.** The session is anchored to the wall clock, not to accumulated ticks, so a suspended or throttled JS thread (app backgrounded, device dozing) never loses time — coming back resyncs to the true position in one step, silently, instead of replaying every boundary it slept through.
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
```

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
