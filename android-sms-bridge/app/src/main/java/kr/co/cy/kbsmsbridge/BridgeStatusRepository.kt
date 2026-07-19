package kr.co.cy.kbsmsbridge

import android.content.Context

data class BridgeStatus(
    val lastReceivedAt: Long,
    val lastDeliveredAt: Long,
    val lastErrorAt: Long,
    val lastError: String,
    val lastEvent: String,
)

class BridgeStatusRepository(context: Context) {
    private val preferences = context.applicationContext.getSharedPreferences(
        PREFERENCES_NAME,
        Context.MODE_PRIVATE,
    )

    fun load() = BridgeStatus(
        lastReceivedAt = preferences.getLong(KEY_LAST_RECEIVED_AT, 0),
        lastDeliveredAt = preferences.getLong(KEY_LAST_DELIVERED_AT, 0),
        lastErrorAt = preferences.getLong(KEY_LAST_ERROR_AT, 0),
        lastError = preferences.getString(KEY_LAST_ERROR, "").orEmpty(),
        lastEvent = preferences.getString(KEY_LAST_EVENT, "").orEmpty(),
    )

    fun recordReceived(at: Long) {
        preferences.edit()
            .putLong(KEY_LAST_RECEIVED_AT, at)
            .putString(KEY_LAST_EVENT, "허용된 은행 문자를 암호화 대기열에 저장함")
            .apply()
    }

    fun recordRejected(at: Long) {
        preferences.edit()
            .putString(KEY_LAST_EVENT, "허용되지 않은 발신자의 문자를 차단함")
            .putLong(KEY_LAST_EVENT_AT, at)
            .apply()
    }

    fun recordQueued(eventType: String, at: Long) {
        val label = if (eventType == BridgeEnvelope.EVENT_CONNECTION_TEST) {
            "연결 테스트를 전송 대기열에 추가함"
        } else {
            "문자를 전송 대기열에 추가함"
        }
        preferences.edit()
            .putString(KEY_LAST_EVENT, label)
            .putLong(KEY_LAST_EVENT_AT, at)
            .apply()
    }

    fun recordDelivered(eventType: String, at: Long) {
        val label = if (eventType == BridgeEnvelope.EVENT_CONNECTION_TEST) {
            "연결 테스트 성공"
        } else {
            "은행 문자 전달 성공"
        }
        preferences.edit()
            .putLong(KEY_LAST_DELIVERED_AT, at)
            .putString(KEY_LAST_EVENT, label)
            .remove(KEY_LAST_ERROR)
            .remove(KEY_LAST_ERROR_AT)
            .apply()
    }

    fun recordError(safeMessage: String, at: Long = System.currentTimeMillis()) {
        preferences.edit()
            .putLong(KEY_LAST_ERROR_AT, at)
            .putString(KEY_LAST_ERROR, safeMessage.take(MAX_STATUS_CHARS))
            .putString(KEY_LAST_EVENT, "전달 오류 발생")
            .apply()
    }

    private companion object {
        const val PREFERENCES_NAME = "bridge_status"
        const val KEY_LAST_RECEIVED_AT = "last_received_at"
        const val KEY_LAST_DELIVERED_AT = "last_delivered_at"
        const val KEY_LAST_ERROR_AT = "last_error_at"
        const val KEY_LAST_ERROR = "last_error"
        const val KEY_LAST_EVENT = "last_event"
        const val KEY_LAST_EVENT_AT = "last_event_at"
        const val MAX_STATUS_CHARS = 240
    }
}
