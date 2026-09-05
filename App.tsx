import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AppState, Profile } from './src/types';
import { activeProfile, loadState, saveState, seedState } from './src/store/storage';
import { ProfileTemplate, profileFromTemplate } from './src/store/defaults';
import { HomeScreen } from './src/screens/HomeScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { initBeeps } from './src/sound/beeps';
import { colors } from './src/theme';

type Screen = 'home' | 'settings';

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [screen, setScreen] = useState<Screen>('home');

  // Load persisted state on mount.
  useEffect(() => {
    (async () => {
      const s = await loadState().catch(() => seedState());
      setState(s);
      void initBeeps();
    })();
  }, []);

  // Persist on change.
  useEffect(() => {
    if (state) void saveState(state);
  }, [state]);

  const onChangeProfile = useCallback((p: Profile) => {
    setState((prev) => {
      if (!prev) return prev;
      return { ...prev, profiles: prev.profiles.map((x) => (x.id === p.id ? p : x)) };
    });
  }, []);

  const onSwitchProfile = useCallback((id: string) => {
    setState((prev) => (prev ? { ...prev, activeProfileId: id } : prev));
  }, []);

  const onCreateProfile = useCallback(
    (template: ProfileTemplate, name: string, sourceId?: string) => {
      setState((prev) => {
        if (!prev) return prev;
        const source =
          (sourceId ? prev.profiles.find((p) => p.id === sourceId) : undefined) ??
          activeProfile(prev);
        const created = profileFromTemplate(template, name, source);
        return { ...prev, profiles: [...prev.profiles, created], activeProfileId: created.id };
      });
    },
    []
  );

  const onRenameProfile = useCallback((id: string, name: string) => {
    setState((prev) => {
      if (!prev) return prev;
      return { ...prev, profiles: prev.profiles.map((p) => (p.id === id ? { ...p, name } : p)) };
    });
  }, []);

  const onDeleteProfile = useCallback((id: string) => {
    setState((prev) => {
      if (!prev) return prev;
      if (prev.profiles.length <= 1) return prev;
      const profiles = prev.profiles.filter((p) => p.id !== id);
      const activeProfileId = prev.activeProfileId === id ? profiles[0]!.id : prev.activeProfileId;
      return { ...prev, profiles, activeProfileId };
    });
  }, []);

  const onSetAdvanced = useCallback((advanced: boolean) => {
    setState((prev) => (prev ? { ...prev, advanced } : prev));
  }, []);

  if (!state) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const profile = activeProfile(state);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        {screen === 'home' ? (
          <HomeScreen profile={profile} onOpenSettings={() => setScreen('settings')} />
        ) : (
          <SettingsScreen
            profiles={state.profiles}
            activeProfileId={state.activeProfileId}
            advanced={state.advanced}
            onSetAdvanced={onSetAdvanced}
            onChangeProfile={onChangeProfile}
            onSwitchProfile={onSwitchProfile}
            onCreateProfile={onCreateProfile}
            onRenameProfile={onRenameProfile}
            onDeleteProfile={onDeleteProfile}
            onBack={() => setScreen('home')}
          />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  loading: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
});
