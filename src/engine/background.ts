import { Profile } from '../types';
import type { CueSchedule } from '../../modules/background-session';
import { notificationLine } from './labels';
import { PlanEntry } from './plan';

/**
 * Flatten a session into the wall-clock schedule the Android foreground service
 * replays: when every phase ends, and what the notification should read while
 * that phase runs.
 *
 * Phase 0 is the pre-countdown; phase i (1-based) is `plan[i - 1]`. The labels
 * are static per phase — the service repaints on boundaries only, so a label
 * shows the phase's full length rather than a ticking countdown.
 *
 * @param anchorMs epoch ms at which the session's pre-countdown started. On
 *   resume this is `now - elapsed`, which is exactly what keeps a resumed
 *   session's boundaries aligned with the ones already played.
 */
export function buildCueSchedule(
  anchorMs: number,
  preCountdownMs: number,
  plan: PlanEntry[],
  profile: Profile
): CueSchedule {
  const boundariesEpochMs: number[] = [];
  const labels: string[] = ['Get ready'];

  let at = anchorMs + preCountdownMs;
  boundariesEpochMs.push(at);
  plan.forEach((entry, index) => {
    labels.push(
      notificationLine(
        { kind: 'running', entryIndex: index, remainingMs: entry.durationSec * 1000 },
        plan,
        profile,
        false
      )
    );
    at += entry.durationSec * 1000;
    boundariesEpochMs.push(at);
  });

  return { startEpochMs: anchorMs, boundariesEpochMs, labels };
}
