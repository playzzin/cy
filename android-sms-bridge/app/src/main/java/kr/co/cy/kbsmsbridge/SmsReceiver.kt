package kr.co.cy.kbsmsbridge

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import java.util.concurrent.Executors

class SmsReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        val pendingResult = goAsync()
        EXECUTOR.execute {
            try {
                receive(context.applicationContext, intent)
            } finally {
                pendingResult.finish()
            }
        }
    }

    private fun receive(context: Context, intent: Intent) {
        val status = BridgeStatusRepository(context)
        try {
            val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
            if (messages.isEmpty()) return

            val senders = messages.mapNotNull { it.originatingAddress }.distinct()
            if (senders.size != 1) {
                status.recordError("발신자를 확정할 수 없는 문자를 차단했습니다.")
                return
            }
            val sender = senders.single()
            val config = BridgeConfigRepository(context).load()
            if (!SenderFilter.isAllowed(sender, config.allowedSenders)) {
                status.recordRejected(System.currentTimeMillis())
                return
            }

            val body = messages.joinToString(separator = "") { it.messageBody.orEmpty() }
            if (body.isBlank() || body.length > MAX_SMS_CHARS) {
                status.recordError("비어 있거나 허용 길이를 초과한 문자를 차단했습니다.")
                return
            }

            val receivedAt = messages.minOfOrNull { it.timestampMillis }
                ?.takeIf { it > 0 }
                ?: System.currentTimeMillis()
            val envelope = BridgeEnvelope.bankSms(
                deviceId = config.deviceId,
                sender = sender,
                message = body,
                receivedAt = receivedAt,
            )
            val queueId = SmsQueueStore(context).enqueue(envelope)
            status.recordReceived(receivedAt)
            BridgeScheduler.enqueue(context, queueId)
            // Also recovers any encrypted item persisted before a previous process interruption.
            BridgeScheduler.enqueueAll(context)
        } catch (_: Exception) {
            // Never log the exception: platform messages can contain the raw SMS as context.
            status.recordError("문자 수신 처리에 실패했습니다. 앱 설정과 기기 보안을 확인하세요.")
        }
    }

    private companion object {
        const val MAX_SMS_CHARS = 10_000
        val EXECUTOR = Executors.newSingleThreadExecutor { runnable ->
            Thread(runnable, "sms-bridge-receiver").apply { isDaemon = true }
        }
    }
}
