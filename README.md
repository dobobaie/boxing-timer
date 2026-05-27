# boxing-timer

React Native (Expo SDK 54) boxing round / interval timer.

## Features

- **One-tap start.** Opens straight to the active profile; tap **Start** to begin a 3-second pre-countdown (with beeps), then the configured timers run in order.
- **Per-round timers.** A "round" is one full pass through the configured timer sequence (default: 60s **Rest** → 180s **Fight**). The session repeats for a configurable number of rounds.
- **Audible cues.** Short beep on the last 3 seconds of each interval and a longer bell at 0 before auto-advancing to the next timer.
- **Pause / Resume / Stop.** Mid-session controls.
- **Top-bar HUD.** Total elapsed / total session time (top-left), current round X / Y (top-right).
- **Settings.**
  - Timers: add, remove (min 1 enforced), duplicate, reorder, rename, change duration.
  - Total rounds.
  - Per-timer rules (see below).
- **Profiles.** Save the current timers + rounds as a named profile, switch between profiles, rename, delete. Two profiles ship by default: **Classic** (60s rest, 180s fight, 5 rounds) and **Pyramid** (see below).
- **Rules.** Each timer can carry any number of rules that adjust its duration based on round number or total elapsed time. See [Rules](#rules) below.

## Rules

Each rule has two parts:

| Part | Meaning |
|---|---|
| **When** | A condition on either the current `round` (1-based) or `totalTimeSec` (seconds elapsed in the session). |
| **Apply** | An arithmetic operation (`+`, `-`, `*`, `/`) and a value, applied to either the timer's **base** duration or to the duration this timer used in its **previous** round. |

Rules are evaluated in array order; later matches overwrite earlier ones. `appliesTo: previous` is a no-op on the very first round for that timer (there is no "previous" yet).

### Example: Pyramid

The shipping **Pyramid** profile uses two rules on the **Fight** timer (base 10s):

1. `when round <= 4 -> previous * 2` — doubles the previous round's fight.
2. `when round >= 5 -> previous / 2` — halves the previous round's fight.

Result over 8 rounds: **10 → 20 → 40 → 80 → 40 → 20 → 10 → 5** seconds.

The math lives in [`src/engine/rules.ts`](src/engine/rules.ts) (pure function, easy to unit-test) and the full per-round schedule is pre-computed by [`src/engine/plan.ts`](src/engine/plan.ts) so the UI can show an accurate total session time even when rules are active.

## Project layout

```
App.tsx                       root: persistence + screen toggle
index.ts                      Expo entry
src/
  types.ts                    Timer / Rule / Profile types
  theme.ts                    colors / radii / spacing
  utils/                      id + time-format helpers
  store/
    defaults.ts               Classic + Pyramid seed profiles
    storage.ts                AsyncStorage wrapper
  engine/
    rules.ts                  resolveTimerDuration() — pure, testable
    plan.ts                   buildPlan() — flat (round, timer) schedule
    timer.ts                  useTimerEngine() — state machine + tick loop
  sound/
    beeps.ts                  expo-av wrapper around assets/beep-*.wav
  screens/
    HomeScreen.tsx
    SettingsScreen.tsx
  components/
    NumberStepper.tsx
    RuleEditor.tsx
    TimerEditor.tsx
    ProfileManager.tsx
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

Everything lives in a single `AsyncStorage` key (`boxing-timer.state.v1`): the full `AppState` (all profiles + active id). State is saved automatically on every change.
