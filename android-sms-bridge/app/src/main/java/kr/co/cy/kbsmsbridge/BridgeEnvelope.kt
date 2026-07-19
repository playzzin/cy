package kr.co.cy.kbsmsbridge

import org.json.JSONObject
import java.util.UUID

data class BridgeEnvelope(
    val eventType: String,
    val deviceId: String,
    val sender: String,
    val message: String,
    val receivedAt: Long,
    val queuedAt: Long,
    val nonce: String,
) {
    fun toJson(): String = JSONObject()
        .put("version", VERSION)
        .put("eventType", eventType)
        .put("deviceId", deviceId)
        .put("sender", sender)
        .put("message", message)
        .put("receivedAt", receivedAt)
        .put("queuedAt", queuedAt)
        .put("nonce", nonce)
        .toString()

    companion object {
        const val VERSION = 1
        const val EVENT_BANK_SMS = "bank_sms"
        const val EVENT_CONNECTION_TEST = "connection_test"

        fun bankSms(
            deviceId: String,
            sender: String,
            message: String,
            receivedAt: Long,
            now: Long = System.currentTimeMillis(),
        ) = BridgeEnvelope(
            eventType = EVENT_BANK_SMS,
            deviceId = deviceId,
            sender = sender,
            message = message,
            receivedAt = receivedAt,
            queuedAt = now,
            nonce = UUID.randomUUID().toString(),
        )

        fun connectionTest(deviceId: String, now: Long = System.currentTimeMillis()) = BridgeEnvelope(
            eventType = EVENT_CONNECTION_TEST,
            deviceId = deviceId,
            sender = "",
            message = "",
            receivedAt = now,
            queuedAt = now,
            nonce = UUID.randomUUID().toString(),
        )

        fun fromJson(raw: String): BridgeEnvelope {
            val json = JSONObject(raw)
            require(json.getInt("version") == VERSION) { "Unsupported envelope version" }
            return BridgeEnvelope(
                eventType = json.getString("eventType"),
                deviceId = json.getString("deviceId"),
                sender = json.getString("sender"),
                message = json.getString("message"),
                receivedAt = json.getLong("receivedAt"),
                queuedAt = json.getLong("queuedAt"),
                nonce = json.getString("nonce"),
            )
        }
    }
}
