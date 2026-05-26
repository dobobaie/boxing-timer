import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Profile } from '../types';
import { useTimerEngine } from '../engine/timer';
import { formatHMS, formatMMSS } from '../utils/format';
import { colors, radii, spacing } from '../theme';

type Props = {
  profile: Profile;
  onOpenSettings: () => void;
};

export function HomeScreen({ profile, onOpenSettings }: Props) {
  const eng = useTimerEngine(profile);
  const { state, plan, totalSessionSec, elapsedSec, currentEntry, start, pause, resume, stop } = eng;

  const displayCenter = renderCenter(state, currentEntry);
  const remainingTopRight = currentEntry
    ? `Round ${currentEntry.round} / ${profile.totalRounds}`
    : `Rounds: ${profile.totalRounds}`;
  const totalLeft =
    state.kind === 'idle'
      ? `Total: ${formatHMS(totalSessionSec)}`
      : `${formatHMS(elapsedSec)} / ${formatHMS(totalSessionSec)}`;

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <Text style={styles.metaLeft}>{totalLeft}</Text>
        <Text style={styles.metaRight}>{remainingTopRight}</Text>
      </View>

      <View style={styles.center}>
        <Text style={styles.profileName}>{profile.name}</Text>
        {displayCenter}
      </View>

      <View style={styles.controlsRow}>
        {state.kind === 'idle' || state.kind === 'finished' ? (
          <BigButton label="Start" tone="accent" onPress={start} />
        ) : state.kind === 'running' || state.kind === 'countdown' ? (
          <BigButton label="Pause" tone="warn" onPress={pause} />
        ) : (
          <BigButton label="Resume" tone="accent" onPress={resume} />
        )}
        <BigButton
          label="Stop"
          tone="neutral"
          onPress={stop}
          disabled={state.kind === 'idle'}
        />
      </View>

      <Pressable style={styles.settingsCog} onPress={onOpenSettings}>
        <Text style={styles.settingsCogText}>Settings</Text>
      </Pressable>

      {plan.length === 0 ? (
        <Text style={styles.warn}>No timers configured. Open settings to add one.</Text>
      ) : null}
    </View>
  );
}

function renderCenter(state: ReturnType<typeof useTimerEngine>['state'], currentEntry: ReturnType<typeof useTimerEngine>['currentEntry']) {
  if (state.kind === 'idle') {
    return <Text style={styles.bigDigits}>Ready</Text>;
  }
  if (state.kind === 'countdown') {
    const sec = Math.ceil(state.remainingMs / 1000);
    return (
      <>
        <Text style={styles.subLabel}>Get ready</Text>
        <Text style={[styles.bigDigits, styles.countdownDigits]}>{sec}</Text>
      </>
    );
  }
  if (state.kind === 'finished') {
    return (
      <>
        <Text style={styles.subLabel}>Done</Text>
        <Text style={styles.bigDigits}>Finished</Text>
      </>
    );
  }
  // running | paused
  const remainingSec = Math.ceil(state.remainingMs / 1000);
  const name = currentEntry?.timerName ?? '';
  return (
    <>
      <Text style={styles.subLabel}>{name}{state.kind === 'paused' ? ' (paused)' : ''}</Text>
      <Text style={styles.bigDigits}>{formatMMSS(remainingSec)}</Text>
      <Text style={styles.entryHint}>
        {currentEntry ? `${currentEntry.durationSec}s configured` : ''}
      </Text>
    </>
  );
}

function BigButton({
  label,
  onPress,
  tone,
  disabled,
}: {
  label: string;
  onPress: () => void;
  tone: 'accent' | 'warn' | 'neutral';
  disabled?: boolean;
}) {
  const bg =
    tone === 'accent' ? colors.accent : tone === 'warn' ? colors.warn : colors.surfaceAlt;
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={[styles.bigBtn, { backgroundColor: bg, opacity: disabled ? 0.4 : 1 }]}
    >
      <Text style={styles.bigBtnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: spacing.sm },
  metaLeft: { color: colors.textMuted, fontVariant: ['tabular-nums'] },
  metaRight: { color: colors.textMuted, fontVariant: ['tabular-nums'] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  profileName: { color: colors.textMuted, marginBottom: spacing.md, letterSpacing: 1, textTransform: 'uppercase' },
  subLabel: { color: colors.textPrimary, fontSize: 28, marginBottom: spacing.md },
  bigDigits: {
    color: colors.textPrimary,
    fontSize: 110,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  countdownDigits: { color: colors.accent },
  entryHint: { color: colors.textMuted, marginTop: spacing.sm },
  controlsRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md, marginBottom: spacing.lg },
  bigBtn: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.lg,
    minWidth: 140,
    alignItems: 'center',
  },
  bigBtnText: { color: colors.textPrimary, fontSize: 22, fontWeight: '600' },
  settingsCog: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  settingsCogText: { color: colors.textMuted },
  warn: { color: colors.warn, textAlign: 'center', marginTop: spacing.md },
});
