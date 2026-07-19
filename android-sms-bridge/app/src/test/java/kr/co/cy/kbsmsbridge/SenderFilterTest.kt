package kr.co.cy.kbsmsbridge

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SenderFilterTest {
    @Test
    fun `accepts exact number despite display punctuation`() {
        assertTrue(SenderFilter.isAllowed("1588-9999", "15889999"))
    }

    @Test
    fun `normalizes Korean country code`() {
        assertTrue(SenderFilter.isAllowed("+82 10-1234-5678", "01012345678"))
    }

    @Test
    fun `accepts configured alphanumeric or Korean sender case insensitively`() {
        assertTrue(SenderFilter.isAllowed("Kb 국민은행", "15889999, KB국민은행"))
    }

    @Test
    fun `does not use unsafe substring matching`() {
        assertFalse(SenderFilter.isAllowed("0215889999", "15889999"))
        assertFalse(SenderFilter.isAllowed("KB국민은행사칭", "KB국민은행"))
    }

    @Test
    fun `deny is the default when allowlist is empty`() {
        assertFalse(SenderFilter.isAllowed("15889999", "  \n  "))
        assertFalse(SenderFilter.isAllowed(null, "15889999"))
    }
}
