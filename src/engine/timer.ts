import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState as RNAppState, AppStateStatus } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { Profile } from '../types';
import { buildPlan, PlanEntry } from './plan';
import { playLongBeep, playShortBeep } from '../sound/beeps';

export type SessionState =
  | { kind: 'idle' }
  | { kind: 'countdown'; remainingMs: number } // pre-session 3-sec countdown
  | { kind: 'running'; entryIndex: number; remainingMs: number }
  // `resumeKind` remembers whether we paused during the pre-countdown or inside
  // an entry, so Resume puts us back exactly where we were. Pausing the
  // pre-countdown used to be impossible even though the UI offered the button.
  | { kind: 'paused'; resumeKind: 'countdown' | 'running'; entryIndex: number; remainingMs: number }
  | { kind: 'finished' };

const PRE_COUNTDOWN_SEC = 3;
const PRE_COUNTDOWN_MS = PRE_COUNTDOWN_SEC * 1000;
// 50ms (~20fps) so the centisecond readout on the running timer updates
// smoothly. Per-second beep dedup is keyed on the whole second, so a faster
// tick doesn't fire extra beeps.
const TICK_MS = 50;
// If more than this much wall-clock passed between two ticks, the JS thread was
// suspended (app backgrounded, device dozing). We resync the clock but stay
// silent rather than firing a burst of beeps for boundaries already in the past.
const CATCHUP_GAP_MS = 1000;
const KEEP_AWAKE_TAG = 'boxing-timer-session';

/**
 * How the session is anchored. Everything the UI shows is *derived* from a
 * single elapsed-milliseconds value measured against the wall clock — we never
 * accumulate per-tick deltas. That is what makes the timer background-safe: if
 * the OS freezes our JS thread for two minutes, the next tick recomputes the
 * true position instead of losing two minutes.
 */
type Session =
  | { status: 'idle' }
  | { status: 'running'; anchorMs: number } // elapsed = Date.now() - anchorMs
  | { status: 'paused'; elapsedMs: number };

/** Where an elapsed-ms value lands in the plan. Never 'idle'/'paused' — those are session facts. */
type Position = Extract<SessionState, { kind: 'countdown' | 'running' | 'finished' }>;

