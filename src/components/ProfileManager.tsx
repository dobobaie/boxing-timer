import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Profile } from '../types';
import { colors, radii, spacing } from '../theme';

type Props = {
  visible: boolean;
  profiles: Profile[];
  activeProfileId: string;
  onClose: () => void;
  onSelect: (id: string) => void;
  onCreateFromCurrent: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
};

export function ProfileManager({
  visible,
  profiles,
  activeProfileId,
  onClose,
  onSelect,
  onCreateFromCurrent,
  onRename,
  onDelete,
}: Props) {
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  const submitNew = () => {
    const n = newName.trim();
    if (!n) return;
    onCreateFromCurrent(n);
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
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Pressable onPress={onClose}>
            <Text style={styles.back}>← Done</Text>
          </Pressable>
          <Text style={styles.title}>Profiles</Text>
          <View style={{ width: 60 }} />
        </View>

        <Text style={styles.section}>Saved profiles</Text>
        {profiles.map((p) => {
          const active = p.id === activeProfileId;
          const isRenaming = renamingId === p.id;
          return (
            <View key={p.id} style={[styles.row, active && styles.rowActive]}>
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
                <Pressable style={styles.rowMain} onPress={() => onSelect(p.id)}>
                  <Text style={[styles.rowName, active && styles.rowNameActive]}>
                    {active ? '● ' : '○ '}{p.name}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {p.timers.length} timer{p.timers.length === 1 ? '' : 's'} × {p.totalRounds} round{p.totalRounds === 1 ? '' : 's'}
                  </Text>
                </Pressable>
              )}
              <View style={styles.rowActions}>
                <Pressable onPress={() => startRename(p)}><Text style={styles.action}>rename</Text></Pressable>
                {profiles.length > 1 ? (
                  <Pressable onPress={() => onDelete(p.id)}>
                    <Text style={[styles.action, styles.actionDanger]}>delete</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        })}

        <Text style={styles.section}>Save current settings as new profile</Text>
        <View style={styles.newRow}>
          <TextInput
            style={styles.newInput}
            value={newName}
            onChangeText={setNewName}
            placeholder="Profile name"
            placeholderTextColor={colors.textMuted}
            onSubmitEditing={submitNew}
          />
          <Pressable onPress={submitNew} style={styles.saveBtn}>
            <Text style={styles.saveBtnText}>Save</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  back: { color: colors.accent, fontSize: 16 },
  title: { color: colors.textPrimary, fontSize: 18, fontWeight: '600' },
  section: { color: colors.textMuted, marginTop: spacing.lg, marginBottom: spacing.sm, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    marginVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowActive: { borderColor: colors.accent },
  rowMain: { flex: 1 },
  rowName: { color: colors.textPrimary, fontSize: 16 },
  rowNameActive: { color: colors.accent, fontWeight: '600' },
  rowMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  rowActions: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  action: { color: colors.textMuted, fontSize: 13 },
  actionDanger: { color: colors.accent },
  renameInput: {
    flex: 1,
    color: colors.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: colors.accent,
    paddingVertical: spacing.xs,
  },
  newRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  newInput: {
    flex: 1,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  saveBtn: { backgroundColor: colors.accent, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radii.md },
  saveBtnText: { color: colors.textPrimary, fontWeight: '600' },
});
