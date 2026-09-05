import { requireOptionalNativeModule } from 'expo';
import type { EventSubscription, PermissionResponse } from 'expo-modules-core';

/**
 * Android-only foreground service that replays a session's audio cues while the
 * app is not in the foreground. See
 * `android/.../BackgroundSessionService.kt` for why the schedule and the
 * playback both have to live natively.
 *
 * Every export here is a no-op on platforms without the native module (web,
 * iOS, Expo Go), so callers never have to branch on `Platform.OS` — they only
 * have to respect the boolean [startBackgroundSession] returns.
 */
type NativeBackgroundSession = {
  getNotificationPermissionAsync(): Promise<PermissionResponse>;
  requestNotificationPermissionAsync(): Promise<PermissionResponse>;
  startSession(
    title: string,
    text: string,
    startEpochMs: number,
    boundariesEpochMs: number[],
    labels: string[],
    maxDurationMs: number
  ): boolean;
  pauseSession(title: string, text: string): void;
  stopSession(): void;
  addListener(event: 'onStopRequested', listener: () => void): EventSubscription;
};

const native = requireOptionalNativeModule<NativeBackgroundSession>('BackgroundSession');

/** The wall-clock schedule a session hands to the service. */
export type CueSchedule = {
  /** When the session (its pre-countdown) began, as epoch ms. */
  startEpochMs: number;
  /** End of each phase, ascending: the pre-countdown first, the session last. */
  boundariesEpochMs: number[];
  /** One line per phase; `labels[0]` is the pre-countdown. */
  labels: string[];
};

/**
 * Ask for POST_NOTIFICATIONS (Android 13+). Denying it only hides the ongoing
 * notification — the service, and therefore the audio, still runs — so the
 * result is informational and callers can safely ignore it.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!native) return false;
  try {
    const existing = await native.getNotificationPermissionAsync();
    if (existing.granted) return true;
    if (!existing.canAskAgain) return false;
    const asked = await native.requestNotificationPermissionAsync();
    return asked.granted;
  } catch {
    return false;
  }
}

/**
 * Hand the session over to the foreground service. Call it again on resume with
 * a fresh schedule — cues already in the past are skipped.
 *
 * @returns true when the service took over the beeps. A false means the caller
 *   has to keep playing them itself: no native module (web), or the service
 *   refused to start.
 */
export function startBackgroundSession(
  title: string,
  text: string,
  schedule: CueSchedule,
  maxDurationMs: number
): boolean {
  if (!native) return false;
  try {
    return native.startSession(
      title,
      text,
      schedule.startEpochMs,
      schedule.boundariesEpochMs,
      schedule.labels,
      maxDurationMs
    );
  } catch {
    // A foreground service we failed to start must never take the timer down
    // with it — the app just falls back to beeping from JS.
    return false;
  }
}

/** Freeze the schedule and repaint, keeping the notification (and its Stop). */
export function pauseBackgroundSession(title: string, text: string): void {
  if (!native) return;
  try {
    native.pauseSession(title, text);
  } catch {}
}

export function stopBackgroundSession(): void {
  if (!native) return;
  try {
    native.stopSession();
  } catch {}
}

/** Fires when the user taps "Stop" on the ongoing notification. */
export function addStopRequestListener(listener: () => void): { remove: () => void } {
  if (!native) return { remove: () => {} };
  try {
    return native.addListener('onStopRequested', listener);
  } catch {
    return { remove: () => {} };
  }
}
