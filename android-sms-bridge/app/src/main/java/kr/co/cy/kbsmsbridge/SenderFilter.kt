package kr.co.cy.kbsmsbridge

import java.util.Locale

object SenderFilter {
    private val separators = Regex("[,;\\n\\r]+")

    fun parseAllowlist(raw: String): Set<String> = raw
        .split(separators)
        .map(::normalize)
        .filter(String::isNotEmpty)
        .toSet()

    fun isAllowed(sender: String?, rawAllowlist: String): Boolean {
        val normalizedSender = normalize(sender.orEmpty())
        return normalizedSender.isNotEmpty() && normalizedSender in parseAllowlist(rawAllowlist)
    }

    internal fun normalize(value: String): String {
        val compact = value
            .trim()
            .lowercase(Locale.ROOT)
            .filter(Char::isLetterOrDigit)

        if (compact.isEmpty() || !compact.all(Char::isDigit)) return compact

        // Android may expose a Korean number either as 010... or +82 10....
        return if (compact.startsWith("82") && compact.length >= 10) {
            "0${compact.drop(2)}"
        } else {
            compact
        }
    }
}
