package kr.co.cy.kbsmsbridge

import android.content.Context
import java.net.URI
import java.util.UUID

data class BridgeConfig(
    val endpoint: String,
    val allowedSenders: String,
    val deviceId: String,
    val secret: String?,
) {
    val isComplete: Boolean
        get() = endpoint.isNotBlank() && allowedSenders.isNotBlank() && !secret.isNullOrBlank()
}

class BridgeConfigRepository(context: Context) {
    private val appContext = context.applicationContext
    private val preferences = appContext.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
    private val secureStore = KeystoreSecretStore(appContext)

    fun load(): BridgeConfig = BridgeConfig(
        endpoint = preferences.getString(KEY_ENDPOINT, "").orEmpty(),
        allowedSenders = preferences.getString(KEY_ALLOWED_SENDERS, DEFAULT_ALLOWED_SENDERS)
            .orEmpty(),
        deviceId = getOrCreateDeviceId(),
        secret = secureStore.get(KEY_SECRET),
    )

    /** A blank [newSecret] preserves an already configured secret. */
    fun save(endpoint: String, allowedSenders: String, newSecret: String) {
        val normalizedEndpoint = endpoint.trim()
        validateEndpoint(normalizedEndpoint)
        require(SenderFilter.parseAllowlist(allowedSenders).isNotEmpty()) {
            "허용 발신번호를 하나 이상 입력하세요."
        }

        val trimmedSecret = newSecret.trim()
        val existingSecret = secureStore.get(KEY_SECRET)
        if (trimmedSecret.isEmpty()) {
            require(!existingSecret.isNullOrBlank()) { "공유 비밀키를 입력하세요." }
        } else {
            require(trimmedSecret.toByteArray(Charsets.UTF_8).size >= MIN_SECRET_BYTES) {
                "공유 비밀키는 32바이트 이상이어야 합니다."
            }
            secureStore.put(KEY_SECRET, trimmedSecret)
        }

        check(
            preferences.edit()
                .putString(KEY_ENDPOINT, normalizedEndpoint)
                .putString(KEY_ALLOWED_SENDERS, allowedSenders.trim())
                .commit(),
        ) { "설정을 저장하지 못했습니다." }
    }

    private fun getOrCreateDeviceId(): String {
        preferences.getString(KEY_DEVICE_ID, null)?.let { return it }
        val generated = UUID.randomUUID().toString()
        check(preferences.edit().putString(KEY_DEVICE_ID, generated).commit()) {
            "기기 ID를 저장하지 못했습니다."
        }
        return generated
    }

    private fun validateEndpoint(endpoint: String) {
        val uri = runCatching { URI(endpoint) }.getOrNull()
        require(
            uri != null &&
                uri.scheme.equals("https", ignoreCase = true) &&
                !uri.host.isNullOrBlank() &&
                uri.userInfo == null &&
                uri.fragment == null,
        ) { "수신 주소는 유효한 HTTPS 주소여야 합니다." }
    }

    private companion object {
        const val PREFERENCES_NAME = "bridge_config"
        const val KEY_ENDPOINT = "endpoint"
        const val KEY_ALLOWED_SENDERS = "allowed_senders"
        const val KEY_DEVICE_ID = "device_id"
        const val KEY_SECRET = "hmac_secret"
        const val MIN_SECRET_BYTES = 32
        const val DEFAULT_ALLOWED_SENDERS = "15889999"
    }
}
