package expo.modules.backgroundsession

import android.Manifest
import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import expo.modules.interfaces.permissions.Permissions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val EVENT_STOP_REQUESTED = "onStopRequested"

/**
 * JS surface for [BackgroundSessionService]. Deliberately thin: the timer state
 * stays in JS, this only starts/stops the service and repaints its notification.
 */
class BackgroundSessionModule : Module() {
  private val mainHandler = Handler(Looper.getMainLooper())

  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("BackgroundSession")

    Events(EVENT_STOP_REQUESTED)

    OnCreate {
      BackgroundSessionService.onStopRequested = {
        mainHandler.post {
          runCatching { sendEvent(EVENT_STOP_REQUESTED, emptyMap<String, Any?>()) }
        }
      }
    }

    OnDestroy {
      BackgroundSessionService.onStopRequested = null
      // A dev reload or a killed activity must not leave a stuck ongoing
      // notification behind — there is no JS runtime left to drive it.
      runCatching { BackgroundSessionService.stopSession(context) }
    }

    AsyncFunction("getNotificationPermissionAsync") { promise: Promise ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
        promise.resolve(grantedResponse())
      } else {
        Permissions.getPermissionsWithPermissionsManager(
          appContext.permissions,
          promise,
          Manifest.permission.POST_NOTIFICATIONS
        )
      }
    }

    AsyncFunction("requestNotificationPermissionAsync") { promise: Promise ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
        promise.resolve(grantedResponse())
      } else {
        Permissions.askForPermissionsWithPermissionsManager(
          appContext.permissions,
          promise,
          Manifest.permission.POST_NOTIFICATIONS
        )
      }
    }

    // Doubles because JS numbers cross the bridge as doubles; epoch milliseconds
    // are far inside the 2^53 range where that is lossless.
    Function("startSession") {
        title: String,
        text: String,
        startEpochMs: Double,
        boundariesEpochMs: DoubleArray,
        labels: List<String>,
        maxDurationMs: Double
      ->
      BackgroundSessionService.startSession(
        context,
        title,
        text,
        startEpochMs.toLong(),
        LongArray(boundariesEpochMs.size) { boundariesEpochMs[it].toLong() },
        ArrayList(labels),
        maxDurationMs.toLong()
      )
    }

    Function("pauseSession") { title: String, text: String ->
      BackgroundSessionService.pauseSession(title, text)
    }

    Function("stopSession") {
      BackgroundSessionService.stopSession(context)
    }
  }

  /** Shape of an expo PermissionResponse, for the pre-Android-13 shortcut. */
  private fun grantedResponse(): Map<String, Any> = mapOf(
    "status" to "granted",
    "expires" to "never",
    "canAskAgain" to true,
    "granted" to true
  )
}
