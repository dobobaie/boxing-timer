package expo.modules.backgroundsession

/** What a scheduled event does when its moment arrives. */
enum class CueSound { SHORT, LONG, NONE }

/**
 * One scheduled moment of a session.
 *
 * @param atEpochMs wall-clock instant, so a late wake-up can still tell how
 *   overdue the event is instead of drifting.
 * @param label notification line for the phase this event opens, or null when
 *   the event does not change phase.
 * @param terminal true for the very last event: the session is over.
 */
data class Cue(
  val atEpochMs: Long,
  val sound: CueSound,
  val label: String?,
  val terminal: Boolean
)

/**
 * Expand the phase boundaries of a session into the flat, time-ordered list of
 * audio cues and notification changes the service replays.
 *
 * Mirrors `emitCues` in `src/engine/timer.ts`: a long beep on entering every new
 * phase (which is the same instant the previous phase hits zero) and a short
 * beep at 3, 2 and 1 seconds remaining — but only when those ticks actually fall
 * inside the phase, so a two-second round beeps twice, not three times.
 *
 * @param startEpochMs when the session (its pre-countdown) began.
 * @param boundariesEpochMs the end of each phase, ascending. The first entry is
 *   the end of the pre-countdown, the last is the end of the session.
 * @param labels one per phase, `labels[0]` being the pre-countdown. The label at
 *   index i+1 is what the notification shows after boundary i.
 */
fun buildCues(
  startEpochMs: Long,
  boundariesEpochMs: List<Long>,
  labels: List<String>
): List<Cue> {
  val cues = mutableListOf<Cue>()
  boundariesEpochMs.forEachIndexed { i, boundary ->
    val phaseStart = if (i == 0) startEpochMs else boundariesEpochMs[i - 1]
    for (secondsLeft in 3 downTo 1) {
      val at = boundary - secondsLeft * 1000L
      if (at >= phaseStart) {
        cues += Cue(at, CueSound.SHORT, label = null, terminal = false)
      }
    }
    val terminal = i == boundariesEpochMs.lastIndex
    cues += Cue(
      atEpochMs = boundary,
      sound = CueSound.LONG,
      label = if (terminal) null else labels.getOrNull(i + 1),
      terminal = terminal
    )
  }
  cues.sortBy { it.atEpochMs }
  return cues
}
