package expo.modules.backgroundsession

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.media.MediaPlayer
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

/**
 * Plays a timer session's audio cues while the app is not in the foreground.
 *
 * Why this has to exist at all: React Native's `JavaTimerManager` removes its
 * TIMERS_EVENTS frame callback in `onHostPause`, so every JS `setInterval` stops
 * firing the moment the activity is paused. Keeping the process alive is
 * therefore not enough — the schedule and the playback both have to be native.
 *
 * The split is:
 *  - JS owns the session (see `src/engine/timer.ts`). On start and on resume it
 *    hands over the wall-clock instant of every phase boundary plus the label to
 *    show for each phase, and it stops driving the beeps itself.
 *  - This service replays that schedule from a [Handler], repaints the ongoing
 *    notification at each boundary, and stops itself at the end.
 *
 * A partial wake lock keeps the CPU scheduled through Doze, and the foreground
 * notification exempts the process from background execution limits. Every wait
 * is re-derived from `System.currentTimeMillis()` after each cue fires, so the
 * schedule self-corrects instead of accumulating drift.
 */
class BackgroundSessionService : Service() {
  private var wakeLock: PowerManager.WakeLock? = null

  // The main looper, not a worker thread: a cue only starts a prepared
  // MediaPlayer and repaints a notification, and keeping every touch of the
  // schedule on one thread removes the races a second thread would invite. It
  // keeps firing while the activity is paused — this is the process looper, not
  // React Native's choreographer.
  private val handler = Handler(Looper.getMainLooper())

  private var shortBeep: MediaPlayer? = null
  private var longBeep: MediaPlayer? = null

