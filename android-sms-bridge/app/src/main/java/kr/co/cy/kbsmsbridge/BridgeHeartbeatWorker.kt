package kr.co.cy.kbsmsbridge

import android.content.Context
import androidx.work.Worker
import androidx.work.WorkerParameters

/** Sends a signed, content-free connection check without persisting an SMS. */
class BridgeHeartbeatWorker(
    appContext: Context,
    workerParams: WorkerParameters,
) : Worker(appContext, workerParams) {
    override fun doWork(): Result {
        val status = BridgeStatusRepository(applicationContext)
        val config = try {
            BridgeConfigRepository(applicationContext).load()
        } catch (_: Exception) {
            status.recordError("자동 연결 확인에서 보안 저장소를 읽을 수 없습니다.")
            return Result.success()
        }

        if (!config.isComplete) return Result.success()
        val secret = config.secret ?: return Result.success()
        val envelope = BridgeEnvelope.connectionTest(config.deviceId)

        return when (val delivery = DeliveryClient().deliver(config.endpoint, secret, envelope)) {
            DeliveryResult.Accepted -> {
                status.recordDelivered(envelope.eventType, System.currentTimeMillis())
                Result.success()
            }
            is DeliveryResult.Retryable -> {
                status.recordError(delivery.safeReason)
                Result.retry()
            }
            is DeliveryResult.PermanentFailure -> {
                // A permanent response often means configuration changed. Keep the
                // periodic worker alive so saving corrected settings recovers itself.
                status.recordError(delivery.safeReason)
                Result.success()
            }
        }
    }
}
