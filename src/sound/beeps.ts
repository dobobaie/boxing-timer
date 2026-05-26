import { Audio } from 'expo-av';

let shortBeep: Audio.Sound | null = null;
let longBeep: Audio.Sound | null = null;
let initialized = false;

export async function initBeeps(): Promise<void> {
  if (initialized) return;
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });
    const a = await Audio.Sound.createAsync(require('../../assets/beep-short.wav'));
    const b = await Audio.Sound.createAsync(require('../../assets/beep-long.wav'));
    shortBeep = a.sound;
    longBeep = b.sound;
    initialized = true;
  } catch (err) {
    // Audio unavailable (e.g. web with strict autoplay policy). Beeps become silent.
    console.warn('[beeps] init failed', err);
  }
}

export async function playShortBeep(): Promise<void> {
  if (!shortBeep) return;
  try {
    await shortBeep.setPositionAsync(0);
    await shortBeep.playAsync();
  } catch {}
}

export async function playLongBeep(): Promise<void> {
  if (!longBeep) return;
  try {
    await longBeep.setPositionAsync(0);
    await longBeep.playAsync();
  } catch {}
}

export async function unloadBeeps(): Promise<void> {
  if (shortBeep) await shortBeep.unloadAsync();
  if (longBeep) await longBeep.unloadAsync();
  shortBeep = null;
  longBeep = null;
  initialized = false;
}
