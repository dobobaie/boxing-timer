import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Profile } from '../types';
import { buildPlan, profileCycles } from '../engine/plan';
import { formatHMS, formatMMSS } from '../utils/format';
import { colors, radii, spacing } from '../theme';

const COLLAPSED_ROWS = 8;

type Row =
  | { kind: 'round'; cycle: number; round: number; cells: { name: string; sec: number }[]; sec: number }
  | { kind: 'cycleRest'; cycle: number; sec: number };

/**
 * Transparent, verifiable breakdown of how the total session time is computed:
 * every round, each timer's resolved seconds, and the running total. This is the
 * single source of truth the timer engine also runs from (buildPlan).
 */
export function SchedulePreview({ profile }: { profile: Profile }) {
  const [expanded, setExpanded] = useState(false);
  const plan = useMemo(() => buildPlan(profile), [profile]);
  const cycles = profileCycles(profile);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    let current: Extract<Row, { kind: 'round' }> | null = null;
    for (const e of plan) {
      if (e.kind === 'cycleRest') {
        current = null;
        out.push({ kind: 'cycleRest', cycle: e.cycle, sec: e.durationSec });
        continue;
      }
      if (!current || current.cycle !== e.cycle || current.round !== e.round) {
        current = { kind: 'round', cycle: e.cycle, round: e.round, cells: [], sec: 0 };
        out.push(current);
      }
      current.cells.push({ name: e.timerName, sec: e.durationSec });
      current.sec += e.durationSec;
    }
    return out;
  }, [plan]);

  const total = plan.reduce((s, e) => s + e.durationSec, 0);
  const shown = expanded ? rows : rows.slice(0, COLLAPSED_ROWS);
  const hiddenCount = rows.length - shown.length;

  let running = 0;

  return (
    <View style={styles.wrap}>
      {shown.map((r, i) => {
        running += r.sec;
        if (r.kind === 'cycleRest') {
          return (
            <View key={`rest-${i}`} style={[styles.roundRow, styles.restRow]}>
              <Text style={styles.roundNum}>—</Text>
              <Text style={styles.restLabel}>
                Rest before cycle {r.cycle + 1} <Text style={styles.cellSec}>{r.sec}s</Text>
              </Text>
              <Text style={styles.runningTotal}>{formatMMSS(running)}</Text>
            </View>
          );
        }
        return (
          <View key={`r-${i}`} style={styles.roundRow}>
            <Text style={styles.roundNum}>
              {cycles > 1 ? `C${r.cycle}·R${r.round}` : `R${r.round}`}
            </Text>
            <View style={styles.cells}>
              {r.cells.map((c, j) => (
                <Text key={j} style={styles.cell}>
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
          <Text style={styles.moreText}>Show {hiddenCount} more row{hiddenCount === 1 ? '' : 's'}</Text>
        </Pressable>
      ) : null}
      {expanded && rows.length > COLLAPSED_ROWS ? (
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
  restRow: { backgroundColor: colors.surfaceAlt },
  roundNum: { color: colors.textMuted, width: 62, fontSize: 12, fontVariant: ['tabular-nums'] },
  cells: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cell: { color: colors.textPrimary, fontSize: 13 },
  cellSec: { color: colors.accent, fontVariant: ['tabular-nums'] },
  restLabel: { flex: 1, color: colors.textMuted, fontSize: 13, fontStyle: 'italic' },
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
