import { Profile } from '../types';
import { resolveTimer } from './rules';

export type PlanEntry = {
  /** 'timer' = one of the profile's timers; 'cycleRest' = the gap between two cycles. */
  kind: 'timer' | 'cycleRest';
  cycle: number; // 1-based
  round: number; // 1-based inside the cycle; 0 for a cycle rest
  timerIndex: number; // -1 for a cycle rest
  timerId: string;
  timerName: string;
  durationSec: number;
  startAtSec: number; // cumulative elapsed at the moment this entry starts (excluding pre-countdown)
};

export function profileCycles(profile: Profile): number {
  return Math.max(1, Math.round(profile.cycles ?? 1));
}

export function profileCycleRestSec(profile: Profile): number {
  return Math.max(0, Math.round(profile.cycleRestSec ?? 0));
}

/**
 * Pre-compute the full session: a flat ordered list of entries with their
 * resolved durations. Building this ahead of time lets the UI show accurate
 * total session time even when timers have rules that change duration each
 * round, and lets the engine locate itself from a single elapsed-ms value.
 *
 * Two nested layers:
 *   cycle 1..cycles  ->  round 1..totalRounds  ->  each timer in order
 * with an optional rest entry between two cycles. Rule/trigger carry-over state
 * is reset at the start of every cycle, so "20 rounds of pyramid" repeated twice
 * gives two identical pyramids rather than one continuing ramp.
 */
export function buildPlan(profile: Profile): PlanEntry[] {
  const entries: PlanEntry[] = [];
  const cycles = profileCycles(profile);
  const restSec = profileCycleRestSec(profile);
  const rounds = Math.max(1, Math.round(profile.totalRounds));
  let cumulative = 0;

  for (let cycle = 1; cycle <= cycles; cycle++) {
    // Per-timer carry-over across rounds: previous resolved duration (so an
    // appliesTo:previous rule/trigger chains across the same timer's prior round)
    // and the active trigger index (so the trigger state machine advances forward).
    // Both are cycle-local — a new cycle replays the same progression.
    const previousByTimerId = new Map<string, number>();
    const activeTriggerByTimerId = new Map<string, number>();

    for (let round = 1; round <= rounds; round++) {
      profile.timers.forEach((timer, idx) => {
        const previousDurationSec = previousByTimerId.get(timer.id);
        const { durationSec, activeTriggerIndex } = resolveTimer(timer, {
          round,
          totalTimeSec: cumulative,
          previousDurationSec,
          activeTriggerIndex: activeTriggerByTimerId.get(timer.id) ?? -1,
        });
        entries.push({
          kind: 'timer',
          cycle,
          round,
          timerIndex: idx,
          timerId: timer.id,
          timerName: timer.name,
          durationSec,
          startAtSec: cumulative,
        });
        cumulative += durationSec;
        previousByTimerId.set(timer.id, durationSec);
        activeTriggerByTimerId.set(timer.id, activeTriggerIndex);
      });
    }

    if (cycle < cycles && restSec > 0) {
      entries.push({
        kind: 'cycleRest',
        cycle,
        round: 0,
        timerIndex: -1,
        timerId: `cycle-rest-${cycle}`,
        timerName: 'Cycle rest',
        durationSec: restSec,
        startAtSec: cumulative,
      });
      cumulative += restSec;
    }
  }
  return entries;
}

export function planTotalSeconds(profile: Profile): number {
  const plan = buildPlan(profile);
  if (plan.length === 0) return 0;
  const last = plan[plan.length - 1]!;
  return last.startAtSec + last.durationSec;
}
