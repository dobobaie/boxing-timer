import { ArithOp, ComparisonOp, Rule, Timer } from '../types';

function compare(lhs: number, op: ComparisonOp, rhs: number): boolean {
  switch (op) {
    case '>':
      return lhs > rhs;
    case '<':
      return lhs < rhs;
    case '>=':
      return lhs >= rhs;
    case '<=':
      return lhs <= rhs;
    case '==':
      return lhs === rhs;
  }
}

function apply(value: number, op: ArithOp, operand: number): number {
  switch (op) {
    case '+':
      return value + operand;
    case '-':
      return value - operand;
    case '*':
      return value * operand;
    case '/':
      return operand === 0 ? value : value / operand;
  }
}

function clamp(value: number, min?: number, max?: number): number {
  let v = value;
  if (typeof min === 'number') v = Math.max(min, v);
  if (typeof max === 'number') v = Math.min(max, v);
  return v;
}

export type ResolveContext = {
  /** 1-based round index. */
  round: number;
  /** Seconds elapsed since the whole session started (excluding pre-countdown). */
  totalTimeSec: number;
  /** Resolved duration for this same timer in the previous round, or undefined for round 1. */
  previousDurationSec?: number;
};

/**
 * Pure function: given a timer's base config and the current context, return the
 * duration (in seconds) this timer should run for. Lives outside React so it
 * can be unit-tested and called from a Plan preview.
 */
export function resolveTimerDuration(timer: Timer, ctx: ResolveContext): number {
  const base = timer.durationSec;
  let running = base;
  for (const rule of timer.rules) {
    const lhs = rule.when.metric === 'round' ? ctx.round : ctx.totalTimeSec;
    if (!compare(lhs, rule.when.op, rule.when.value)) continue;

    if (rule.appliesTo === 'previous' && ctx.previousDurationSec === undefined) {
      // No previous round for this timer yet — rule is a no-op on the first round.
      continue;
    }
    const source =
      rule.appliesTo === 'previous' ? (ctx.previousDurationSec as number) : base;
    const next = apply(source, rule.apply.op, rule.apply.value);
    running = clamp(next, rule.min, rule.max);
  }
  return Math.max(1, Math.round(running));
}

export function describeRule(rule: Rule): string {
  const when = `when ${rule.when.metric === 'round' ? 'round' : 'total time'} ${rule.when.op} ${rule.when.value}${rule.when.metric === 'totalTimeSec' ? 's' : ''}`;
  const base = rule.appliesTo === 'previous' ? 'previous' : 'base';
  const action = `${base} ${rule.apply.op} ${rule.apply.value}`;
  const clampParts: string[] = [];
  if (typeof rule.min === 'number') clampParts.push(`min ${rule.min}`);
  if (typeof rule.max === 'number') clampParts.push(`max ${rule.max}`);
  const clampStr = clampParts.length ? ` (${clampParts.join(', ')})` : '';
  return `${when} -> ${action}${clampStr}`;
}
