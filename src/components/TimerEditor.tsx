import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Rule, Timer, Trigger } from '../types';
import { uid } from '../utils/ids';
import { formatDuration } from '../utils/format';
import { resolveTimer } from '../engine/rules';
import {
  applyProgression,
  detectProgression,
  Progression,
  ProgressionKind,
  PROGRESSION_LABELS,
} from '../engine/presets';
import { NumberStepper } from './NumberStepper';
import { DurationField } from './DurationField';
import { ConditionEditor } from './ConditionEditor';
import { Segmented } from './Segmented';
import { colors, radii, spacing } from '../theme';

type Props = {
  timer: Timer;
  /** How many rounds the profile runs — drives the live preview. */
  rounds: number;
  advanced: boolean;
  onChange: (t: Timer) => void;
  onClose: () => void;
};

const PROGRESSION_ORDER: ProgressionKind[] = ['fixed', 'rampUp', 'rampDown', 'pyramid', 'custom'];

const PROGRESSION_HINTS: Record<ProgressionKind, string> = {
  fixed: 'Every round of this timer lasts exactly the same.',
  rampUp: 'Each round is a bit longer than the one before.',
  rampDown: 'Each round is a bit shorter than the one before.',
  pyramid: 'Rounds get longer up to a peak, then shorten back down.',
  custom: 'Hand-built triggers and rules. Full control, no guardrails.',
};

/** Defaults used when switching preset, so the new shape is immediately sensible. */
function seedProgression(kind: ProgressionKind, timer: Timer, current: Progression): Progression {
  const step = 'stepSec' in current ? current.stepSec : 10;
  switch (kind) {
    case 'fixed':
      return { kind: 'fixed' };
    case 'rampUp':
      return { kind: 'rampUp', stepSec: step, capSec: 'peakSec' in current ? current.peakSec : 0 };
    case 'rampDown':
      return { kind: 'rampDown', stepSec: step, floorSec: 0 };
    case 'pyramid':
      return {
        kind: 'pyramid',
        stepSec: step,
        peakSec: 'capSec' in current && current.capSec > 0 ? current.capSec : timer.durationSec * 3,
      };
    case 'custom':
      return { kind: 'custom' };
  }
}

