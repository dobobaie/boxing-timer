import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

let shortBeep: AudioPlayer | null = null;
let longBeep: AudioPlayer | null = null;
let initialized = false;

export async function initBeeps(): Promise<void> {
  if (initialized) return;
  try {
    // Play our beeps/gong *alongside* whatever music the user already has
    // going, without lowering (ducking) or pausing it. `mixWithOthers` makes
    // expo-audio skip requesting Android audio focus entirely, so background
    // music keeps playing at full volume while the gong still sounds over it.
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: 'mixWithOthers',
    });
    shortBeep = createAudioPlayer(require('../../assets/beep-short.wav'));
    longBeep = createAudioPlayer(require('../../assets/beep-long.wav'));
    initialized = true;
  } catch (err) {
    // Audio unavailable (e.g. web with strict autoplay policy). Beeps become silent.
    console.warn('[beeps] init failed', err);
  }
}

export async function playShortBeep(): Promise<void> {
  if (!shortBeep) return;
  try {
    await shortBeep.seekTo(0);
    shortBeep.play();
  } catch {}
}

export async function playLongBeep(): Promise<void> {
  if (!longBeep) return;
  try {
    await longBeep.seekTo(0);
    longBeep.play();
  } catch {}
}

export async function unloadBeeps(): Promise<void> {
  shortBeep?.remove();
  longBeep?.remove();
  shortBeep = null;
  longBeep = null;
  initialized = false;
}
