import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Profile, Timer } from '../types';
import { uid } from '../utils/ids';
import { planTotalSeconds, profileCycles, profileCycleRestSec } from '../engine/plan';
import { describeTimer } from '../engine/presets';
import { formatDuration, formatHMS } from '../utils/format';
import { ProfileTemplate } from '../store/defaults';
import { NumberStepper } from '../components/NumberStepper';
import { DurationField } from '../components/DurationField';
import { TimerEditor } from '../components/TimerEditor';
import { ProfileManager } from '../components/ProfileManager';
import { SchedulePreview } from '../components/SchedulePreview';
import { colors, radii, spacing } from '../theme';

type Props = {
  profiles: Profile[];
  activeProfileId: string;
  advanced: boolean;
  onSetAdvanced: (v: boolean) => void;
  onChangeProfile: (p: Profile) => void;
  onSwitchProfile: (id: string) => void;
  onCreateProfile: (template: ProfileTemplate, name: string, sourceId?: string) => void;
  onRenameProfile: (id: string, name: string) => void;
  onDeleteProfile: (id: string) => void;
  onBack: () => void;
};

/**
 * Settings is organised top-down as the session actually reads:
 *   which profile  ->  how the session is shaped (cycles/rounds)  ->  what a
 *   round contains (the timer sequence)  ->  what that adds up to.
 * Everything a beginner never needs — the raw trigger/rule machine and the
 * round-by-round breakdown — sits behind the Advanced switch in the header.
 */
