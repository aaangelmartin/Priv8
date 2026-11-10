package es.priv8.banks

import java.math.BigInteger
import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

/** Importes en céntimos, con el formato de España: 3.412,58 € (agrupa también los miles de cuatro cifras). */
object Money {
    private val format = DecimalFormat("#,##0.00", DecimalFormatSymbols(Locale.ROOT).apply {
        groupingSeparator = '.'
        decimalSeparator = ','
    })

    fun format(cents: Long): String {
        val sign = if (cents < 0) "-" else ""
        return sign + format.format(Math.abs(cents) / 100.0) + " €"
    }

    fun formatSigned(cents: Long): String = if (cents > 0) "+" + format(cents) else format(cents)

    /** Acepta "200", "200,50", "200.50" y "1.200,50". Devuelve null si no es un importe válido. */
    fun parse(input: String): Long? {
        var s = input.trim().replace("€", "").replace(" ", "")
        if (s.isEmpty()) return null
        if (s.contains(',')) {
            s = s.replace(".", "").replace(',', '.')
        } else if (s.count { it == '.' } > 1 || Regex("""^\d{1,3}(\.\d{3})+$""").matches(s)) {
            s = s.replace(".", "")
        }
        if (!Regex("""^\d+(\.\d{1,2})?$""").matches(s)) return null
        val parts = s.split('.')
        val euros = parts[0].toLongOrNull() ?: return null
        val cents = if (parts.size > 1) parts[1].padEnd(2, '0').toLong() else 0L
        return euros * 100 + cents
    }
}

object Iban {
    fun normalize(input: String): String = input.replace(" ", "").replace("-", "").uppercase(Locale.ROOT)

    /** IBAN español: ES + 22 dígitos, con control mod-97. */
    fun isValid(input: String): Boolean {
        val iban = normalize(input)
        if (!Regex("""^ES\d{22}$""").matches(iban)) return false
        val rearranged = iban.substring(4) + iban.substring(0, 4)
        val numeric = rearranged.map { c -> if (c.isDigit()) c.toString() else (c - 'A' + 10).toString() }.joinToString("")
        return BigInteger(numeric).mod(BigInteger.valueOf(97)).toInt() == 1
    }

    fun format(input: String): String = normalize(input).chunked(4).joinToString(" ")
}

object Dates {
    private val shown = DateTimeFormatter.ofPattern("d MMM yyyy", Locale("es", "ES"))
    fun format(iso: String): String = LocalDate.parse(iso).format(shown)
}
