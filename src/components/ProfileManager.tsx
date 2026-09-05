import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Profile } from '../types';
import { planTotalSeconds, profileCycles, profileCycleRestSec } from '../engine/plan';
import { formatHMS } from '../utils/format';
import { PROFILE_TEMPLATES, ProfileTemplate } from '../store/defaults';
import { Segmented } from './Segmented';
import { colors, radii, spacing } from '../theme';

type Props = {
  visible: boolean;
  profiles: Profile[];
  activeProfileId: string;
  onClose: () => void;
  onSelect: (id: string) => void;
  /** `sourceId` picks which profile the 'current' template copies (defaults to the active one). */
  onCreate: (template: ProfileTemplate, name: string, sourceId?: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
};

function summarize(p: Profile): string {
  const cycles = profileCycles(p);
  const timers = p.timers.length;
  const parts = [`${p.totalRounds} round${p.totalRounds === 1 ? '' : 's'}`];
  if (cycles > 1) parts.push(`× ${cycles} cycles`);
  parts.push(`${timers} timer${timers === 1 ? '' : 's'}`);
  if (cycles > 1 && profileCycleRestSec(p) > 0) {
    parts.push(`${profileCycleRestSec(p)}s between cycles`);
  }
  return parts.join(' · ');
}

/**
 * Profiles as a picker first, an editor second: the list is tappable cards that
 * switch profile immediately, and the destructive/renaming actions live in a
 * second row so they can't be hit by accident. Creating a profile always starts
 * from a template, which is far less daunting than an empty form.
 */
export function ProfileManager({
  visible,
  profiles,
  activeProfileId,
  onClose,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: Props) {
  const [newName, setNewName] = useState('');
  const [template, setTemplate] = useState<ProfileTemplate>('current');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const totals = useMemo(
    () => new Map(profiles.map((p) => [p.id, planTotalSeconds(p)])),
    [profiles]
  );

  const submitNew = () => {
    const n = newName.trim() || defaultNameFor(template, profiles);
    onCreate(template, n);
    setNewName('');
  };

  const startRename = (p: Profile) => {
    setRenamingId(p.id);
    setRenameDraft(p.name);
  };
  const commitRename = () => {
    if (renamingId && renameDraft.trim()) onRename(renamingId, renameDraft.trim());
    setRenamingId(null);
  };

  return (
    // Translucent + SafeAreaView: a modal is its own window, outside the
    // SafeAreaView App.tsx wraps the screens in, so it has to keep clear of the
    // status and navigation bars itself. Pinning translucency here makes that
    // inset the same on every Android version, not only the ones (15+) that
    // force every window edge-to-edge.
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.back}>← Done</Text>
          </Pressable>
          <Text style={styles.title}>Profiles</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.section}>Your profiles</Text>
          <Text style={styles.sectionHint}>Tap a profile to make it the active one.</Text>

          {profiles.map((p) => {
            const active = p.id === activeProfileId;
            const isRenaming = renamingId === p.id;
            const confirming = confirmDeleteId === p.id;
            return (
              <View key={p.id} style={[styles.card, active && styles.cardActive]}>
                {isRenaming ? (
                  <TextInput
                    style={styles.renameInput}
                    value={renameDraft}
                    onChangeText={setRenameDraft}
                    onBlur={commitRename}
                    onSubmitEditing={commitRename}
                    autoFocus
                  />
                ) : (
                  <Pressable onPress={() => onSelect(p.id)}>
                    <View style={styles.cardTop}>
                      <Text style={[styles.name, active && styles.nameActive]}>{p.name}</Text>
                      {active ? <Text style={styles.activeBadge}>ACTIVE</Text> : null}
                    </View>
                    <Text style={styles.meta}>{summarize(p)}</Text>
                    <Text style={styles.total}>Total {formatHMS(totals.get(p.id) ?? 0)}</Text>
                  </Pressable>
                )}

                <View style={styles.actions}>
                  {confirming ? (
                    <>
                      <Text style={styles.confirmText}>Delete “{p.name}”?</Text>
                      <Pressable
                        onPress={() => {
                          onDelete(p.id);
                          setConfirmDeleteId(null);
                        }}
                      >
                        <Text style={[styles.action, styles.actionDanger]}>Delete</Text>
                      </Pressable>
                      <Pressable onPress={() => setConfirmDeleteId(null)}>
                        <Text style={styles.action}>Cancel</Text>
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <Pressable onPress={() => startRename(p)}>
                        <Text style={styles.action}>Rename</Text>
                      </Pressable>
                      <Pressable onPress={() => onCreate('current', `${p.name} copy`, p.id)}>
                        <Text style={styles.action}>Duplicate</Text>
                      </Pressable>
                      {profiles.length > 1 ? (
                        <Pressable onPress={() => setConfirmDeleteId(p.id)}>
                          <Text style={[styles.action, styles.actionDanger]}>Delete</Text>
                        </Pressable>
                      ) : null}
                    </>
                  )}
                </View>
              </View>
            );
          })}

          <Text style={styles.section}>New profile</Text>
          <View style={styles.newCard}>
            <Segmented
              options={PROFILE_TEMPLATES.map((t) => ({ value: t.value, label: t.label }))}
              value={template}
              onChange={setTemplate}
              wrap
            />
            <Text style={styles.sectionHint}>
              {PROFILE_TEMPLATES.find((t) => t.value === template)?.hint}
            </Text>
            <View style={styles.newRow}>
              <TextInput
                style={styles.newInput}
                value={newName}
                onChangeText={setNewName}
                placeholder={defaultNameFor(template, profiles)}
                placeholderTextColor={colors.textMuted}
                onSubmitEditing={submitNew}
              />
              <Pressable onPress={submitNew} style={styles.saveBtn}>
                <Text style={styles.saveBtnText}>Create</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function defaultNameFor(template: ProfileTemplate, profiles: Profile[]): string {
  const base =
    template === 'current'
      ? 'My workout'
      : PROFILE_TEMPLATES.find((t) => t.value === template)?.label ?? 'Profile';
  if (!profiles.some((p) => p.name === base)) return base;
  let n = 2;
  while (profiles.some((p) => p.name === `${base} ${n}`)) n++;
  return `${base} ${n}`;
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
  section: {
    color: colors.textMuted,
    marginTop: spacing.lg,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionHint: { color: colors.textMuted, fontSize: 12, marginTop: spacing.xs, lineHeight: 17 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardActive: { borderColor: colors.accent },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { color: colors.textPrimary, fontSize: 17, fontWeight: '600' },
  nameActive: { color: colors.accent },
  activeBadge: { color: colors.accent, fontSize: 10, letterSpacing: 1 },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  total: { color: colors.textMuted, fontSize: 12, marginTop: 2, fontVariant: ['tabular-nums'] },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  action: { color: colors.textMuted, fontSize: 13 },
  actionDanger: { color: colors.accent },
  confirmText: { color: colors.textPrimary, fontSize: 13, flex: 1 },
  renameInput: {
    color: colors.textPrimary,
    fontSize: 17,
    borderBottomWidth: 1,
    borderBottomColor: colors.accent,
    paddingVertical: spacing.xs,
  },
  newCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  newRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginTop: spacing.md },
  newInput: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    color: colors.textPrimary,
    padding: spacing.md,
    borderRadius: radii.sm,
  },
  saveBtn: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.sm,
  },
  saveBtnText: { color: colors.textPrimary, fontWeight: '600' },
});
