import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ComparisonOp, ArithOp, Metric, AppliesTo, RuleCondition, RuleAction } from '../types';
import { NumberStepper } from './NumberStepper';
import { colors, radii, spacing } from '../theme';

const METRIC_OPTIONS: { value: Metric; label: string }[] = [
  { value: 'round', label: 'round' },
  { value: 'duration', label: 'this timer' },
  { value: 'totalTimeSec', label: 'elapsed' },
];
const CMP_OPS: ComparisonOp[] = ['<', '<=', '==', '>=', '>'];
const ARITH_OPS: ArithOp[] = ['+', '-', '*', '/'];
const APPLIES: AppliesTo[] = ['base', 'previous'];

function metricHint(metric: Metric): string {
  switch (metric) {
    case 'round':
      return 'round = the current round number';
    case 'duration':
      return "this timer = this timer's length coming into the round (grows/shrinks as it fires — use this to oscillate)";
    case 'totalTimeSec':
      return 'elapsed = total session seconds so far (only ever increases)';
  }
}

// Rule and Trigger are structurally identical; this editor drives both.
export type RuleLike = {
  id: string;
  when: RuleCondition;
  apply: RuleAction;
  appliesTo: AppliesTo;
};

type Props = {
  value: RuleLike;
  onChange: (next: RuleLike) => void;
  onDelete: () => void;
  title: string;
  whenLabel: string;
  applyLabel: string;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
};

export function ConditionEditor({
  value,
  onChange,
  onDelete,
  title,
  whenLabel,
  applyLabel,
  onMoveUp,
  onMoveDown,
}: Props) {
  const patch = (p: Partial<RuleLike>) => onChange({ ...value, ...p });
  const patchWhen = (p: Partial<RuleCondition>) => onChange({ ...value, when: { ...value.when, ...p } });
  const patchApply = (p: Partial<RuleAction>) => onChange({ ...value, apply: { ...value.apply, ...p } });

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.cardTitle}>{title}</Text>
        <View style={styles.headerActions}>
          {onMoveUp ? (
            <Pressable onPress={onMoveUp}><Text style={styles.move}>↑</Text></Pressable>
          ) : null}
          {onMoveDown ? (
            <Pressable onPress={onMoveDown}><Text style={styles.move}>↓</Text></Pressable>
          ) : null}
          <Pressable onPress={onDelete}>
            <Text style={styles.delete}>delete</Text>
          </Pressable>
        </View>
      </View>

      <Text style={styles.label}>{whenLabel}</Text>
      <View style={styles.row}>
        <Segmented
          options={METRIC_OPTIONS}
          value={value.when.metric}
          onChange={(v) => patchWhen({ metric: v as Metric })}
        />
        <Segmented
          options={CMP_OPS.map((o) => ({ value: o, label: o }))}
          value={value.when.op}
          onChange={(v) => patchWhen({ op: v as ComparisonOp })}
        />
        <NumberStepper
          value={value.when.value}
          onChange={(v) => patchWhen({ value: v })}
          min={0}
          step={value.when.metric === 'round' ? 1 : 10}
        />
      </View>
      <Text style={styles.hint}>{metricHint(value.when.metric)}</Text>

      <Text style={styles.label}>{applyLabel}</Text>
      <View style={styles.row}>
        <Segmented
          options={APPLIES.map((a) => ({ value: a, label: a }))}
          value={value.appliesTo}
          onChange={(v) => patch({ appliesTo: v as AppliesTo })}
        />
        <Segmented
          options={ARITH_OPS.map((o) => ({ value: o, label: o }))}
          value={value.apply.op}
          onChange={(v) => patchApply({ op: v as ArithOp })}
        />
        <NumberStepper
          value={value.apply.value}
          onChange={(v) => patchApply({ value: v })}
          min={0}
          step={value.apply.op === '*' || value.apply.op === '/' ? 0.5 : 1}
        />
      </View>
    </View>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.seg}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            style={[styles.segItem, active && styles.segItemActive]}
            onPress={() => onChange(opt.value)}
          >
            <Text style={[styles.segText, active && styles.segTextActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    marginVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cardTitle: { color: colors.textPrimary, fontWeight: '600' },
  move: { color: colors.textMuted, fontSize: 16 },
  delete: { color: colors.accent },
  label: { color: colors.textMuted, marginTop: spacing.sm, marginBottom: spacing.xs, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  hint: { color: colors.textMuted, fontSize: 11, marginTop: spacing.xs, lineHeight: 15 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  seg: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radii.sm, padding: 2 },
  segItem: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: radii.sm },
  segItemActive: { backgroundColor: colors.accent },
  segText: { color: colors.textMuted, fontSize: 13 },
  segTextActive: { color: colors.textPrimary, fontWeight: '600' },
});
