export function formatMMSS(totalSec: number): string {
  const safe = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// Split a millisecond value into the MM:SS clock and its centiseconds (2
// digits, hundredths of a second). Seconds use floor (not ceil) here because
// the sub-second part is shown explicitly — e.g. 1500ms → { main: '00:01',
// cs: '50' }. Used by the running timer to display milliseconds.
export function formatClock(totalMs: number): { main: string; cs: string } {
  const safe = Math.max(0, totalMs);
  const totalSec = Math.floor(safe / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const cs = Math.floor((safe % 1000) / 10);
  return {
    main: `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`,
    cs: cs.toString().padStart(2, '0'),
  };
}

/**
 * Compact, human duration for labels and summaries: "45s", "3:00", "1:02:30".
 * Short values keep the seconds suffix so "45s" doesn't read as 45 minutes.
 */
export function formatDuration(totalSec: number): string {
  const safe = Math.max(0, Math.round(totalSec));
  if (safe < 60) return `${safe}s`;
  return formatHMS(safe);
}

export function formatHMS(totalSec: number): string {
  const safe = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h === 0) return `${m}:${s.toString().padStart(2, '0')}`;
  return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
