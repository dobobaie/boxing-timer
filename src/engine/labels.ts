import { Profile } from '../types';
import { formatMMSS } from '../utils/format';
import { PlanEntry, profileCycles } from './plan';

/** Where the session is right now, independent of paused/running. */
export type SessionPosition =
  | { kind: 'countdown'; remainingMs: number }
  | { kind: 'running'; entryIndex: number; remainingMs: number }
  | { kind: 'finished' };

/** "Cycle 1/2 · Round 3/20" — the cycle half is dropped when there is only one. */
export function positionLabel(
  entry: PlanEntry | null,
  profile: Profile,
  cycles: number = profileCycles(profile)
): string {
  if (!entry) {
    return cycles > 1
      ? `${profile.totalRounds} rounds × ${cycles} cycles`
      : `Rounds: ${profile.totalRounds}`;
  }
  const cyclePart = cycles > 1 ? `Cycle ${entry.cycle}/${cycles} · ` : '';
  if (entry.kind === 'cycleRest') return `${cyclePart}Cycle rest`;
  return `${cyclePart}Round ${entry.round}/${profile.totalRounds}`;
}

/**
 * The single line shown under the app name in the ongoing-session notification,
 * e.g. "Round 3/20 · Work · 02:14" or "Paused · Get ready".
 *
 * Seconds are rounded up so the notification agrees with the big countdown on
 * screen (which also shows "1" for anything above zero).
 */
export function notificationLine(
  pos: SessionPosition,
  plan: PlanEntry[],
  profile: Profile,
  paused: boolean
): string {
  const prefix = paused ? 'Paused · ' : '';
  if (pos.kind === 'finished') return 'Session complete';
  if (pos.kind === 'countdown') {
    const sec = Math.ceil(pos.remainingMs / 1000);
    return paused ? 'Paused · Get ready' : `Get ready · ${sec}`;
  }
  const entry = plan[pos.entryIndex];
  if (!entry) return `${prefix}Running`;
  const clock = formatMMSS(Math.ceil(pos.remainingMs / 1000));
  const where = positionLabel(entry, profile);
  // A cycle rest already says what it is; a timer needs its own name.
  const what = entry.kind === 'cycleRest' ? '' : `${entry.timerName} · `;
  return `${prefix}${where} · ${what}${clock}`;
}
