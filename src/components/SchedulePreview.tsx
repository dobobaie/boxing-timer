import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Profile } from '../types';
import { buildPlan } from '../engine/plan';
import { formatHMS, formatMMSS } from '../utils/format';
import { colors, radii, spacing } from '../theme';

const COLLAPSED_ROUNDS = 6;

/**
 * Transparent, verifiable breakdown of how the total session time is computed:
 * every round, each timer's resolved seconds, and the running total. This is the
 * single source of truth the timer engine also runs from (buildPlan).
 */
export function SchedulePreview({ profile }: { profile: Profile }) {
  const [expanded, setExpanded] = useState(false);
  const plan = useMemo(() => buildPlan(profile), [profile]);

  const rounds = useMemo(() => {
    const byRound = new Map<number, { names: string[]; durations: number[] }>();
    for (const e of plan) {
      const r = byRound.get(e.round) ?? { names: [], durations: [] };
      r.names.push(e.timerName);
      r.durations.push(e.durationSec);
      byRound.set(e.round, r);
    }
    return Array.from(byRound.entries()).map(([round, r]) => ({
      round,
      cells: r.names.map((name, i) => ({ name, sec: r.durations[i]! })),
      roundTotal: r.durations.reduce((s, d) => s + d, 0),
    }));
  }, [plan]);

  const total = plan.reduce((s, e) => s + e.durationSec, 0);
  const shown = expanded ? rounds : rounds.slice(0, COLLAPSED_ROUNDS);
  const hiddenCount = rounds.length - shown.length;

  let running = 0;

  return (
    <View style={styles.wrap}>
      {shown.map((r) => {
        running += r.roundTotal;
        return (
          <View key={r.round} style={styles.roundRow}>
            <Text style={styles.roundNum}>R{r.round}</Text>
            <View style={styles.cells}>
              {r.cells.map((c, i) => (
                <Text key={i} style={styles.cell}>
                  {c.name} <Text style={styles.cellSec}>{c.sec}s</Text>
                </Text>
              ))}
            </View>
            <Text style={styles.runningTotal}>{formatMMSS(running)}</Text>
          </View>
        );
      })}

      {hiddenCount > 0 ? (
        <Pressable onPress={() => setExpanded(true)} style={styles.moreBtn}>
          <Text style={styles.moreText}>Show {hiddenCount} more round{hiddenCount === 1 ? '' : 's'}</Text>
        </Pressable>
      ) : null}
      {expanded && rounds.length > COLLAPSED_ROUNDS ? (
        <Pressable onPress={() => setExpanded(false)} style={styles.moreBtn}>
          <Text style={styles.moreText}>Collapse</Text>
        </Pressable>
      ) : null}

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total session</Text>
        <Text style={styles.totalValue}>{formatHMS(total)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  roundRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  roundNum: { color: colors.textMuted, width: 38, fontVariant: ['tabular-nums'] },
  cells: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cell: { color: colors.textPrimary, fontSize: 13 },
  cellSec: { color: colors.accent, fontVariant: ['tabular-nums'] },
  runningTotal: { color: colors.textMuted, fontVariant: ['tabular-nums'], marginLeft: spacing.sm },
  moreBtn: { paddingVertical: spacing.sm, alignItems: 'center' },
  moreText: { color: colors.accent },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalLabel: { color: colors.textMuted, textTransform: 'uppercase', fontSize: 12, letterSpacing: 1 },
  totalValue: { color: colors.textPrimary, fontWeight: '700', fontSize: 16, fontVariant: ['tabular-nums'] },
});
