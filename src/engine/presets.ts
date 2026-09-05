import { Timer, Trigger } from '../types';
import { uid } from '../utils/ids';
import { formatDuration } from '../utils/format';

/**
 * Progressions are the plain-English face of the trigger state machine.
 *
 * Triggers are powerful but hard to read ("on this timer >= 60 -> then previous
 * - 10 each round"). Almost every real workout is one of four shapes, so the
 * editor offers those shapes directly and compiles them down to triggers;
 * `custom` is the escape hatch that exposes the raw machine again.
 */
export type ProgressionKind = 'fixed' | 'rampUp' | 'rampDown' | 'pyramid' | 'custom';

export type Progression =
  | { kind: 'fixed' }
  /** +step every round, optionally flattening once it reaches `capSec` (0 = no cap). */
  | { kind: 'rampUp'; stepSec: number; capSec: number }
  /** -step every round, optionally flattening once it reaches `floorSec` (0 = no floor). */
  | { kind: 'rampDown'; stepSec: number; floorSec: number }
  /** +step until `peakSec`, then -step back down. */
  | { kind: 'pyramid'; stepSec: number; peakSec: number }
  /** Hand-written triggers and/or rules. */
  | { kind: 'custom' };

export const PROGRESSION_LABELS: Record<ProgressionKind, string> = {
  fixed: 'Same every round',
  rampUp: 'Longer each round',
  rampDown: 'Shorter each round',
  pyramid: 'Pyramid (up then down)',
  custom: 'Custom',
};

function trigger(
  when: Trigger['when'],
  apply: Trigger['apply'],
  appliesTo: Trigger['appliesTo'] = 'previous'
): Trigger {
  return { id: uid('g_'), when, apply, appliesTo };
}

/** Compile a progression into the trigger sequence the engine runs. */
export function progressionToTriggers(p: Progression, existing: Trigger[]): Trigger[] {
  switch (p.kind) {
    case 'fixed':
      return [];
    case 'rampUp': {
      const out = [trigger({ metric: 'round', op: '==', value: 1 }, { op: '+', value: p.stepSec })];
      // "+0 each round" is how the state machine expresses "stop growing here".
      if (p.capSec > 0) {
        out.push(trigger({ metric: 'duration', op: '>=', value: p.capSec }, { op: '+', value: 0 }));
      }
      return out;
    }
    case 'rampDown': {
      const out = [trigger({ metric: 'round', op: '==', value: 1 }, { op: '-', value: p.stepSec })];
      if (p.floorSec > 0) {
        out.push(trigger({ metric: 'duration', op: '<=', value: p.floorSec }, { op: '-', value: 0 }));
      }
      return out;
    }
    case 'pyramid':
      return [
        trigger({ metric: 'round', op: '==', value: 1 }, { op: '+', value: p.stepSec }),
        trigger({ metric: 'duration', op: '>=', value: p.peakSec }, { op: '-', value: p.stepSec }),
      ];
    case 'custom':
      return existing;
  }
}

function isPerRoundStep(t: Trigger | undefined, op: '+' | '-'): boolean {
  return (
    !!t &&
    t.appliesTo === 'previous' &&
    t.when.metric === 'round' &&
    t.when.op === '==' &&
    t.when.value === 1 &&
    t.apply.op === op
  );
}

function isFlattenAt(t: Trigger | undefined, cmp: '>=' | '<=', op: '+' | '-'): boolean {
  return (
    !!t &&
    t.appliesTo === 'previous' &&
    t.when.metric === 'duration' &&
    t.when.op === cmp &&
    t.apply.op === op &&
    t.apply.value === 0
  );
}

/**
 * Recognise which progression a timer's triggers encode, so an existing profile
 * opens on the right preset instead of dumping the user into `custom`.
 * Anything we don't recognise stays `custom` — nothing is silently rewritten.
 */
export function detectProgression(timer: Timer): Progression {
  if ((timer.rules ?? []).length > 0) return { kind: 'custom' };
  const triggers = timer.triggers ?? [];
  if (triggers.length === 0) return { kind: 'fixed' };

  const [t0, t1] = triggers;
  if (triggers.length === 1) {
    if (isPerRoundStep(t0, '+')) return { kind: 'rampUp', stepSec: t0!.apply.value, capSec: 0 };
    if (isPerRoundStep(t0, '-')) return { kind: 'rampDown', stepSec: t0!.apply.value, floorSec: 0 };
    return { kind: 'custom' };
  }

  if (triggers.length === 2) {
    if (isPerRoundStep(t0, '+')) {
      if (
        t1!.appliesTo === 'previous' &&
        t1!.when.metric === 'duration' &&
        t1!.when.op === '>=' &&
        t1!.apply.op === '-' &&
        t1!.apply.value === t0!.apply.value
      ) {
        return { kind: 'pyramid', stepSec: t0!.apply.value, peakSec: t1!.when.value };
      }
      if (isFlattenAt(t1, '>=', '+')) {
        return { kind: 'rampUp', stepSec: t0!.apply.value, capSec: t1!.when.value };
      }
    }
    if (isPerRoundStep(t0, '-') && isFlattenAt(t1, '<=', '-')) {
      return { kind: 'rampDown', stepSec: t0!.apply.value, floorSec: t1!.when.value };
    }
  }

  return { kind: 'custom' };
}

/**
 * Rewrite a timer to follow `p`. Presets own the whole progression, so switching
 * to one drops the stateless rules (they would fight the triggers); switching to
 * `custom` keeps everything so the raw editors open on the current setup.
 */
export function applyProgression(timer: Timer, p: Progression): Timer {
  if (p.kind === 'custom') return timer;
  return { ...timer, triggers: progressionToTriggers(p, timer.triggers ?? []), rules: [] };
}

/** One-line plain-English summary of a timer, for the settings list. */
export function describeTimer(timer: Timer): string {
  const base = formatDuration(timer.durationSec);
  const p = detectProgression(timer);
  switch (p.kind) {
    case 'fixed':
      return `${base}, same every round`;
    case 'rampUp':
      return p.capSec > 0
        ? `${base}, +${p.stepSec}s each round up to ${formatDuration(p.capSec)}`
        : `${base}, +${p.stepSec}s each round`;
    case 'rampDown':
      return p.floorSec > 0
        ? `${base}, −${p.stepSec}s each round down to ${formatDuration(p.floorSec)}`
        : `${base}, −${p.stepSec}s each round`;
    case 'pyramid':
      return `${base}, +${p.stepSec}s up to ${formatDuration(p.peakSec)}, then back down`;
    case 'custom': {
      const t = (timer.triggers ?? []).length;
      const r = (timer.rules ?? []).length;
      const parts = [
        t > 0 ? `${t} trigger${t === 1 ? '' : 's'}` : null,
        r > 0 ? `${r} rule${r === 1 ? '' : 's'}` : null,
      ].filter(Boolean);
      return `${base}, custom (${parts.join(' + ')})`;
    }
  }
}
