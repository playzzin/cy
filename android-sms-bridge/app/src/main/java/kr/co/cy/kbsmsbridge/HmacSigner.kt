package kr.co.cy.kbsmsbridge

import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

object HmacSigner {
    private const val ALGORITHM = "HmacSHA256"

    fun sign(secret: String, timestamp: String, nonce: String, body: ByteArray): String {
        val prefix = "$timestamp\n$nonce\n".toByteArray(Charsets.UTF_8)
        val input = ByteArray(prefix.size + body.size)
        prefix.copyInto(input)
        body.copyInto(input, prefix.size)
        return hmacSha256Hex(secret.toByteArray(Charsets.UTF_8), input)
    }

    internal fun hmacSha256Hex(key: ByteArray, input: ByteArray): String {
        val mac = Mac.getInstance(ALGORITHM)
        mac.init(SecretKeySpec(key, ALGORITHM))
        return mac.doFinal(input).joinToString(separator = "") { byte ->
            "%02x".format(byte.toInt() and 0xff)
        }
    }
}
