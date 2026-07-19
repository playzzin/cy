package kr.co.cy.kbsmsbridge

import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

sealed interface DeliveryResult {
    data object Accepted : DeliveryResult
    data class Retryable(val safeReason: String) : DeliveryResult
    data class PermanentFailure(val safeReason: String) : DeliveryResult
}

class DeliveryClient {
    fun deliver(endpoint: String, secret: String, envelope: BridgeEnvelope): DeliveryResult {
        val body = envelope.toJson().toByteArray(Charsets.UTF_8)
        val requestTimestamp = System.currentTimeMillis().toString()
        val signature = HmacSigner.sign(secret, requestTimestamp, envelope.nonce, body)

        var connection: HttpURLConnection? = null
        return try {
            connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = CONNECT_TIMEOUT_MS
                readTimeout = READ_TIMEOUT_MS
                instanceFollowRedirects = false
                doOutput = true
                useCaches = false
                setFixedLengthStreamingMode(body.size)
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
                setRequestProperty("Accept", "application/json")
                setRequestProperty("User-Agent", "Cy-KB-SMS-Bridge/1")
                setRequestProperty("X-Sms-Bridge-Version", BridgeEnvelope.VERSION.toString())
                setRequestProperty("X-Sms-Bridge-Device", envelope.deviceId)
                setRequestProperty("X-Sms-Bridge-Timestamp", requestTimestamp)
                setRequestProperty("X-Sms-Bridge-Nonce", envelope.nonce)
                setRequestProperty("X-Sms-Bridge-Signature", "sha256=$signature")
            }

            connection.outputStream.use { it.write(body) }
            val code = connection.responseCode
            closeResponse(connection, code)

            when {
                code in 200..299 || code == HTTP_DUPLICATE -> DeliveryResult.Accepted
                code in RETRYABLE_CODES || code >= 500 -> {
                    DeliveryResult.Retryable("서버가 재시도를 요청했습니다 (HTTP $code).")
                }
                else -> DeliveryResult.PermanentFailure("서버가 요청을 거부했습니다 (HTTP $code).")
            }
        } catch (_: IOException) {
            DeliveryResult.Retryable("네트워크 연결에 실패했습니다. 자동으로 다시 시도합니다.")
        } catch (_: SecurityException) {
            DeliveryResult.PermanentFailure("보안 정책으로 네트워크 연결을 열 수 없습니다.")
        } finally {
            connection?.disconnect()
        }
    }

    private fun closeResponse(connection: HttpURLConnection, code: Int) {
        runCatching {
            if (code >= 400) connection.errorStream?.close() else connection.inputStream?.close()
        }
    }

    private companion object {
        const val CONNECT_TIMEOUT_MS = 15_000
        const val READ_TIMEOUT_MS = 15_000
        const val HTTP_DUPLICATE = 409
        val RETRYABLE_CODES = setOf(408, 425, 429)
    }
}
