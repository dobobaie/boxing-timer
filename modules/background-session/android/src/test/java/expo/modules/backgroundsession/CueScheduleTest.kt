package expo.modules.backgroundsession

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CueScheduleTest {
  private val start = 1_000_000L

  /** A 3s pre-countdown, then a 10s round and a 5s rest. */
  private fun session(): List<Cue> = buildCues(
    startEpochMs = start,
    boundariesEpochMs = listOf(start + 3_000, start + 13_000, start + 18_000),
    labels = listOf("Get ready", "Round 1/1 · Work · 00:10", "Round 1/1 · Rest · 00:05")
  )

  @Test
  fun `every phase gets three ticks and a gong`() {
    val cues = session()
    assertEquals(12, cues.size)
    assertEquals(9, cues.count { it.sound == CueSound.SHORT })
    assertEquals(3, cues.count { it.sound == CueSound.LONG })
  }

  @Test
  fun `cues come out in time order`() {
    val times = session().map { it.atEpochMs }
    assertEquals(times.sorted(), times)
  }

  @Test
  fun `the pre-countdown ticks from its very first instant`() {
    val cues = session()
    assertEquals(start, cues.first().atEpochMs)
    assertEquals(CueSound.SHORT, cues.first().sound)
    assertEquals(listOf(start, start + 1_000, start + 2_000), cues.take(3).map { it.atEpochMs })
  }

  @Test
  fun `a gong lands on each boundary and carries the next phase's label`() {
    val gongs = session().filter { it.sound == CueSound.LONG }
    assertEquals(listOf(start + 3_000, start + 13_000, start + 18_000), gongs.map { it.atEpochMs })
    assertEquals("Round 1/1 · Work · 00:10", gongs[0].label)
    assertEquals("Round 1/1 · Rest · 00:05", gongs[1].label)
    // Nothing follows the last one, so there is no phase left to name.
    assertEquals(null, gongs[2].label)
  }

  @Test
  fun `only the last cue is terminal`() {
    val cues = session()
    assertEquals(1, cues.count { it.terminal })
    assertTrue(cues.last().terminal)
    assertEquals(CueSound.LONG, cues.last().sound)
  }

  @Test
  fun `a phase shorter than three seconds only ticks inside itself`() {
    // 3s pre-countdown then a 2s round: the "3 seconds left" tick would fall in
    // the pre-countdown, where it would double up with that phase's own ticks.
    val cues = buildCues(
      startEpochMs = start,
      boundariesEpochMs = listOf(start + 3_000, start + 5_000),
      labels = listOf("Get ready", "Round 1/1 · Work · 00:02")
    )
    val ticksInRound = cues.filter { it.sound == CueSound.SHORT && it.atEpochMs >= start + 3_000 }
    assertEquals(listOf(start + 3_000, start + 4_000), ticksInRound.map { it.atEpochMs })
  }

  @Test
  fun `an empty session produces nothing`() {
    assertEquals(emptyList<Cue>(), buildCues(start, emptyList(), listOf("Get ready")))
  }

  @Test
  fun `a missing label leaves the notification alone rather than blanking it`() {
    val cues = buildCues(
      startEpochMs = start,
      boundariesEpochMs = listOf(start + 3_000, start + 13_000),
      labels = listOf("Get ready") // caller under-supplied
    )
    assertEquals(null, cues.first { it.sound == CueSound.LONG }.label)
  }
}
