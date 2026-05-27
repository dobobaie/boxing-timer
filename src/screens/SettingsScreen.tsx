import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Profile, Timer } from '../types';
import { uid } from '../utils/ids';
import { planTotalSeconds } from '../engine/plan';
import { describeRule } from '../engine/rules';
import { formatHMS } from '../utils/format';
import { NumberStepper } from '../components/NumberStepper';
import { TimerEditor } from '../components/TimerEditor';
import { ProfileManager } from '../components/ProfileManager';
import { SchedulePreview } from '../components/SchedulePreview';
import { colors, radii, spacing } from '../theme';

type Props = {
  profiles: Profile[];
  activeProfileId: string;
  onChangeProfile: (p: Profile) => void;
  onSwitchProfile: (id: string) => void;
  onCreateProfileFromCurrent: (name: string) => void;
  onRenameProfile: (id: string, name: string) => void;
  onDeleteProfile: (id: string) => void;
  onBack: () => void;
};

export function SettingsScreen(props: Props) {
  const {
    profiles,
    activeProfileId,
    onChangeProfile,
    onSwitchProfile,
    onCreateProfileFromCurrent,
    onRenameProfile,
    onDeleteProfile,
    onBack,
  } = props;

  const profile = useMemo(
    () => profiles.find((p) => p.id === activeProfileId) ?? profiles[0]!,
    [profiles, activeProfileId]
  );
  const [editingTimerId, setEditingTimerId] = useState<string | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const total = useMemo(() => planTotalSeconds(profile), [profile]);

  const patchProfile = (p: Partial<Profile>) => onChangeProfile({ ...profile, ...p });

  const addTimer = () => {
    const t: Timer = { id: uid('t_'), name: `Timer ${profile.timers.length + 1}`, durationSec: 60, rules: [] };
    patchProfile({ timers: [...profile.timers, t] });
  };

  const duplicateTimer = (id: string) => {
    const idx = profile.timers.findIndex((t) => t.id === id);
    if (idx === -1) return;
    const src = profile.timers[idx]!;
    const copy: Timer = {
      ...src,
      id: uid('t_'),
      name: `${src.name} copy`,
      rules: src.rules.map((r) => ({ ...r, id: uid('r_') })),
    };
    const next = profile.timers.slice();
    next.splice(idx + 1, 0, copy);
    patchProfile({ timers: next });
  };

  const removeTimer = (id: string) => {
    if (profile.timers.length <= 1) return; // min 1 enforced
    patchProfile({ timers: profile.timers.filter((t) => t.id !== id) });
  };

  const moveTimer = (id: string, dir: -1 | 1) => {
    const idx = profile.timers.findIndex((t) => t.id === id);
    const newIdx = idx + dir;
    if (idx < 0 || newIdx < 0 || newIdx >= profile.timers.length) return;
    const next = profile.timers.slice();
    [next[idx], next[newIdx]] = [next[newIdx]!, next[idx]!];
    patchProfile({ timers: next });
  };

  const updateTimer = (id: string, updater: (t: Timer) => Timer) => {
    patchProfile({ timers: profile.timers.map((t) => (t.id === id ? updater(t) : t)) });
  };

  const editingTimer = profile.timers.find((t) => t.id === editingTimerId) ?? null;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={onBack}><Text style={styles.back}>← Back</Text></Pressable>
        <Text style={styles.title}>Settings</Text>
        <Pressable onPress={() => setProfileModalOpen(true)}>
          <Text style={styles.profileBtn}>Profiles</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.profilePill}>
          <Text style={styles.profilePillLabel}>Profile</Text>
          <Text style={styles.profilePillName}>{profile.name}</Text>
          <Text style={styles.profilePillTotal}>Total {formatHMS(total)}</Text>
        </View>

        <Text style={styles.section}>Rounds</Text>
        <View style={styles.roundsRow}>
          <Text style={styles.bodyText}>Total rounds</Text>
          <NumberStepper
            value={profile.totalRounds}
            onChange={(v) => patchProfile({ totalRounds: Math.max(1, Math.round(v)) })}
            min={1}
            step={1}
            width={130}
          />
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.section}>Timers</Text>
          <Pressable onPress={addTimer} style={styles.addBtn}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </Pressable>
        </View>

        {profile.timers.map((t, idx) => (
          <View key={t.id} style={styles.timerCard}>
            <View style={styles.timerCardHeader}>
              <Pressable style={{ flex: 1 }} onPress={() => setEditingTimerId(t.id)}>
                <Text style={styles.timerName}>{t.name}</Text>
                <Text style={styles.timerMeta}>
                  {t.durationSec}s · {t.rules.length} rule{t.rules.length === 1 ? '' : 's'}
                </Text>
              </Pressable>
              <View style={styles.timerActions}>
                <Pressable onPress={() => moveTimer(t.id, -1)} disabled={idx === 0}>
                  <Text style={[styles.timerAction, idx === 0 && styles.timerActionDisabled]}>↑</Text>
                </Pressable>
                <Pressable onPress={() => moveTimer(t.id, 1)} disabled={idx === profile.timers.length - 1}>
                  <Text style={[styles.timerAction, idx === profile.timers.length - 1 && styles.timerActionDisabled]}>↓</Text>
                </Pressable>
                <Pressable onPress={() => duplicateTimer(t.id)}>
                  <Text style={styles.timerAction}>copy</Text>
                </Pressable>
                <Pressable onPress={() => removeTimer(t.id)} disabled={profile.timers.length <= 1}>
                  <Text style={[styles.timerAction, styles.timerActionDanger, profile.timers.length <= 1 && styles.timerActionDisabled]}>×</Text>
                </Pressable>
              </View>
            </View>
            {t.rules.length > 0 ? (
              <View style={styles.ruleSummary}>
                {t.rules.map((r) => (
                  <Text key={r.id} style={styles.ruleSummaryLine}>• {describeRule(r)}</Text>
                ))}
              </View>
            ) : null}
          </View>
        ))}

        <Text style={styles.disclaimer}>
          Tap a timer name to edit its duration and rules. Add rules to grow/shrink durations
          based on the round number, the timer's own length, or total elapsed time.
        </Text>

        <Text style={styles.section}>Schedule</Text>
        <SchedulePreview profile={profile} />
      </ScrollView>

      <Modal visible={editingTimer !== null} animationType="slide" onRequestClose={() => setEditingTimerId(null)}>
        {editingTimer ? (
          <TimerEditor
            timer={editingTimer}
            onChange={(next) => updateTimer(editingTimer.id, () => next)}
            onClose={() => setEditingTimerId(null)}
          />
        ) : null}
      </Modal>

      <ProfileManager
        visible={profileModalOpen}
        profiles={profiles}
        activeProfileId={activeProfileId}
        onClose={() => setProfileModalOpen(false)}
        onSelect={(id) => {
          onSwitchProfile(id);
          setProfileModalOpen(false);
        }}
        onCreateFromCurrent={onCreateProfileFromCurrent}
        onRename={onRenameProfile}
        onDelete={onDeleteProfile}
      />
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
  profileBtn: { color: colors.accent },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  profilePill: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  profilePillLabel: { color: colors.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
  profilePillName: { color: colors.textPrimary, fontSize: 20, fontWeight: '600', marginTop: 2 },
  profilePillTotal: { color: colors.textMuted, marginTop: spacing.xs, fontVariant: ['tabular-nums'] },
  section: { color: colors.textMuted, marginTop: spacing.md, marginBottom: spacing.sm, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg, marginBottom: spacing.sm },
  addBtn: { backgroundColor: colors.surfaceAlt, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radii.pill },
  addBtnText: { color: colors.accent, fontWeight: '600' },
  bodyText: { color: colors.textPrimary },
  roundsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surface, padding: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border },
  timerCard: { backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.md, marginVertical: spacing.xs, borderWidth: 1, borderColor: colors.border },
  timerCardHeader: { flexDirection: 'row', alignItems: 'center' },
  timerName: { color: colors.textPrimary, fontSize: 16 },
  timerMeta: { color: colors.textMuted, marginTop: 2, fontSize: 12 },
  timerActions: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  timerAction: { color: colors.textMuted, fontSize: 16, paddingHorizontal: spacing.xs },
  timerActionDanger: { color: colors.accent },
  timerActionDisabled: { opacity: 0.3 },
  ruleSummary: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  ruleSummaryLine: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  disclaimer: { color: colors.textMuted, fontSize: 12, marginTop: spacing.lg, lineHeight: 18 },
});
