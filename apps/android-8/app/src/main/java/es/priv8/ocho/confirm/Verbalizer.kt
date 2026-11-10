package es.priv8.ocho.confirm

import java.math.BigDecimal
import java.math.RoundingMode

/**
 * Spanish verbalization for the local voice, so TextToSpeech says
 * «doscientos euros» and not «dos cero cero coma cero cero».
 *
 * Kotlin port of `voice/verbalize.py` (branch feat/voz-mixta, PR #60), with
 * the same rules: Spanish amount format (1.234,56 €), apocope before a noun
 * (veintiún euros), «un millón de euros», identifiers read character by
 * character. Runs on the device only; its output never leaves it.
 */
object Verbalizer {

    private val UNITS = listOf(
        "cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve",
        "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete",
        "dieciocho", "diecinueve", "veinte", "veintiuno", "veintidós", "veintitrés",
        "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve",
    )
    private val TENS = mapOf(
        3 to "treinta", 4 to "cuarenta", 5 to "cincuenta", 6 to "sesenta",
        7 to "setenta", 8 to "ochenta", 9 to "noventa",
    )
    private val HUNDREDS = mapOf(
        1 to "ciento", 2 to "doscientos", 3 to "trescientos", 4 to "cuatrocientos", 5 to "quinientos",
        6 to "seiscientos", 7 to "setecientos", 8 to "ochocientos", 9 to "novecientos",
    )
    private const val MAX = 999_999_999_999L

    private fun apocope(words: String): String = when {
        words.endsWith("veintiuno") -> words.removeSuffix("veintiuno") + "veintiún"
        words == "uno" || words.endsWith(" uno") -> words.dropLast(1)
        else -> words
    }

    private fun belowThousand(n: Int): String {
        require(n in 0..999)
        if (n < 30) return UNITS[n]
        if (n < 100) {
            val unit = n % 10
            return TENS.getValue(n / 10) + if (unit != 0) " y ${UNITS[unit]}" else ""
        }
        if (n == 100) return "cien"
        val rest = n % 100
        return HUNDREDS.getValue(n / 100) + if (rest != 0) " ${belowThousand(rest)}" else ""
    }

    /** Cardinal in Spanish, masculine. [apocope] for use before a noun (veintiún euros). */
    fun number(n: Long, apocope: Boolean = false): String {
        if (n < 0) return "menos " + number(-n, apocope)
        require(n <= MAX) { "number too large to verbalize" }
        if (n < 1000) return belowThousand(n.toInt()).let { if (apocope) apocope(it) else it }
        val parts = mutableListOf<String>()
        val millions = n / 1_000_000
        val rest = n % 1_000_000
        if (millions > 0) parts += if (millions == 1L) "un millón" else "${number(millions, apocope = true)} millones"
        val thousands = (rest / 1000).toInt()
        val units = (rest % 1000).toInt()
        if (thousands > 0) parts += if (thousands == 1) "mil" else "${apocope(belowThousand(thousands))} mil"
        if (units > 0) parts += belowThousand(units).let { if (apocope) apocope(it) else it }
        return parts.joinToString(" ")
    }

    private val AMOUNT = Regex("""^\s*([-−+]?)\s*(?:€\s*)?(\d[\d.\s ]*(?:,\d+)?)\s*(?:€|eur|euros?)?\s*$""", RegexOption.IGNORE_CASE)
    private val THOUSANDS_ONLY = Regex("""\d{1,3}\.\d{3}""")

    /** '1.234,56 €', '-200 €', '200.00', '3.412,5' → BigDecimal. */
    fun parseAmount(text: String): BigDecimal {
        val m = AMOUNT.matchEntire(text) ?: throw IllegalArgumentException("not an amount")
        var num = m.groupValues[2].replace(Regex("""[\s ]"""), "")
        num = when {
            "," in num -> num.replace(".", "").replace(",", ".")
            num.count { it == '.' } == 1 && !THOUSANDS_ONLY.matches(num) -> num // 1234.56: decimal point
            else -> num.replace(".", "")
        }
        val value = BigDecimal(num)
        return if (m.groupValues[1] == "-" || m.groupValues[1] == "−") value.negate() else value
    }

    /** '200,00 €' → 'doscientos euros'; '1.234,56' → 'mil doscientos treinta y cuatro euros con cincuenta y seis'. */
    fun amount(text: String): String = amount(parseAmount(text))

    fun amount(value: BigDecimal): String {
        val sign = if (value.signum() < 0) "menos " else ""
        val abs = value.abs().setScale(2, RoundingMode.HALF_UP)
        val euros = abs.toBigInteger().toLong()
        val cents = abs.subtract(BigDecimal(euros)).movePointRight(2).toInt()
        if (euros == 0L && cents > 0) {
            return "$sign${number(cents.toLong(), apocope = true)} ${if (cents == 1) "céntimo" else "céntimos"}"
        }
        val joiner = if (euros >= 1_000_000 && euros % 1_000_000 == 0L) " de " else " "
        var out = "$sign${number(euros, apocope = true)}$joiner${if (euros == 1L) "euro" else "euros"}"
        if (cents > 0) out += " con ${number(cents.toLong())}"
        return out
    }

    /** 'ES91 2100' → 'E S nueve uno, dos uno cero cero'. */
    fun characters(text: String): String =
        text.trim().split(Regex("""[\s\-]+""")).filter { it.isNotEmpty() }.map { group ->
            group.filter { it.isLetterOrDigit() }.map { ch ->
                if (ch.isDigit()) UNITS[ch.digitToInt()] else ch.uppercaseChar().toString()
            }.joinToString(" ")
        }.filter { it.isNotEmpty() }.joinToString(", ")

    /** A real value spelled out per the say_as enum of voice.schema.json. Falls back to the value as is. */
    fun say(value: String, sayAs: String?): String = try {
        when (sayAs) {
            "currency" -> amount(value)
            "number" -> number(parseAmount(value).toLong())
            "digits", "phone", "iban" -> characters(value)
            else -> value // text, name, date: the engine reads them as they are
        }
    } catch (e: IllegalArgumentException) {
        value
    } catch (e: ArithmeticException) {
        value
    }
}
