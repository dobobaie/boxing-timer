import { Profile } from '../types';
import { resolveTimerDuration } from './rules';

export type PlanEntry = {
  round: number;
  timerIndex: number;
  timerId: string;
  timerName: string;
  durationSec: number;
  startAtSec: number; // cumulative elapsed at the moment this entry starts (excluding pre-countdown)
};

/**
 * Pre-compute the full session: a flat ordered list of (round, timer) entries
 * with their resolved durations. Building this ahead of time lets the UI show
 * accurate total session time even when timers have rules that change duration
 * each round.
 */
export function buildPlan(profile: Profile): PlanEntry[] {
  const entries: PlanEntry[] = [];
  // previousDuration is per-timer across rounds (so a rule with appliesTo:previous
  // chains across the same timer's prior round, not across different timers).
  const previousByTimerId = new Map<string, number>();
  let cumulative = 0;
  for (let round = 1; round <= Math.max(1, profile.totalRounds); round++) {
    profile.timers.forEach((timer, idx) => {
      const previousDurationSec = previousByTimerId.get(timer.id);
      const durationSec = resolveTimerDuration(timer, {
        round,
        totalTimeSec: cumulative,
        previousDurationSec,
      });
      entries.push({
        round,
        timerIndex: idx,
        timerId: timer.id,
        timerName: timer.name,
        durationSec,
        startAtSec: cumulative,
      });
      cumulative += durationSec;
      previousByTimerId.set(timer.id, durationSec);
    });
  }
  return entries;
}

export function planTotalSeconds(profile: Profile): number {
  const plan = buildPlan(profile);
  if (plan.length === 0) return 0;
  const last = plan[plan.length - 1]!;
  return last.startAtSec + last.durationSec;
}
