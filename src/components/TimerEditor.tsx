import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Rule, Timer, Trigger } from '../types';
import { uid } from '../utils/ids';
import { NumberStepper } from './NumberStepper';
import { ConditionEditor } from './ConditionEditor';
import { colors, radii, spacing } from '../theme';

type Props = {
  timer: Timer;
  onChange: (t: Timer) => void;
  onClose: () => void;
};

export function TimerEditor({ timer, onChange, onClose }: Props) {
  const patch = (p: Partial<Timer>) => onChange({ ...timer, ...p });
  const triggers = timer.triggers ?? [];
  const [rulesOpen, setRulesOpen] = useState(false);
  const [triggersOpen, setTriggersOpen] = useState(triggers.length > 0);

  // --- rules (stateless) ---
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
  const deleteRule = (idx: number) => patch({ rules: timer.rules.filter((_, i) => i !== idx) });

  // --- triggers (sequential state machine) ---
  const addTrigger = () => {
    const t: Trigger = {
      id: uid('g_'),
      when: triggers.length === 0
        ? { metric: 'round', op: '==', value: 1 }
        : { metric: 'duration', op: '>=', value: 60 },
      apply: { op: triggers.length === 0 ? '+' : '-', value: 10 },
      appliesTo: 'previous',
    };
    patch({ triggers: [...triggers, t] });
  };
  const updateTrigger = (idx: number, t: Trigger) => {
    const next = triggers.slice();
    next[idx] = t;
    patch({ triggers: next });
  };
  const deleteTrigger = (idx: number) => patch({ triggers: triggers.filter((_, i) => i !== idx) });
  const moveTrigger = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= triggers.length) return;
    const next = triggers.slice();
    [next[idx], next[j]] = [next[j]!, next[idx]!];
    patch({ triggers: next });
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

        {/* Triggers --------------------------------------------------------- */}
        <SectionHeader
          label={`Triggers (${triggers.length})`}
          open={triggersOpen}
          onToggle={() => setTriggersOpen((o) => !o)}
          onAdd={addTrigger}
        />
        {triggersOpen ? (
          <>
            <Text style={styles.sectionHint}>
              A sequence: only one trigger is active at a time. The active one applies its action
              every round until the next trigger's condition is met (which takes over). Order matters —
              trigger 2 can't fire before trigger 1. Great for pyramids.
            </Text>
            {triggers.length === 0 ? (
              <Text style={styles.hint}>No triggers. Add one to start a sequence.</Text>
            ) : null}
            {triggers.map((t, idx) => (
              <ConditionEditor
                key={t.id}
                title={`Trigger ${idx + 1}`}
                whenLabel="Activate on"
                applyLabel="Then, each round"
                value={t}
                onChange={(next) => updateTrigger(idx, next as Trigger)}
                onDelete={() => deleteTrigger(idx)}
                onMoveUp={idx > 0 ? () => moveTrigger(idx, -1) : undefined}
                onMoveDown={idx < triggers.length - 1 ? () => moveTrigger(idx, 1) : undefined}
              />
            ))}
          </>
        ) : null}

        {/* Rules ------------------------------------------------------------ */}
        <SectionHeader
          label={`Rules (${timer.rules.length})`}
          open={rulesOpen}
          onToggle={() => setRulesOpen((o) => !o)}
          onAdd={addRule}
        />
        {rulesOpen ? (
          <>
            <Text style={styles.sectionHint}>
              Stateless: every matching rule is re-checked each round (last match wins). Use for
              simple "if round/elapsed/this-timer is X, set duration" adjustments.
            </Text>
            {timer.rules.length === 0 ? (
              <Text style={styles.hint}>No rules.</Text>
            ) : null}
            {timer.rules.map((r, idx) => (
              <ConditionEditor
                key={r.id}
                title="Rule"
                whenLabel="When"
                applyLabel="Set duration to"
                value={r}
                onChange={(next) => updateRule(idx, next as Rule)}
                onDelete={() => deleteRule(idx)}
              />
            ))}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function SectionHeader({
  label,
  open,
  onToggle,
  onAdd,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  onAdd: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Pressable style={styles.sectionToggle} onPress={onToggle}>
        <Text style={styles.sectionCaret}>{open ? '▾' : '▸'}</Text>
        <Text style={styles.sectionTitle}>{label}</Text>
      </Pressable>
      <Pressable onPress={onAdd} style={styles.addBtn}>
        <Text style={styles.addBtnText}>+ Add</Text>
      </Pressable>
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  sectionToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  sectionCaret: { color: colors.textMuted, fontSize: 14, width: 16 },
  sectionTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
  sectionHint: { color: colors.textMuted, fontSize: 12, marginTop: spacing.sm, lineHeight: 17 },
  addBtn: {
    backgroundColor: colors.surfaceAlt,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
  },
  addBtnText: { color: colors.accent, fontWeight: '600' },
  hint: { color: colors.textMuted, fontSize: 13, marginTop: spacing.sm },
});