  private var cues: List<Cue> = emptyList()
  private var nextCueIndex = 0
  private var currentTitle = DEFAULT_TITLE
  private var currentText = ""

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    instance = this
    // Prepared up front (MediaPlayer.create prepares synchronously) so the very
    // first cue — the "3" of the pre-countdown, due immediately — is not missed
    // waiting on a decoder.
    shortBeep = createPlayer(R.raw.beep_short)
    longBeep = createPlayer(R.raw.beep_long)
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      // The user tapped Stop on the notification. JS owns the session state, so
      // tell it first, then go away.
      onStopRequested?.invoke()
      finishSelf()
      return START_NOT_STICKY
    }

    currentTitle = intent?.getStringExtra(EXTRA_TITLE) ?: DEFAULT_TITLE
    currentText = intent?.getStringExtra(EXTRA_TEXT).orEmpty()
    val maxDurationMs =
      intent?.getLongExtra(EXTRA_MAX_DURATION_MS, DEFAULT_MAX_DURATION_MS) ?: DEFAULT_MAX_DURATION_MS

    ensureChannel(this)
    val notification = buildNotification(this, currentTitle, currentText)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
    isRunning = true
    acquireWakeLock(maxDurationMs)

    val startEpochMs = intent?.getLongExtra(EXTRA_START_EPOCH_MS, System.currentTimeMillis())
      ?: System.currentTimeMillis()
    val boundaries = intent?.getLongArrayExtra(EXTRA_BOUNDARIES)?.toList().orEmpty()
    val labels = intent?.getStringArrayListExtra(EXTRA_LABELS)?.toList().orEmpty()
    schedule(buildCues(startEpochMs, boundaries, labels))

    // Never resurrect on our own: the session lives in the JS runtime, and a
    // restarted service with no runtime behind it is just a stuck notification.
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    isRunning = false
    instance = null
    cancelPending()
    releaseWakeLock()
    releasePlayers()
    super.onDestroy()
  }

  /** Freeze the schedule and repaint. Called straight from the module. */
  fun pauseInternal(title: String, text: String) {
    cancelPending()
    currentTitle = title
    currentText = text
    repaint()
  }

  /**
   * End the session from inside the service. Distinct from the companion's
   * [stopSession]: a second `startForegroundService` for something as ordinary
   * as pausing or self-stopping would open a new "must call startForeground"
   * window that we have no reason to reopen.
   */
  private fun finishSelf() {
    isRunning = false
    cancelPending()
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  // --- cue scheduling --------------------------------------------------------

  private fun schedule(newCues: List<Cue>) {
    cancelPending()
    cues = newCues
    val now = System.currentTimeMillis()
    // Resuming lands us mid-session: everything already past is history.
    nextCueIndex = newCues.indexOfFirst { it.atEpochMs > now - LATE_TOLERANCE_MS }
    if (nextCueIndex < 0) nextCueIndex = newCues.size
    if (nextCueIndex >= newCues.size) {
      // Nothing left to play — never sit on a notification with no session
      // behind it.
      finishSelf()
      return
    }
    postNextCue()
  }

  private fun postNextCue() {
    val cue = cues.getOrNull(nextCueIndex) ?: return
    val delay = (cue.atEpochMs - System.currentTimeMillis()).coerceAtLeast(0L)
    handler.postDelayed(cueRunnable, delay)
  }

  private val cueRunnable = Runnable {
    val cue = cues.getOrNull(nextCueIndex) ?: return@Runnable
    nextCueIndex++
    val lateBy = System.currentTimeMillis() - cue.atEpochMs
    // A cue we woke up far too late for is history: apply its notification
    // change but stay silent, exactly like the JS engine's catch-up rule.
    if (lateBy <= LATE_TOLERANCE_MS) {
      when (cue.sound) {
        CueSound.SHORT -> play(shortBeep)
        CueSound.LONG -> play(longBeep)
        CueSound.NONE -> Unit
      }
    }
    cue.label?.let {
      currentText = it
      repaint()
    }
    if (cue.terminal) {
      finishSelf()
    } else {
      postNextCue()
    }
  }

  private fun cancelPending() {
    handler.removeCallbacks(cueRunnable)
  }

  // --- audio -----------------------------------------------------------------

  /**
   * `create` returns an already-prepared player on the music stream and never
   * requests audio focus, which is exactly the `mixWithOthers` behaviour the app
   * asks expo-audio for: the cue sounds *over* the user's music instead of
   * ducking or pausing it.
   */
  private fun createPlayer(resId: Int): MediaPlayer? =
    runCatching { MediaPlayer.create(this, resId) }.getOrNull()

  private fun play(player: MediaPlayer?) {
    val p = player ?: return
    runCatching {
      if (p.isPlaying) p.pause()
      p.seekTo(0)
      p.start()
    }
  }

  private fun releasePlayers() {
    runCatching { shortBeep?.release() }
    runCatching { longBeep?.release() }
    shortBeep = null
    longBeep = null
  }

  // --- wake lock -------------------------------------------------------------

  private fun acquireWakeLock(timeoutMs: Long) {
    if (wakeLock?.isHeld == true) return
    val power = getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return
    wakeLock = runCatching {
      power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, WAKE_LOCK_TAG).apply {
        setReferenceCounted(false)
        // Always time-bounded: a wake lock leaked by a crash would otherwise
        // drain the battery until the next reboot.
        acquire(timeoutMs.coerceIn(MIN_MAX_DURATION_MS, MAX_MAX_DURATION_MS))
      }
    }.getOrNull()
  }

  private fun releaseWakeLock() {
    runCatching { wakeLock?.takeIf { it.isHeld }?.release() }
    wakeLock = null
  }

  private fun repaint() = updateSession(this, currentTitle, currentText)

  companion object {
    private const val CHANNEL_ID = "boxing-timer-session"
    private const val CHANNEL_NAME = "Timer session"
    private const val NOTIFICATION_ID = 4711
    private const val WAKE_LOCK_TAG = "boxing-timer:session"

    private const val DEFAULT_TITLE = "Timer running"
    const val ACTION_STOP = "expo.modules.backgroundsession.STOP"
    private const val EXTRA_TITLE = "title"
    private const val EXTRA_TEXT = "text"
    private const val EXTRA_START_EPOCH_MS = "startEpochMs"
    private const val EXTRA_BOUNDARIES = "boundaries"
    private const val EXTRA_LABELS = "labels"
    private const val EXTRA_MAX_DURATION_MS = "maxDurationMs"

    /** A cue we are more than this late for is applied silently. */
    private const val LATE_TOLERANCE_MS = 1000L

    private const val MIN_MAX_DURATION_MS = 60L * 1000
    private const val DEFAULT_MAX_DURATION_MS = 2L * 60 * 60 * 1000
    private const val MAX_MAX_DURATION_MS = 6L * 60 * 60 * 1000

    /** Set by the module while it is alive; invoked when the user taps Stop. */
    @Volatile
    var onStopRequested: (() -> Unit)? = null

    /** Same-process handle, so pausing doesn't need an Intent round trip. */
    @Volatile
    private var instance: BackgroundSessionService? = null

    @Volatile
    private var isRunning = false

    /**
     * Start (or re-arm, on resume) the session. Returns false when the service
     * could not be started at all, which is the caller's cue to keep beeping
     * from JS rather than going silent.
     */
    fun startSession(
      context: Context,
      title: String,
      text: String,
      startEpochMs: Long,
      boundariesEpochMs: LongArray,
      labels: ArrayList<String>,
      maxDurationMs: Long
    ): Boolean {
      val intent = Intent(context, BackgroundSessionService::class.java)
        .putExtra(EXTRA_TITLE, title)
        .putExtra(EXTRA_TEXT, text)
        .putExtra(EXTRA_START_EPOCH_MS, startEpochMs)
        .putExtra(EXTRA_BOUNDARIES, boundariesEpochMs)
        .putStringArrayListExtra(EXTRA_LABELS, labels)
        .putExtra(EXTRA_MAX_DURATION_MS, maxDurationMs)
      return runCatching { ContextCompat.startForegroundService(context, intent) }.isSuccess
    }

    /** Freeze the schedule and repaint, without giving up the notification. */
    fun pauseSession(title: String, text: String) {
      instance?.pauseInternal(title, text)
    }

    /**
     * Repaint the ongoing notification. Goes straight to the notification
     * manager rather than through another `startForegroundService`, because it
     * runs on every phase boundary.
     */
    fun updateSession(context: Context, title: String, text: String) {
      if (!isRunning) return
      if (!canPostNotifications(context)) return
      ensureChannel(context)
      runCatching {
        NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, buildNotification(context, title, text))
      }
    }

    fun stopSession(context: Context) {
      isRunning = false
      runCatching { context.stopService(Intent(context, BackgroundSessionService::class.java)) }
    }

    private fun canPostNotifications(context: Context): Boolean =
      Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
        ContextCompat.checkSelfPermission(context, "android.permission.POST_NOTIFICATIONS") ==
        PackageManager.PERMISSION_GRANTED

    private fun ensureChannel(context: Context) {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
      val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
      if (manager.getNotificationChannel(CHANNEL_ID) != null) return
      // IMPORTANCE_LOW: silent and never a heads-up. The beeps come from this
      // service's own players, not from the notification.
      val channel = NotificationChannel(CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_LOW).apply {
        description = "Keeps the round timer running while the screen is off"
        setShowBadge(false)
        enableVibration(false)
        setSound(null, null)
      }
      manager.createNotificationChannel(channel)
    }

    private fun buildNotification(context: Context, title: String, text: String): Notification {
      val builder = NotificationCompat.Builder(context, CHANNEL_ID)
        .setSmallIcon(R.drawable.ic_background_session)
        .setContentTitle(title)
        .setContentText(text)
        .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
        .setOngoing(true)
        .setSilent(true)
        .setShowWhen(false)
        .setOnlyAlertOnce(true)
        .addAction(
          0,
          "Stop",
          PendingIntent.getService(
            context,
            1,
            Intent(context, BackgroundSessionService::class.java).setAction(ACTION_STOP),
            pendingIntentFlags()
          )
        )

      contentIntent(context)?.let { builder.setContentIntent(it) }
      return builder.build()
    }

    /** Tapping the notification brings the app back to the front. */
    private fun contentIntent(context: Context): PendingIntent? {
      val launch = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return null
      launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      return runCatching {
        PendingIntent.getActivity(context, 0, launch, pendingIntentFlags())
      }.getOrNull()
    }

    private fun pendingIntentFlags(): Int {
      var flags = PendingIntent.FLAG_UPDATE_CURRENT
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        flags = flags or PendingIntent.FLAG_IMMUTABLE
      }
      return flags
    }
  }
}
