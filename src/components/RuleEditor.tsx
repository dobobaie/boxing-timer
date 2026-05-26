import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Rule, ComparisonOp, ArithOp, Metric, AppliesTo } from '../types';
import { NumberStepper } from './NumberStepper';
import { colors, radii, spacing } from '../theme';

const METRICS: Metric[] = ['round', 'totalTimeSec'];
const CMP_OPS: ComparisonOp[] = ['<', '<=', '==', '>=', '>'];
const ARITH_OPS: ArithOp[] = ['+', '-', '*', '/'];
const APPLIES: AppliesTo[] = ['base', 'previous'];

type Props = {
  rule: Rule;
  onChange: (r: Rule) => void;
  onDelete: () => void;
};

export function RuleEditor({ rule, onChange, onDelete }: Props) {
  const patch = (p: Partial<Rule>) => onChange({ ...rule, ...p });
  const patchWhen = (p: Partial<Rule['when']>) => onChange({ ...rule, when: { ...rule.when, ...p } });
  const patchApply = (p: Partial<Rule['apply']>) => onChange({ ...rule, apply: { ...rule.apply, ...p } });

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.cardTitle}>Rule</Text>
        <Pressable onPress={onDelete}>
          <Text style={styles.delete}>delete</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>When</Text>
      <View style={styles.row}>
        <Segmented
          options={METRICS.map((m) => ({ value: m, label: m === 'round' ? 'round' : 'total s' }))}
          value={rule.when.metric}
          onChange={(v) => patchWhen({ metric: v as Metric })}
        />
        <Segmented
          options={CMP_OPS.map((o) => ({ value: o, label: o }))}
          value={rule.when.op}
          onChange={(v) => patchWhen({ op: v as ComparisonOp })}
        />
        <NumberStepper
          value={rule.when.value}
          onChange={(v) => patchWhen({ value: v })}
          min={0}
          step={rule.when.metric === 'round' ? 1 : 10}
        />
      </View>

      <Text style={styles.label}>Apply</Text>
      <View style={styles.row}>
        <Segmented
          options={APPLIES.map((a) => ({ value: a, label: a }))}
          value={rule.appliesTo}
          onChange={(v) => patch({ appliesTo: v as AppliesTo })}
        />
        <Segmented
          options={ARITH_OPS.map((o) => ({ value: o, label: o }))}
          value={rule.apply.op}
          onChange={(v) => patchApply({ op: v as ArithOp })}
        />
        <NumberStepper
          value={rule.apply.value}
          onChange={(v) => patchApply({ value: v })}
          min={0}
          step={rule.apply.op === '*' || rule.apply.op === '/' ? 0.5 : 1}
        />
      </View>

      <Text style={styles.label}>Clamp (optional)</Text>
      <View style={styles.row}>
        <Text style={styles.inline}>min</Text>
        <NumberStepper
          value={rule.min ?? 0}
          onChange={(v) => patch({ min: v })}
          min={0}
          step={1}
          width={100}
        />
        {typeof rule.min === 'number' ? (
          <Pressable onPress={() => patch({ min: undefined })}>
            <Text style={styles.clear}>×</Text>
          </Pressable>
        ) : null}
        <Text style={styles.inline}>max</Text>
        <NumberStepper
          value={rule.max ?? 60}
          onChange={(v) => patch({ max: v })}
          min={0}
          step={1}
          width={100}
        />
        {typeof rule.max === 'number' ? (
          <Pressable onPress={() => patch({ max: undefined })}>
            <Text style={styles.clear}>×</Text>
          </Pressable>
        ) : null}
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
  cardTitle: { color: colors.textPrimary, fontWeight: '600' },
  delete: { color: colors.accent },
  label: { color: colors.textMuted, marginTop: spacing.sm, marginBottom: spacing.xs, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  inline: { color: colors.textMuted },
  clear: { color: colors.accent, paddingHorizontal: spacing.sm, fontSize: 16 },
  seg: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radii.sm, padding: 2 },
  segItem: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: radii.sm },
  segItemActive: { backgroundColor: colors.accent },
  segText: { color: colors.textMuted, fontSize: 13 },
  segTextActive: { color: colors.textPrimary, fontWeight: '600' },
});
