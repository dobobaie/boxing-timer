export type ComparisonOp = '>' | '<' | '>=' | '<=' | '==';
export type ArithOp = '+' | '-' | '*' | '/';
export type Metric = 'round' | 'totalTimeSec';
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
  min?: number;
  max?: number;
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