export function TimerEditor({ timer, rounds, advanced, onChange, onClose }: Props) {
  const patch = (p: Partial<Timer>) => onChange({ ...timer, ...p });
  const triggers = timer.triggers ?? [];
  const progression = useMemo(() => detectProgression(timer), [timer]);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [triggersOpen, setTriggersOpen] = useState(triggers.length > 0);

  const setProgression = (p: Progression) => onChange(applyProgression(timer, p));

  // Live preview of the resolved durations, computed with the same function the
  // engine uses — so what the editor promises is what the session runs.
  const preview = useMemo(() => {
    const out: number[] = [];
    let previousDurationSec: number | undefined;
    let activeTriggerIndex = -1;
    let totalTimeSec = 0;
    for (let round = 1; round <= Math.min(Math.max(1, rounds), 12); round++) {
      const res = resolveTimer(timer, {
        round,
        totalTimeSec,
        previousDurationSec,
        activeTriggerIndex,
      });
      out.push(res.durationSec);
      previousDurationSec = res.durationSec;
      activeTriggerIndex = res.activeTriggerIndex;
      totalTimeSec += res.durationSec;
    }
    return out;
  }, [timer, rounds]);

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
      when:
        triggers.length === 0
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
    // A modal is its own window, outside the SafeAreaView App.tsx wraps the
    // screens in, so it has to keep clear of the status and navigation bars
    // itself — otherwise "Done" sits under the clock and the signal icons.
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={12}>
          <Text style={styles.back}>← Done</Text>
        </Pressable>
        <Text style={styles.title}>Edit timer</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={timer.name}
            onChangeText={(v) => patch({ name: v })}
            placeholder="e.g. Fight, Rest"
            placeholderTextColor={colors.textMuted}
          />

          <View style={styles.spacer} />
          <DurationField
            label="Length"
            valueSec={timer.durationSec}
            minSec={1}
            onChange={(sec) => patch({ durationSec: sec })}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>How it changes each round</Text>
          <Segmented
            options={PROGRESSION_ORDER.map((k) => ({ value: k, label: PROGRESSION_LABELS[k] }))}
            value={progression.kind}
            onChange={(k) => setProgression(seedProgression(k, timer, progression))}
            wrap
          />
          <Text style={styles.hint}>{PROGRESSION_HINTS[progression.kind]}</Text>

          {progression.kind === 'rampUp' ? (
            <>
              <ParamRow
                label="Add each round"
                value={progression.stepSec}
                suffix="s"
                min={1}
                onChange={(v) => setProgression({ ...progression, stepSec: v })}
              />
              <ParamRow
                label="Stop growing at"
                value={progression.capSec}
                suffix="s"
                min={0}
                step={10}
                zeroLabel="no limit"
                onChange={(v) => setProgression({ ...progression, capSec: v })}
              />
            </>
          ) : null}

          {progression.kind === 'rampDown' ? (
            <>
              <ParamRow
                label="Remove each round"
                value={progression.stepSec}
                suffix="s"
                min={1}
                onChange={(v) => setProgression({ ...progression, stepSec: v })}
              />
              <ParamRow
                label="Stop shrinking at"
                value={progression.floorSec}
                suffix="s"
                min={0}
                step={10}
                zeroLabel="no limit"
                onChange={(v) => setProgression({ ...progression, floorSec: v })}
              />
            </>
          ) : null}

          {progression.kind === 'pyramid' ? (
            <>
              <ParamRow
                label="Step each round"
                value={progression.stepSec}
                suffix="s"
                min={1}
                onChange={(v) => setProgression({ ...progression, stepSec: v })}
              />
              <ParamRow
                label="Peak length"
                value={progression.peakSec}
                suffix="s"
                min={1}
                step={10}
                onChange={(v) => setProgression({ ...progression, peakSec: v })}
              />
            </>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Preview</Text>
          <View style={styles.previewRow}>
            {preview.map((sec, i) => (
              <View key={i} style={styles.previewCell}>
                <Text style={styles.previewRound}>R{i + 1}</Text>
                <Text style={styles.previewSec}>{formatDuration(sec)}</Text>
              </View>
            ))}
            {rounds > preview.length ? <Text style={styles.previewMore}>…</Text> : null}
          </View>
        </View>

        {advanced || progression.kind === 'custom' ? (
          <>
            <Text style={styles.advancedBanner}>
              Advanced — the raw state machine behind the presets. Editing these switches the
              preset above to "Custom".
            </Text>

            {/* Triggers ------------------------------------------------------- */}
            <SectionHeader
              label={`Triggers (${triggers.length})`}
              open={triggersOpen}
              onToggle={() => setTriggersOpen((o) => !o)}
              onAdd={addTrigger}
            />
            {triggersOpen ? (
              <>
                <Text style={styles.sectionHint}>
                  A sequence: only one trigger is active at a time. The active one applies its
                  action every round until the next trigger's condition is met (which takes over).
                  Order matters — trigger 2 can't fire before trigger 1.
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

            {/* Rules ---------------------------------------------------------- */}
            <SectionHeader
              label={`Rules (${timer.rules.length})`}
              open={rulesOpen}
              onToggle={() => setRulesOpen((o) => !o)}
              onAdd={addRule}
            />
            {rulesOpen ? (
              <>
                <Text style={styles.sectionHint}>
                  Stateless: every matching rule is re-checked each round (last match wins). Use
                  for simple "if round/elapsed/this-timer is X, set duration" adjustments.
                </Text>
                {timer.rules.length === 0 ? <Text style={styles.hint}>No rules.</Text> : null}
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
          </>
        ) : (
          <Text style={styles.advancedNote}>
            Need something the presets can't express? Turn on Advanced in Settings to edit
            triggers and rules directly.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ParamRow({
  label,
  value,
  onChange,
  min,
  step = 5,
  suffix,
  zeroLabel,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  step?: number;
  suffix?: string;
  /** Shown instead of the number when the value is 0 (used for "no limit"). */
  zeroLabel?: string;
}) {
  return (
    <View style={styles.paramRow}>
      <View style={styles.paramLabelWrap}>
        <Text style={styles.paramLabel}>{label}</Text>
        {zeroLabel && value === 0 ? <Text style={styles.paramZero}>{zeroLabel}</Text> : null}
      </View>
      <NumberStepper
        value={value}
        onChange={(v) => onChange(Math.max(min ?? 0, Math.round(v)))}
        min={min}
        step={step}
        suffix={suffix}
        width={140}
      />
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
    // On top of the safe-area inset: enough of a gap that the title and the
    // tap targets read as their own bar rather than as part of the status bar.
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  back: { color: colors.accent, fontSize: 16 },
  title: { color: colors.textPrimary, fontSize: 18, fontWeight: '600' },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  spacer: { height: spacing.md },
  label: {
    color: colors.textMuted,
    marginBottom: spacing.xs,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    color: colors.textPrimary,
    padding: spacing.md,
    borderRadius: radii.sm,
  },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: spacing.sm, lineHeight: 17 },
  paramRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  paramLabelWrap: { flex: 1, paddingRight: spacing.sm },
  paramLabel: { color: colors.textPrimary },
  paramZero: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  previewRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  previewCell: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    minWidth: 54,
  },
  previewRound: { color: colors.textMuted, fontSize: 10 },
  previewSec: { color: colors.accent, fontWeight: '600', fontVariant: ['tabular-nums'] },
  previewMore: { color: colors.textMuted, fontSize: 18 },
  advancedBanner: {
    color: colors.warn,
    fontSize: 12,
    lineHeight: 17,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  advancedNote: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: spacing.sm },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
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
});
