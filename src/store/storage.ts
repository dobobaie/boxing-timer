import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Profile } from '../types';
import { defaultProfile, pyramidProfile } from './defaults';

const KEY = 'boxing-timer.state.v1';

export async function loadState(): Promise<AppState> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed && Array.isArray(parsed.profiles) && parsed.profiles.length > 0) {
        return migrate(parsed);
      }
    }
  } catch {
    // fall through to seed
  }
  return seedState();
}

/** Normalize state loaded from older app versions (e.g. timers without `triggers`). */
function migrate(state: AppState): AppState {
  return {
    ...state,
    profiles: state.profiles.map((p) => ({
      ...p,
      timers: (p.timers ?? []).map((t) => ({
        ...t,
        rules: t.rules ?? [],
        triggers: t.triggers ?? [],
      })),
    })),
  };
}

export async function saveState(state: AppState): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(state));
}

export function seedState(): AppState {
  const classic = defaultProfile();
  const pyramid = pyramidProfile();
  return {
    profiles: [classic, pyramid],
    activeProfileId: classic.id,
  };
}

export function activeProfile(state: AppState): Profile {
  return state.profiles.find((p) => p.id === state.activeProfileId) ?? state.profiles[0]!;
}
