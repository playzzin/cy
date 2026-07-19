package kr.co.cy.kbsmsbridge

import android.content.Context
import java.util.UUID

/**
 * SMS bodies are encrypted before persistence. WorkManager receives only an opaque queue ID,
 * so its database never contains the bank message or HMAC secret.
 */
class SmsQueueStore(context: Context) {
    private val secureStore = KeystoreSecretStore(context.applicationContext)

    fun enqueue(envelope: BridgeEnvelope): String {
        val id = UUID.randomUUID().toString()
        secureStore.put(key(id), envelope.toJson())
        return id
    }

    fun get(id: String): BridgeEnvelope? = secureStore.get(key(id))?.let(BridgeEnvelope::fromJson)

    fun remove(id: String) = secureStore.remove(key(id))

    fun listIds(): Set<String> = secureStore.keysWithPrefix(KEY_PREFIX)
        .mapTo(mutableSetOf()) { it.removePrefix(KEY_PREFIX) }

    fun count(): Int = listIds().size

    private fun key(id: String) = "$KEY_PREFIX$id"

    private companion object {
        const val KEY_PREFIX = "queue:"
    }
}
