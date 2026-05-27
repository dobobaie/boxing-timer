import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Rule, Timer } from '../types';
import { uid } from '../utils/ids';
import { NumberStepper } from './NumberStepper';
import { RuleEditor } from './RuleEditor';
import { colors, radii, spacing } from '../theme';

type Props = {
  timer: Timer;
  onChange: (t: Timer) => void;
  onClose: () => void;
};

export function TimerEditor({ timer, onChange, onClose }: Props) {
  const patch = (p: Partial<Timer>) => onChange({ ...timer, ...p });

  const addRule = () => {
    const r: Rule = {
      id: uid('r_'),
      when: { metric: 'round', op: '>=', value: 2 },
      apply: { op: '+', value: 10 },
      appliesTo: 'previous',
    };
    patch({ rules: [...timer.rules, r] });
  };

  const updateRule = (idx: number, r: Rule) => {
    const next = timer.rules.slice();
    next[idx] = r;
    patch({ rules: next });
  };

  const deleteRule = (idx: number) => {
    patch({ rules: timer.rules.filter((_, i) => i !== idx) });
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={onClose}><Text style={styles.back}>← Done</Text></Pressable>
        <Text style={styles.title}>Edit timer</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={timer.name}
          onChangeText={(v) => patch({ name: v })}
          placeholder="e.g. Fight, Rest"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={styles.label}>Base duration (seconds)</Text>
        <View style={{ alignSelf: 'flex-start' }}>
          <NumberStepper
            value={timer.durationSec}
            onChange={(v) => patch({ durationSec: Math.max(1, Math.round(v)) })}
            min={1}
            step={5}
            suffix="s"
            width={160}
          />
        </View>

        <View style={styles.rulesHeader}>
          <Text style={styles.label}>Rules ({timer.rules.length})</Text>
          <Pressable onPress={addRule} style={styles.addBtn}>
            <Text style={styles.addBtnText}>+ Add rule</Text>
          </Pressable>
        </View>

        {timer.rules.length === 0 ? (
          <Text style={styles.hint}>
            No rules. Add one to make this timer grow or shrink with rounds or elapsed time.
          </Text>
        ) : null}

        {timer.rules.map((r, idx) => (
          <RuleEditor
            key={r.id}
            rule={r}
            onChange={(next) => updateRule(idx, next)}
            onDelete={() => deleteRule(idx)}
          />
        ))}

        <Text style={styles.disclaimer}>
          Rules apply in order. "Previous" means the duration this timer used in its prior round
          (falls back to base for round 1); "Base" always starts from the duration above.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  back: { color: colors.accent, fontSize: 16 },
  title: { color: colors.textPrimary, fontSize: 18, fontWeight: '600' },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  label: {
    color: colors.textMuted,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  input: {
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rulesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  addBtn: {
    backgroundColor: colors.surfaceAlt,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
  },
  addBtnText: { color: colors.accent, fontWeight: '600' },
  hint: { color: colors.textMuted, fontSize: 13, marginTop: spacing.sm },
  disclaimer: { color: colors.textMuted, fontSize: 12, marginTop: spacing.lg, lineHeight: 18 },
});
