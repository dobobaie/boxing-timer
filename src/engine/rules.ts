import { ArithOp, ComparisonOp, Metric, Rule, RuleCondition, Timer, Trigger } from '../types';

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

export type ResolveContext = {
  /** 1-based round index. */
  round: number;
  /** Seconds elapsed since the whole session started (excluding pre-countdown). */
  totalTimeSec: number;
  /** Resolved duration for this same timer in the previous round, or undefined for round 1. */
  previousDurationSec?: number;
  /**
   * Index of this timer's currently-active trigger, carried across rounds.
   * -1 means no trigger has activated yet. resolveTimer returns the updated value.
   */
  activeTriggerIndex: number;
};

export type ResolveResult = {
  durationSec: number;
  /** The trigger index active after this round — feed back in as ctx.activeTriggerIndex next round. */
  activeTriggerIndex: number;
};

/** Value a condition's `metric` resolves to in the current context. */
function metricValue(metric: Metric, ctx: ResolveContext, incoming: number): number {
  switch (metric) {
    case 'round':
      return ctx.round;
    case 'duration':
      return incoming;
    case 'totalTimeSec':
      return ctx.totalTimeSec;
  }
}

function conditionMet(cond: RuleCondition, ctx: ResolveContext, incoming: number): boolean {
  return compare(metricValue(cond.metric, ctx, incoming), cond.op, cond.value);
}

/**
 * Resolve a timer's duration for one round, given the carry-over context.
 *
 * Two independent effect sources, applied in order:
 *  1. Rules — stateless: every matching rule is re-evaluated this round; the last
 *     match wins (each writes from base or the previous value, not chained).
 *  2. Triggers — a stateful, ordered state machine: at most one active at a time.
 *     We advance the active pointer forward while the NEXT trigger's condition is
 *     met (never skipping — trigger N+1 requires N to have activated first). The
 *     active trigger's action then applies every round until the next one fires.
 *     A trigger, once active, overrides the rules' result for that round.
 *
 * Pure: takes the carried activeTriggerIndex in and returns the updated one out,
 * so buildPlan can thread it across rounds and the function stays unit-testable.
 */
export function resolveTimer(timer: Timer, ctx: ResolveContext): ResolveResult {
  const base = timer.durationSec;
  // The timer's length coming into this round: previous round's value, or base on
  // round 1. Backs the 'duration' metric so a rule/trigger can react to the timer's
  // own size (e.g. grow until it reaches 60s then shrink — an oscillation that
  // 'totalTimeSec' can't express because session time only ever increases).
  const incoming = ctx.previousDurationSec ?? base;
  const firstRound = ctx.previousDurationSec === undefined;
  let running = base;

  // 1) Stateless rules.
  for (const rule of timer.rules) {
    if (!conditionMet(rule.when, ctx, incoming)) continue;
    if (rule.appliesTo === 'previous' && firstRound) continue;
    const source = rule.appliesTo === 'previous' ? incoming : base;
    running = apply(source, rule.apply.op, rule.apply.value);
  }

  // 2) Sequential triggers. (triggers may be absent on profiles persisted before
  // this feature existed — treat as none.)
  const triggers = timer.triggers ?? [];
  let active = ctx.activeTriggerIndex;
  while (active + 1 < triggers.length) {
    const next = triggers[active + 1]!;
    if (conditionMet(next.when, ctx, incoming)) active++;
    else break;
  }
  if (active >= 0 && active < triggers.length) {
    const trig = triggers[active]!;
    if (!(trig.appliesTo === 'previous' && firstRound)) {
      const source = trig.appliesTo === 'previous' ? incoming : base;
      running = apply(source, trig.apply.op, trig.apply.value);
    }
  }

  return { durationSec: Math.max(1, Math.round(running)), activeTriggerIndex: active };
}

function describeCondition(cond: RuleCondition): string {
  const metricLabel =
    cond.metric === 'round' ? 'round' : cond.metric === 'duration' ? 'this timer' : 'elapsed';
  const unit = cond.metric === 'round' ? '' : 's';
  return `${metricLabel} ${cond.op} ${cond.value}${unit}`;
}

export function describeRule(rule: Rule): string {
  const base = rule.appliesTo === 'previous' ? 'previous' : 'base';
  return `when ${describeCondition(rule.when)} -> ${base} ${rule.apply.op} ${rule.apply.value}`;
}

export function describeTrigger(trigger: Trigger): string {
  const base = trigger.appliesTo === 'previous' ? 'previous' : 'base';
  return `on ${describeCondition(trigger.when)} -> then ${base} ${trigger.apply.op} ${trigger.apply.value} each round`;
}
