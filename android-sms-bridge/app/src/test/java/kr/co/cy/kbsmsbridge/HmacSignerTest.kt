package kr.co.cy.kbsmsbridge

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class HmacSignerTest {
    @Test
    fun `matches known HMAC SHA-256 vector`() {
        val result = HmacSigner.hmacSha256Hex(
            key = "key".toByteArray(),
            input = "The quick brown fox jumps over the lazy dog".toByteArray(),
        )

        assertEquals(
            "f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8",
            result,
        )
    }

    @Test
    fun `signs timestamp nonce and exact body bytes with newline separators`() {
        val body = "{\"amount\":1200000}".toByteArray(Charsets.UTF_8)

        val signed = HmacSigner.sign(
            secret = "0123456789abcdef0123456789abcdef",
            timestamp = "1760000000000",
            nonce = "test-nonce",
            body = body,
        )
        assertEquals(
            "ebf8440c06584af602de3aa0ffefa79929fdab04b7aeee056347411b8c565390",
            signed,
        )
    }

    @Test
    fun `body byte change produces a different signature`() {
        val first = HmacSigner.sign("secret", "1", "n", "A".toByteArray())
        val second = HmacSigner.sign("secret", "1", "n", "B".toByteArray())

        assertNotEquals(first, second)
    }
}
