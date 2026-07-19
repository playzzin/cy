package kr.co.cy.kbsmsbridge

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.Data
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequest
import androidx.work.PeriodicWorkRequest
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

object BridgeScheduler {
    fun enqueue(context: Context, queueId: String, replaceExisting: Boolean = false) {
        val request = OneTimeWorkRequest.Builder(SmsUploadWorker::class.java)
            .setInputData(Data.Builder().putString(SmsUploadWorker.INPUT_QUEUE_ID, queueId).build())
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build(),
            )
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .addTag(WORK_TAG)
            .build()

        WorkManager.getInstance(context.applicationContext).enqueueUniqueWork(
            "$UNIQUE_PREFIX$queueId",
            if (replaceExisting) ExistingWorkPolicy.REPLACE else ExistingWorkPolicy.KEEP,
            request,
        )
    }

    fun enqueueAll(context: Context, replaceExisting: Boolean = false) {
        SmsQueueStore(context).listIds().forEach { enqueue(context, it, replaceExisting) }
    }

    /**
     * Keeps the server-side bridge health fresh even when no bank transaction occurs.
     * WorkManager may defer this while the device is idle; the server therefore uses
     * a wider stale threshold than the 15-minute requested interval.
     */
    fun ensureHeartbeat(context: Context) {
        val request = PeriodicWorkRequest.Builder(
            BridgeHeartbeatWorker::class.java,
            HEARTBEAT_INTERVAL_MINUTES,
            TimeUnit.MINUTES,
            HEARTBEAT_FLEX_MINUTES,
            TimeUnit.MINUTES,
        )
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build(),
            )
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .addTag(HEARTBEAT_TAG)
            .build()

        WorkManager.getInstance(context.applicationContext).enqueueUniquePeriodicWork(
            HEARTBEAT_WORK_NAME,
            ExistingPeriodicWorkPolicy.KEEP,
            request,
        )
    }

    private const val WORK_TAG = "kb-sms-upload"
    private const val UNIQUE_PREFIX = "kb-sms-upload-"
    private const val HEARTBEAT_TAG = "kb-sms-heartbeat"
    private const val HEARTBEAT_WORK_NAME = "kb-sms-bridge-heartbeat"
    private const val HEARTBEAT_INTERVAL_MINUTES = 15L
    private const val HEARTBEAT_FLEX_MINUTES = 5L
}