export function useTimerEngine(profile: Profile) {
  const plan = useMemo<PlanEntry[]>(() => buildPlan(profile), [profile]);
  const planRef = useRef(plan);
  planRef.current = plan;

  const [session, setSession] = useState<Session>({ status: 'idle' });
  const sessionRef = useRef(session);
  sessionRef.current = session;

  // Re-render driver. The interval bumps this; the visible state is computed
  // from it, so a stale render can never desync from the real clock.
  const [nowMs, setNowMs] = useState(() => Date.now());

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastEvalMsRef = useRef<number>(0);
  // Tag of the current "phase" (pre-countdown / entry N / end) so the per-second
  // beep dedup resets cleanly at each boundary.
  const phaseTagRef = useRef<string>('');
  const lastBeepSecRef = useRef<number>(-1);

  /** Locate the session at `elapsedMs` (measured from the start of the pre-countdown). */
  const positionAt = useCallback((elapsedMs: number): Position => {
    if (elapsedMs < PRE_COUNTDOWN_MS) {
      return { kind: 'countdown', remainingMs: PRE_COUNTDOWN_MS - elapsedMs };
    }
    let t = elapsedMs - PRE_COUNTDOWN_MS;
    const p = planRef.current;
    for (let i = 0; i < p.length; i++) {
      const durationMs = p[i]!.durationSec * 1000;
      if (t < durationMs) return { kind: 'running', entryIndex: i, remainingMs: durationMs - t };
      t -= durationMs;
    }
    return { kind: 'finished' };
  }, []);

  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  /**
   * Fire the audio cues for the position we are at now. `silent` is set when we
   * just resynced after a suspension — the boundaries we skipped are history.
   */
  const emitCues = useCallback(
    (pos: Position, silent: boolean) => {
      const tag =
        pos.kind === 'countdown'
          ? 'pre'
          : pos.kind === 'running'
            ? `e${pos.entryIndex}`
            : 'end';
      if (tag !== phaseTagRef.current) {
        // Entering a new phase == the previous phase hit zero: long beep, once.
        if (phaseTagRef.current !== '' && !silent) void playLongBeep();
        phaseTagRef.current = tag;
        lastBeepSecRef.current = -1;
      }
      if (pos.kind === 'countdown' || pos.kind === 'running') {
        const secLeft = Math.ceil(pos.remainingMs / 1000);
        if (secLeft !== lastBeepSecRef.current) {
          lastBeepSecRef.current = secLeft;
          if (!silent && secLeft >= 1 && secLeft <= 3) void playShortBeep();
        }
      }
    },
    []
  );

  /** One clock evaluation: resync the render clock and emit any due cues. */
  const evaluate = useCallback(
    (forceSilent = false) => {
      const s = sessionRef.current;
      if (s.status !== 'running') return;
      const now = Date.now();
      const gap = now - lastEvalMsRef.current;
      const silent = forceSilent || gap > CATCHUP_GAP_MS;
      lastEvalMsRef.current = now;
      const pos = positionAt(now - s.anchorMs);
      emitCues(pos, silent);
      setNowMs(now);
      if (pos.kind === 'finished') stopInterval();
    },
    [emitCues, positionAt, stopInterval]
  );

  const startInterval = useCallback(() => {
    if (intervalRef.current) return;
    lastEvalMsRef.current = Date.now();
    intervalRef.current = setInterval(() => evaluate(), TICK_MS);
  }, [evaluate]);

  // --- controls -------------------------------------------------------------

  const start = useCallback(() => {
    if (planRef.current.length === 0) return;
    phaseTagRef.current = 'pre';
    lastBeepSecRef.current = -1;
    const now = Date.now();
    lastEvalMsRef.current = now;
    const next: Session = { status: 'running', anchorMs: now };
    sessionRef.current = next;
    setSession(next);
    setNowMs(now);
    startInterval();
  }, [startInterval]);

  const pause = useCallback(() => {
    const prev = sessionRef.current;
    if (prev.status !== 'running') return;
    stopInterval();
    const elapsedMs = Math.max(0, Date.now() - prev.anchorMs);
    const next: Session = { status: 'paused', elapsedMs };
    sessionRef.current = next;
    setSession(next);
  }, [stopInterval]);

  const resume = useCallback(() => {
    const prev = sessionRef.current;
    if (prev.status !== 'paused') return;
    const now = Date.now();
    lastEvalMsRef.current = now;
    const next: Session = { status: 'running', anchorMs: now - prev.elapsedMs };
    sessionRef.current = next;
    setSession(next);
    setNowMs(now);
    startInterval();
  }, [startInterval]);

  const stop = useCallback(() => {
    stopInterval();
    phaseTagRef.current = '';
    lastBeepSecRef.current = -1;
    sessionRef.current = { status: 'idle' };
    setSession({ status: 'idle' });
  }, [stopInterval]);

  // --- background handling --------------------------------------------------

  // Coming back to the foreground, resync immediately (and silently) instead of
  // waiting up to TICK_MS and replaying every boundary we slept through.
  useEffect(() => {
    const sub = RNAppState.addEventListener('change', (next: AppStateStatus) => {
      if (next !== 'active') return;
      if (sessionRef.current.status !== 'running') return;
      evaluate(true);
      // The interval can be killed outright by the OS while suspended.
      if (!intervalRef.current) startInterval();
    });
    return () => sub.remove();
  }, [evaluate, startInterval]);

  // --- screen wake lock -----------------------------------------------------

  const sessionActive = session.status !== 'idle';
  useEffect(() => {
    if (!sessionActive) return;
    // Both calls can fail benignly: no Wake Lock API (web), or a release that
    // races ahead of its own activation. Neither should reach the user.
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return () => {
      try {
        // Sync on native, a promise on web — normalise before catching.
        void Promise.resolve(deactivateKeepAwake(KEEP_AWAKE_TAG)).catch(() => {});
      } catch {
        // ignore
      }
    };
  }, [sessionActive]);

  // Cleanup on unmount.
  useEffect(() => stopInterval, [stopInterval]);

  // --- derived display values ----------------------------------------------

  const state = useMemo<SessionState>(() => {
    if (session.status === 'idle') return { kind: 'idle' };
    if (session.status === 'paused') {
      const pos = positionAt(session.elapsedMs);
      if (pos.kind === 'finished') return pos;
      return {
        kind: 'paused',
        resumeKind: pos.kind === 'countdown' ? 'countdown' : 'running',
        entryIndex: pos.kind === 'running' ? pos.entryIndex : -1,
        remainingMs: pos.remainingMs,
      };
    }
    return positionAt(nowMs - session.anchorMs);
  }, [session, nowMs, positionAt]);

  const totalSessionSec = useMemo(
    () => plan.reduce((sum, e) => sum + e.durationSec, 0),
    [plan]
  );

  const elapsedSec = useMemo(() => {
    if (state.kind === 'idle' || state.kind === 'countdown') return 0;
    if (state.kind === 'finished') return totalSessionSec;
    if (state.entryIndex < 0) return 0; // paused during the pre-countdown
    const entry = plan[state.entryIndex];
    if (!entry) return 0;
    return entry.startAtSec + (entry.durationSec - state.remainingMs / 1000);
  }, [state, plan, totalSessionSec]);

  const currentEntry: PlanEntry | null =
    (state.kind === 'running' || state.kind === 'paused') && state.entryIndex >= 0
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
