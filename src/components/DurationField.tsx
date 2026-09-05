import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radii, spacing } from '../theme';

type Props = {
  valueSec: number;
  onChange: (sec: number) => void;
  minSec?: number;
  /** Quick-pick durations in seconds, rendered as chips under the field. */
  presets?: number[];
  label?: string;
};

const DEFAULT_PRESETS = [30, 60, 90, 120, 180, 300];

function clampSec(sec: number, minSec: number): number {
  if (!Number.isFinite(sec)) return minSec;
  return Math.max(minSec, Math.round(sec));
}

/**
 * Minutes + seconds entry. Everything downstream still stores plain seconds;
 * this only exists so nobody has to type "180" to mean three minutes, which was
 * the single most confusing thing about the old settings screen.
 */
export function DurationField({ valueSec, onChange, minSec = 0, presets, label }: Props) {
  const safe = clampSec(valueSec, minSec);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  const chips = presets ?? DEFAULT_PRESETS;

  const setParts = (m: number, s: number) => onChange(clampSec(m * 60 + s, minSec));

  const bump = (deltaSec: number) => onChange(clampSec(safe + deltaSec, minSec));

  return (
    <View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.row}>
        <Pressable style={styles.stepBtn} onPress={() => bump(-15)}>
          <Text style={styles.stepBtnText}>−15s</Text>
        </Pressable>

        <View style={styles.field}>
          <TextInput
            style={styles.part}
            value={String(minutes)}
            keyboardType="number-pad"
            selectTextOnFocus
            onChangeText={(t) => {
              const m = parseInt(t.replace(/[^0-9]/g, ''), 10);
              setParts(Number.isFinite(m) ? m : 0, seconds);
            }}
          />
          <Text style={styles.colon}>:</Text>
          <TextInput
            style={styles.part}
            value={seconds.toString().padStart(2, '0')}
            keyboardType="number-pad"
            selectTextOnFocus
            onChangeText={(t) => {
              const s = parseInt(t.replace(/[^0-9]/g, ''), 10);
              // Typing "90" in the seconds box rolls into minutes rather than
              // silently clamping — matches how people read a stopwatch.
              setParts(minutes, Number.isFinite(s) ? s : 0);
            }}
          />
        </View>

        <Pressable style={styles.stepBtn} onPress={() => bump(15)}>
          <Text style={styles.stepBtnText}>+15s</Text>
        </Pressable>
      </View>

      {chips.length > 0 ? (
        <View style={styles.chips}>
          {chips.map((c) => {
            const active = c === safe;
            return (
              <Pressable
                key={c}
                onPress={() => onChange(clampSec(c, minSec))}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {c < 60 ? `${c}s` : `${Math.floor(c / 60)}:${(c % 60).toString().padStart(2, '0')}`}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    color: colors.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.sm,
  },
  stepBtnText: { color: colors.textPrimary, fontWeight: '600' },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
  },
  part: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    // Fixed width + minWidth:0 so the web <input> can't claim its intrinsic
    // size and shove the other half of the clock out of the row.
    width: 52,
    minWidth: 0,
    paddingVertical: spacing.xs,
  },
  colon: { color: colors.textMuted, fontSize: 22, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  chip: {
    paddingVertical: 5,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { borderColor: colors.accent, backgroundColor: colors.surfaceAlt },
  chipText: { color: colors.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },
  chipTextActive: { color: colors.accent, fontWeight: '600' },
});