export function SettingsScreen(props: Props) {
  const {
    profiles,
    activeProfileId,
    advanced,
    onSetAdvanced,
    onChangeProfile,
    onSwitchProfile,
    onCreateProfile,
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
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const total = useMemo(() => planTotalSeconds(profile), [profile]);
  const cycles = profileCycles(profile);
  const roundSec = useMemo(
    () => profile.timers.reduce((s, t) => s + t.durationSec, 0),
    [profile.timers]
  );

  const patchProfile = (p: Partial<Profile>) => onChangeProfile({ ...profile, ...p });

  const addTimer = () => {
    const t: Timer = {
      id: uid('t_'),
      name: profile.timers.length % 2 === 0 ? 'Work' : 'Rest',
      durationSec: 60,
      rules: [],
      triggers: [],
    };
    patchProfile({ timers: [...profile.timers, t] });
    setEditingTimerId(t.id);
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
      triggers: (src.triggers ?? []).map((g) => ({ ...g, id: uid('g_') })),
    };
    const next = profile.timers.slice();
    next.splice(idx + 1, 0, copy);
    patchProfile({ timers: next });
  };

  const removeTimer = (id: string) => {
    if (profile.timers.length <= 1) return; // a round needs at least one timer
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
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Settings</Text>
        <View style={styles.advancedToggle}>
          <Text style={styles.advancedLabel}>Advanced</Text>
          <Switch
            value={advanced}
            onValueChange={onSetAdvanced}
            trackColor={{ false: colors.surfaceAlt, true: colors.accentDark }}
            thumbColor={advanced ? colors.accent : colors.textMuted}
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Profile ---------------------------------------------------------- */}
        <Pressable style={styles.profileCard} onPress={() => setProfileModalOpen(true)}>
          <View style={styles.profileCardTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileLabel}>Profile</Text>
              <Text style={styles.profileName}>{profile.name}</Text>
            </View>
            <Text style={styles.switchLink}>Switch ›</Text>
          </View>
          <View style={styles.chips}>
            <Chip text={`${profile.totalRounds} round${profile.totalRounds === 1 ? '' : 's'}`} />
            {cycles > 1 ? <Chip text={`× ${cycles} cycles`} /> : null}
            <Chip
              text={`${profile.timers.length} timer${profile.timers.length === 1 ? '' : 's'} / round`}
            />
            <Chip text={`Total ${formatHMS(total)}`} accent />
          </View>
        </Pressable>

        {/* Structure -------------------------------------------------------- */}
        <Text style={styles.section}>Session structure</Text>
        <View style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Rounds per cycle</Text>
              <Text style={styles.settingHint}>
                One round runs the whole timer sequence below ({formatDuration(roundSec)} at base
                lengths).
              </Text>
            </View>
            <NumberStepper
              value={profile.totalRounds}
              onChange={(v) => patchProfile({ totalRounds: Math.max(1, Math.round(v)) })}
              min={1}
              step={1}
              width={130}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Cycles</Text>
              <Text style={styles.settingHint}>
                Repeat the whole block of rounds. A pyramid set to 2 cycles climbs and descends
                twice.
              </Text>
            </View>
            <NumberStepper
              value={cycles}
              onChange={(v) => patchProfile({ cycles: Math.max(1, Math.round(v)) })}
              min={1}
              step={1}
              width={130}
            />
          </View>

          {cycles > 1 ? (
            <>
              <View style={styles.divider} />
              <View>
                <Text style={styles.settingLabel}>Rest between cycles</Text>
                <Text style={styles.settingHint}>
                  Inserted after each cycle except the last.
                </Text>
                <View style={{ marginTop: spacing.sm }}>
                  <DurationField
                    valueSec={profileCycleRestSec(profile)}
                    minSec={0}
                    presets={[0, 30, 60, 120, 300]}
                    onChange={(sec) => patchProfile({ cycleRestSec: sec })}
                  />
                </View>
              </View>
            </>
          ) : null}
        </View>

        {/* Timers ----------------------------------------------------------- */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.section}>Inside one round</Text>
          <Pressable onPress={addTimer} style={styles.addBtn}>
            <Text style={styles.addBtnText}>+ Add timer</Text>
          </Pressable>
        </View>
        <Text style={styles.sectionHint}>
          These run in order, every round. Tap one to change its length or how it evolves.
        </Text>

        {profile.timers.map((t, idx) => (
          <View key={t.id} style={styles.timerCard}>
            <Pressable style={styles.timerMain} onPress={() => setEditingTimerId(t.id)}>
              <Text style={styles.timerOrder}>{idx + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.timerName}>{t.name}</Text>
                <Text style={styles.timerDesc}>{describeTimer(t)}</Text>
              </View>
              <Text style={styles.timerChevron}>›</Text>
            </Pressable>
            <View style={styles.timerActions}>
              <Pressable onPress={() => moveTimer(t.id, -1)} disabled={idx === 0} hitSlop={8}>
                <Text style={[styles.timerAction, idx === 0 && styles.timerActionDisabled]}>
                  ↑
                </Text>
              </Pressable>
              <Pressable
                onPress={() => moveTimer(t.id, 1)}
                disabled={idx === profile.timers.length - 1}
                hitSlop={8}
              >
                <Text
                  style={[
                    styles.timerAction,
                    idx === profile.timers.length - 1 && styles.timerActionDisabled,
                  ]}
                >
                  ↓
                </Text>
              </Pressable>
              <Pressable onPress={() => duplicateTimer(t.id)} hitSlop={8}>
                <Text style={styles.timerAction}>Duplicate</Text>
              </Pressable>
              <Pressable
                onPress={() => removeTimer(t.id)}
                disabled={profile.timers.length <= 1}
                hitSlop={8}
              >
                <Text
                  style={[
                    styles.timerAction,
                    styles.timerActionDanger,
                    profile.timers.length <= 1 && styles.timerActionDisabled,
                  ]}
                >
                  Remove
                </Text>
              </Pressable>
            </View>
          </View>
        ))}

        {/* Total / schedule -------------------------------------------------- */}
        <Text style={styles.section}>Session total</Text>
        <View style={styles.card}>
          <View style={styles.totalRow}>
            <Text style={styles.totalValue}>{formatHMS(total)}</Text>
            <Text style={styles.totalHint}>
              {cycles > 1
                ? `${cycles} cycles × ${profile.totalRounds} rounds`
                : `${profile.totalRounds} rounds`}
            </Text>
          </View>
          <Pressable onPress={() => setScheduleOpen((o) => !o)} style={styles.disclosure}>
            <Text style={styles.disclosureText}>
              {scheduleOpen ? 'Hide round-by-round breakdown' : 'Show round-by-round breakdown'}
            </Text>
          </Pressable>
          {scheduleOpen ? (
            <View style={{ marginTop: spacing.sm }}>
              <SchedulePreview profile={profile} />
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Translucent on purpose: Android 15+ forces every window edge-to-edge
          anyway, so pinning it here makes the inset the editor pads for the
          same on every version instead of only the newest ones. */}
      <Modal
        visible={editingTimer !== null}
        animationType="slide"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setEditingTimerId(null)}
      >
        {editingTimer ? (
          <TimerEditor
            timer={editingTimer}
            rounds={profile.totalRounds}
            advanced={advanced}
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
        onCreate={onCreateProfile}
        onRename={onRenameProfile}
        onDelete={onDeleteProfile}
      />
    </View>
  );
}

function Chip({ text, accent }: { text: string; accent?: boolean }) {
  return (
    <View style={[styles.chip, accent && styles.chipAccent]}>
      <Text style={[styles.chipText, accent && styles.chipTextAccent]}>{text}</Text>
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
  advancedToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  advancedLabel: { color: colors.textMuted, fontSize: 12 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },

  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.accent,
    padding: spacing.md,
  },
  profileCardTop: { flexDirection: 'row', alignItems: 'center' },
  profileLabel: {
    color: colors.textMuted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  profileName: { color: colors.textPrimary, fontSize: 22, fontWeight: '700', marginTop: 2 },
  switchLink: { color: colors.accent, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md },
  chip: {
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceAlt,
  },
  chipAccent: { backgroundColor: colors.accentDark },
  chipText: { color: colors.textMuted, fontSize: 11 },
  chipTextAccent: { color: colors.textPrimary, fontWeight: '600' },

  section: {
    color: colors.textMuted,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionHint: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm, lineHeight: 17 },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addBtn: {
    backgroundColor: colors.surfaceAlt,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
  },
  addBtnText: { color: colors.accent, fontWeight: '600', fontSize: 13 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settingText: { flex: 1, paddingRight: spacing.md },
  settingLabel: { color: colors.textPrimary, fontSize: 15 },
  settingHint: { color: colors.textMuted, fontSize: 12, marginTop: 2, lineHeight: 16 },

  timerCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  timerMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  timerOrder: {
    color: colors.textMuted,
    fontSize: 12,
    width: 20,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  timerName: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
  timerDesc: { color: colors.textMuted, fontSize: 12, marginTop: 2, lineHeight: 16 },
  timerChevron: { color: colors.textMuted, fontSize: 20 },
  timerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  timerAction: { color: colors.textMuted, fontSize: 14 },
  timerActionDanger: { color: colors.accent },
  timerActionDisabled: { opacity: 0.3 },

  totalRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  totalValue: {
    color: colors.textPrimary,
    fontSize: 30,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  totalHint: { color: colors.textMuted, fontSize: 12 },
  disclosure: { marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  disclosureText: { color: colors.accent, fontSize: 13 },
});
