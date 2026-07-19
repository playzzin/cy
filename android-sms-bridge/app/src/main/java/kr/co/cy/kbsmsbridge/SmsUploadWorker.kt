package kr.co.cy.kbsmsbridge

import android.content.Context
import androidx.work.Worker
import androidx.work.WorkerParameters

class SmsUploadWorker(
    appContext: Context,
    workerParams: WorkerParameters,
) : Worker(appContext, workerParams) {
    override fun doWork(): Result {
        val queueId = inputData.getString(INPUT_QUEUE_ID) ?: return Result.failure()
        val queue = SmsQueueStore(applicationContext)
        val status = BridgeStatusRepository(applicationContext)

        val envelope = try {
            queue.get(queueId)
        } catch (_: Exception) {
            status.recordError("암호화 대기열을 읽을 수 없습니다. 앱 설정을 확인하세요.")
            return Result.failure()
        } ?: return Result.success()

        val config = try {
            BridgeConfigRepository(applicationContext).load()
        } catch (_: Exception) {
            status.recordError("보안 저장소를 읽을 수 없습니다. 기기 보안 상태를 확인하세요.")
            return Result.failure()
        }

        if (config.endpoint.isBlank() || config.secret.isNullOrBlank()) {
            status.recordError("수신 주소와 공유 비밀키를 먼저 설정하세요.")
            return Result.retry()
        }
        if (envelope.deviceId != config.deviceId) {
            status.recordError("대기 항목의 기기 ID가 현재 등록과 다릅니다. 관리자가 확인해야 합니다.")
            return Result.failure()
        }

        return when (val delivery = DeliveryClient().deliver(config.endpoint, config.secret, envelope)) {
            DeliveryResult.Accepted -> {
                try {
                    queue.remove(queueId)
                    status.recordDelivered(envelope.eventType, System.currentTimeMillis())
                    Result.success()
                } catch (_: Exception) {
                    // The same nonce makes a later duplicate delivery safe for an idempotent server.
                    status.recordError("전달 후 대기열 정리에 실패했습니다. 다시 시도합니다.")
                    Result.retry()
                }
            }
            is DeliveryResult.Retryable -> {
                status.recordError(delivery.safeReason)
                Result.retry()
            }
            is DeliveryResult.PermanentFailure -> {
                // Keep the encrypted item so an administrator can fix configuration and retry it.
                status.recordError(delivery.safeReason)
                Result.failure()
            }
        }
    }

    companion object {
        const val INPUT_QUEUE_ID = "queue_id"
    }
}
