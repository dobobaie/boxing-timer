export type ComparisonOp = '>' | '<' | '>=' | '<=' | '==';
export type ArithOp = '+' | '-' | '*' | '/';
// 'round'        -> the current round number (1-based, restarts each cycle)
// 'duration'     -> this timer's length coming into the round (previous round's
//                   resolved value, or its base on round 1). Lets a rule react to
//                   the timer's own size, e.g. grow until it reaches 60s then shrink.
// 'totalTimeSec' -> seconds elapsed in the whole session so far (monotonic across cycles).
export type Metric = 'round' | 'duration' | 'totalTimeSec';
export type AppliesTo = 'base' | 'previous';

export type RuleCondition = {
  metric: Metric;
  op: ComparisonOp;
  value: number;
};

export type RuleAction = {
  op: ArithOp;
  value: number;
};

export type Rule = {
  id: string;
  when: RuleCondition;
  apply: RuleAction;
  appliesTo: AppliesTo;
};

// A Trigger is a *stateful, sequential* rule. Triggers on a timer form an
// ordered list of which at most one is active at a time. A trigger activates
// when its `when` condition is met, then applies its `apply` action every round
// until the NEXT trigger in the list activates (which cancels it). Progression
// is strictly forward: trigger N+1 cannot fire until trigger N has activated.
// This expresses a pyramid: T1 "round 1 -> +10" ramps up, then T2 "this timer
// >= 60 -> -10" takes over and ramps down.
export type Trigger = {
  id: string;
  when: RuleCondition;
  apply: RuleAction;
  appliesTo: AppliesTo;
};

export type Timer = {
  id: string;
  name: string;
  durationSec: number;
  rules: Rule[];
  triggers: Trigger[];
};

export type Profile = {
  id: string;
  name: string;
  timers: Timer[];
  /** Rounds inside one cycle. The timer sequence runs once per round. */
  totalRounds: number;
  /**
   * Outer layer: how many times the whole block of `totalRounds` rounds repeats.
   * Each cycle restarts the rule/trigger state, so a pyramid climbs and descends
   * again from the top. 1 = no outer layer (the classic behaviour).
   */
  cycles: number;
  /** Rest inserted between two cycles. Ignored when `cycles` is 1. */
  cycleRestSec: number;
};

export type AppState = {
  profiles: Profile[];
  activeProfileId: string;
  /** Settings screen disclosure level. Off = only the everyday knobs are shown. */
  advanced: boolean;
};
