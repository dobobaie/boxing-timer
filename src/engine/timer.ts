import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Profile } from '../types';
import { buildPlan, PlanEntry } from './plan';
import { playLongBeep, playShortBeep } from '../sound/beeps';

export type SessionState =
  | { kind: 'idle' }
  | { kind: 'countdown'; remainingMs: number } // pre-session 3-sec countdown
  | { kind: 'running'; entryIndex: number; remainingMs: number }
  | { kind: 'paused'; entryIndex: number; remainingMs: number }
  | { kind: 'finished' };

const PRE_COUNTDOWN_SEC = 3;
const TICK_MS = 100;

export function useTimerEngine(profile: Profile) {
  const plan = useMemo<PlanEntry[]>(() => buildPlan(profile), [profile]);
  const [state, setState] = useState<SessionState>({ kind: 'idle' });
  const stateRef = useRef(state);
  stateRef.current = state;

  // Refs that survive renders for precise tick math.
  const lastTickRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Track which whole-seconds we've already beeped on, per phase, so each
  // beep fires exactly once even though the tick runs at 100ms.
  const lastBeepSecRef = useRef<number>(-1);
  // Tag of the current "beep phase" — changes whenever we enter a new entry
  // or the pre-countdown — so the per-second beep dedup resets cleanly.
  const phaseTagRef = useRef<string>('idle');

  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    lastTickRef.current = null;
  }, []);

  const startInterval = useCallback(() => {
    if (intervalRef.current) return;
    lastTickRef.current = Date.now();
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const last = lastTickRef.current ?? now;
      const delta = now - last;
      lastTickRef.current = now;
      tick(delta);
    }, TICK_MS);
  }, []);

  // The actual per-tick state transition. Defined inline (not as a hook
  // dependency) because it reads/writes refs and the latest state via
  // a functional setState.
  const tick = (deltaMs: number) => {
    setState((prev) => {
      if (prev.kind === 'countdown') {
        const remainingMs = prev.remainingMs - deltaMs;
        const secLeft = Math.ceil(remainingMs / 1000);
        maybeBeepForSecond('pre', secLeft, remainingMs);
        if (remainingMs <= 0) {
          // Transition into first entry.
          return enterEntry(0);
        }
        return { kind: 'countdown', remainingMs };
      }
      if (prev.kind === 'running') {
        const remainingMs = prev.remainingMs - deltaMs;
        const secLeft = Math.ceil(remainingMs / 1000);
        maybeBeepForSecond(`e${prev.entryIndex}`, secLeft, remainingMs);
        if (remainingMs <= 0) {
          const nextIdx = prev.entryIndex + 1;
          if (nextIdx >= plan.length) {
            return { kind: 'finished' };
          }
          return enterEntry(nextIdx);
        }
        return { kind: 'running', entryIndex: prev.entryIndex, remainingMs };
      }
      return prev;
    });
  };

  function enterEntry(entryIndex: number): SessionState {
    const entry = plan[entryIndex]!;
    phaseTagRef.current = `e${entryIndex}`;
    lastBeepSecRef.current = -1;
    return { kind: 'running', entryIndex, remainingMs: entry.durationSec * 1000 };
  }

  function maybeBeepForSecond(phase: string, secLeft: number, remainingMs: number) {
    if (phaseTagRef.current !== phase) {
      phaseTagRef.current = phase;
      lastBeepSecRef.current = -1;
    }
    // Phases:
    //  - 'pre' (pre-countdown): short beep at 3,2,1; long beep at 0
    //  - per-entry: short beep at 3,2,1; long beep at 0 (just before switch)
    if (lastBeepSecRef.current === secLeft) return;
    lastBeepSecRef.current = secLeft;
    if (remainingMs <= 0) {
      void playLongBeep();
    } else if (secLeft === 1 || secLeft === 2 || secLeft === 3) {
      void playShortBeep();
    }
  }

  const start = useCallback(() => {
    if (plan.length === 0) return;
    phaseTagRef.current = 'pre';
    lastBeepSecRef.current = -1;
    setState({ kind: 'countdown', remainingMs: PRE_COUNTDOWN_SEC * 1000 });
    startInterval();
  }, [plan, startInterval]);

  const pause = useCallback(() => {
    setState((prev) => {
      if (prev.kind === 'running') {
        stopInterval();
        return { kind: 'paused', entryIndex: prev.entryIndex, remainingMs: prev.remainingMs };
      }
      return prev;
    });
  }, [stopInterval]);

  const resume = useCallback(() => {
    setState((prev) => {
      if (prev.kind === 'paused') {
        startInterval();
        return { kind: 'running', entryIndex: prev.entryIndex, remainingMs: prev.remainingMs };
      }
      return prev;
    });
  }, [startInterval]);

  const stop = useCallback(() => {
    stopInterval();
    phaseTagRef.current = 'idle';
    lastBeepSecRef.current = -1;
    setState({ kind: 'idle' });
  }, [stopInterval]);

  // Cleanup on unmount.
  useEffect(() => stopInterval, [stopInterval]);

  // Derived display values
  const totalSessionSec = useMemo(
    () => plan.reduce((sum, e) => sum + e.durationSec, 0),
    [plan]
  );

  const elapsedSec = useMemo(() => {
    if (state.kind === 'idle' || state.kind === 'countdown') return 0;
    if (state.kind === 'finished') return totalSessionSec;
    const entry = plan[state.entryIndex];
    if (!entry) return 0;
    return entry.startAtSec + (entry.durationSec - state.remainingMs / 1000);
  }, [state, plan, totalSessionSec]);

  const currentEntry: PlanEntry | null =
    state.kind === 'running' || state.kind === 'paused'
      ? plan[state.entryIndex] ?? null
      : null;

  return {
    state,
    plan,
    totalSessionSec,
    elapsedSec,
    currentEntry,
    start,
    pause,
    resume,
    stop,
  };
}
