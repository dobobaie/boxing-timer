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

/**
 * Normalize state loaded from older app versions: timers without `triggers`,
 * profiles without the outer cycle layer, no advanced-mode preference. Defaults
 * are chosen so an existing profile behaves exactly as it did before (a single
 * cycle is the old single-layer session).
 */
function migrate(state: AppState): AppState {
  return {
    ...state,
    advanced: state.advanced ?? false,
    profiles: state.profiles.map((p) => ({
      ...p,
      cycles: Math.max(1, Math.round(p.cycles ?? 1)),
      cycleRestSec: Math.max(0, Math.round(p.cycleRestSec ?? 60)),
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
    advanced: false,
  };
}

export function activeProfile(state: AppState): Profile {
  return state.profiles.find((p) => p.id === state.activeProfileId) ?? state.profiles[0]!;
}
