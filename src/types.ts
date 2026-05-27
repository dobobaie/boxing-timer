export type ComparisonOp = '>' | '<' | '>=' | '<=' | '==';
export type ArithOp = '+' | '-' | '*' | '/';
// 'round'        -> the current round number (1-based)
// 'duration'     -> this timer's length coming into the round (previous round's
//                   resolved value, or its base on round 1). Lets a rule react to
//                   the timer's own size, e.g. grow until it reaches 60s then shrink.
// 'totalTimeSec' -> seconds elapsed in the whole session so far (monotonic).
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

export type Timer = {
  id: string;
  name: string;
  durationSec: number;
  rules: Rule[];
};

export type Profile = {
  id: string;
  name: string;
  timers: Timer[];
  totalRounds: number;
};

export type AppState = {
  profiles: Profile[];
  activeProfileId: string;
};
