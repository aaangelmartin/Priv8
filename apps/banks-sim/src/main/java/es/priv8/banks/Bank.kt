package es.priv8.banks

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONObject
import java.time.LocalDate

data class Account(val id: String, val alias: String, val iban: String, var balanceCents: Long)

data class Contact(val id: String, val name: String, val iban: String, val own: Boolean)

data class Movement(
    val accountId: String,
    val date: String,
    val concept: String,
    val counterparty: String,
    val amountCents: Long,
)

data class PendingTransfer(
    val fromAccountId: String,
    val toIban: String,
    val beneficiary: String,
    val amountCents: Long,
    val concept: String,
)

data class TransferResult(val transfer: PendingTransfer, val reference: String, val date: String)

/**
 * Sesión de la app (el login, no la autenticación de cada transferencia).
 * Se guarda en SharedPreferences para que sobreviva al proceso.
 */
object Session {
    const val PREFS = "sesion"
    const val KEY_LOGGED_IN = "logged_in"

    /**
     * Sesión al arrancar: la guardada si la hay; si no, en depuración se entra
     * ya con el usuario del seed (la demo empieza dentro del banco) y en release no.
     * Un logout guarda `false`, así que salir sigue funcionando también en depuración.
     */
    fun initial(stored: Boolean?, debug: Boolean): Boolean = stored ?: debug
}

/**
 * Estado del banco simulado. Saldos y movimientos viven en memoria: se cargan
 * del JSON de datos del sabor (BuildConfig.SEED_ASSET) y cada proceso nuevo
 * vuelve al seed, así que un ensayo se repite igual. La sesión sí se guarda
 * ([Session]). En depuración, `--ez reset true` en el arranque vuelve al seed
 * y a la sesión de la demo sin cerrar la app (ver README.md).
 */
object Bank {
    lateinit var name: String; private set
    lateinit var userLogin: String; private set
    private lateinit var userPassword: String
    lateinit var userName: String; private set
    private lateinit var otp: String

    val accounts = mutableListOf<Account>()
    val contacts = mutableListOf<Contact>()
    val movements = mutableListOf<Movement>()

    var loggedIn = false; private set
    var pending: PendingTransfer? = null
    var lastResult: TransferResult? = null; private set
    private var loaded = false
    private var counter = 0

    private var prefs: SharedPreferences? = null

    fun load(context: Context) {
        if (loaded) return
        val p = context.applicationContext.getSharedPreferences(Session.PREFS, Context.MODE_PRIVATE)
        prefs = p
        val stored = if (p.contains(Session.KEY_LOGGED_IN)) p.getBoolean(Session.KEY_LOGGED_IN, false) else null
        loggedIn = Session.initial(stored, BuildConfig.DEBUG)
        val text = context.assets.open(BuildConfig.SEED_ASSET).bufferedReader(Charsets.UTF_8).use { it.readText() }
        val root = JSONObject(text)
        name = root.getJSONObject("bank").getString("name")
        val user = root.getJSONObject("user")
        userLogin = user.getString("login")
        userPassword = user.getString("password")
        userName = user.getString("name")
        otp = user.getString("otp")

        val acc = root.getJSONArray("accounts")
        for (i in 0 until acc.length()) {
            val o = acc.getJSONObject(i)
            accounts += Account(o.getString("id"), o.getString("alias"), o.getString("iban"), o.getLong("balance_cents"))
        }
        val con = root.optJSONArray("contacts")
        if (con != null) for (i in 0 until con.length()) {
            val o = con.getJSONObject(i)
            contacts += Contact(o.getString("id"), o.getString("name"), o.getString("iban"), o.optBoolean("own"))
        }
        val mov = root.getJSONArray("movements")
        for (i in 0 until mov.length()) {
            val o = mov.getJSONObject(i)
            movements += Movement(
                o.getString("account"), o.getString("date"), o.getString("concept"),
                o.getString("counterparty"), o.getLong("amount_cents"),
            )
        }
        loaded = true
    }

    /** Vuelve al seed (saldos, movimientos) y a la sesión inicial, como un proceso nuevo. */
    fun reset(context: Context) {
        context.applicationContext.getSharedPreferences(Session.PREFS, Context.MODE_PRIVATE)
            .edit().remove(Session.KEY_LOGGED_IN).commit()
        accounts.clear()
        contacts.clear()
        movements.clear()
        pending = null
        lastResult = null
        counter = 0
        loaded = false
        load(context)
    }

    fun login(user: String, password: String): Boolean {
        loggedIn = user.trim().equals(userLogin, ignoreCase = true) && password == userPassword
        if (loggedIn) saveSession()
        return loggedIn
    }

    fun logout() {
        loggedIn = false
        pending = null
        saveSession()
    }

    private fun saveSession() {
        prefs?.edit()?.putBoolean(Session.KEY_LOGGED_IN, loggedIn)?.apply()
    }

    fun checkOtp(code: String): Boolean = code.trim() == otp

    fun account(id: String): Account = accounts.first { it.id == id }

    fun totalCents(): Long = accounts.sumOf { it.balanceCents }

    fun movementsOf(accountId: String): List<Movement> =
        movements.filter { it.accountId == accountId }.sortedByDescending { it.date }

    /** Ejecuta la transferencia pendiente: resta el saldo y apunta el movimiento. */
    fun execute(): TransferResult {
        val t = requireNotNull(pending) { "No hay transferencia pendiente" }
        val from = account(t.fromAccountId)
        from.balanceCents -= t.amountCents
        val today = LocalDate.now().toString()
        val concept = t.concept.ifBlank { "Transferencia" }
        movements += Movement(from.id, today, concept, t.beneficiary, -t.amountCents)
        // Si el destino es otra cuenta propia del mismo banco, el dinero entra en ella.
        accounts.firstOrNull { it.iban == Iban.normalize(t.toIban) && it.id != from.id }?.let { to ->
            to.balanceCents += t.amountCents
            movements += Movement(to.id, today, concept, userName, t.amountCents)
        }
        counter += 1
        val result = TransferResult(t, "TR-%s-%04d".format(today.replace("-", ""), counter), today)
        lastResult = result
        pending = null
        return result
    }
}
