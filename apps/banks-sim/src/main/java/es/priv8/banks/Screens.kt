package es.priv8.banks

import android.content.Intent
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.view.inputmethod.EditorInfo
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_WEAK
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat

/** Base de todas las pantallas: carga el seed y, salvo en el login, exige sesión. */
abstract class BankActivity : AppCompatActivity() {
    open val needsLogin = true

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Bank.load(this)
        if (needsLogin && !Bank.loggedIn) {
            startActivity(Intent(this, LoginActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TASK or Intent.FLAG_ACTIVITY_NEW_TASK))
            finish()
        }
    }

    protected fun text(id: Int, value: CharSequence) {
        findViewById<TextView>(id).text = value
    }

    protected fun showError(id: Int, message: String?) {
        val v = findViewById<TextView>(id)
        v.text = message ?: ""
        v.visibility = if (message == null) View.GONE else View.VISIBLE
    }

    protected fun goHome() {
        startActivity(Intent(this, HomeActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP))
        finish()
    }

    /** Intro en el teclado (acción "hecho" del IME o tecla Enter física / KEYCODE_ENTER) ejecuta [action]. */
    protected fun EditText.onDone(action: () -> Unit) {
        setOnEditorActionListener { _, actionId, event ->
            when {
                // Tecla física: actúa al bajar y consume también la subida, para no disparar dos veces.
                event != null && event.keyCode == KeyEvent.KEYCODE_ENTER -> {
                    if (event.action == KeyEvent.ACTION_DOWN) action()
                    true
                }
                actionId == EditorInfo.IME_ACTION_DONE -> { action(); true }
                else -> false
            }
        }
    }

    protected fun bindBack() {
        findViewById<Button>(R.id.btn_volver).setOnClickListener { finish() }
    }
}

class LoginActivity : BankActivity() {
    companion object {
        /** Solo depuración: `--ez reset true` vuelve al seed y a la sesión de la demo. */
        const val EXTRA_RESET = "reset"
    }

    override val needsLogin = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val reset = BuildConfig.DEBUG && intent.getBooleanExtra(EXTRA_RESET, false)
        if (reset) Bank.reset(this)
        // Con sesión (guardada, o la de la demo en depuración) se entra directo al inicio.
        // La autenticación de cada transferencia (huella o SMS) la sigue haciendo la persona.
        if (Bank.loggedIn) {
            val home = Intent(this, HomeActivity::class.java)
            if (reset) home.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TASK or Intent.FLAG_ACTIVITY_NEW_TASK)
            startActivity(home)
            finish()
            return
        }
        setContentView(R.layout.activity_login)
        val user = findViewById<EditText>(R.id.usuario)
        val pass = findViewById<EditText>(R.id.clave)
        val enter = findViewById<Button>(R.id.btn_entrar)
        enter.setOnClickListener {
            if (Bank.login(user.text.toString(), pass.text.toString())) {
                pass.text.clear()
                showError(R.id.login_error, null)
                startActivity(Intent(this, HomeActivity::class.java))
                finish()
            } else {
                pass.text.clear()
                showError(R.id.login_error, getString(R.string.login_error))
            }
        }
        pass.onDone { enter.performClick() }
    }
}

class HomeActivity : BankActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!Bank.loggedIn) return
        setContentView(R.layout.activity_home)
        findViewById<Button>(R.id.btn_salir).setOnClickListener {
            Bank.logout()
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
        }
        findViewById<Button>(R.id.btn_transferir).setOnClickListener {
            startActivity(Intent(this, TransferActivity::class.java))
        }
        findViewById<Button>(R.id.btn_movimientos).setOnClickListener {
            startActivity(Intent(this, MovementsActivity::class.java))
        }
    }

    override fun onResume() {
        super.onResume()
        if (!Bank.loggedIn) return
        text(R.id.saludo, getString(R.string.home_greeting, Bank.userName))
        text(R.id.saldo_total, Money.format(Bank.totalCents()))
        val list = findViewById<LinearLayout>(R.id.lista_cuentas)
        list.removeAllViews()
        for (a in Bank.accounts) {
            val row = layoutInflater.inflate(R.layout.item_cuenta, list, false)
            row.findViewById<TextView>(R.id.cuenta_alias).text = a.alias
            row.findViewById<TextView>(R.id.cuenta_iban).text = Iban.format(a.iban)
            row.findViewById<TextView>(R.id.cuenta_saldo).text = Money.format(a.balanceCents)
            row.contentDescription = getString(R.string.home_account_open, a.alias)
            row.setOnClickListener {
                startActivity(Intent(this, MovementsActivity::class.java).putExtra(MovementsActivity.EXTRA_ACCOUNT, a.id))
            }
            list.addView(row)
        }
    }
}

class MovementsActivity : BankActivity() {
    companion object { const val EXTRA_ACCOUNT = "account" }

    private var accountIndex = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!Bank.loggedIn) return
        setContentView(R.layout.activity_movements)
        bindBack()
        val requested = intent.getStringExtra(EXTRA_ACCOUNT)
        accountIndex = Bank.accounts.indexOfFirst { it.id == requested }.coerceAtLeast(0)
        val other = findViewById<Button>(R.id.btn_otra_cuenta)
        other.visibility = if (Bank.accounts.size > 1) View.VISIBLE else View.GONE
        other.setOnClickListener {
            accountIndex = (accountIndex + 1) % Bank.accounts.size
            render()
        }
        render()
    }

    private fun render() {
        val a = Bank.accounts[accountIndex]
        text(R.id.mov_cuenta_alias, a.alias)
        text(R.id.mov_cuenta_iban, Iban.format(a.iban))
        text(R.id.mov_cuenta_saldo, Money.format(a.balanceCents))
        val list = findViewById<LinearLayout>(R.id.lista_movimientos)
        list.removeAllViews()
        val items = Bank.movementsOf(a.id)
        findViewById<View>(R.id.mov_vacio).visibility = if (items.isEmpty()) View.VISIBLE else View.GONE
        for (m in items) {
            val row = layoutInflater.inflate(R.layout.item_movimiento, list, false)
            row.findViewById<TextView>(R.id.mov_fecha).text = Dates.format(m.date)
            row.findViewById<TextView>(R.id.mov_concepto).text = m.concept
            row.findViewById<TextView>(R.id.mov_contraparte).text = m.counterparty
            val amount = row.findViewById<TextView>(R.id.mov_importe)
            amount.text = Money.formatSigned(m.amountCents)
            amount.setTextColor(ContextCompat.getColor(this, if (m.amountCents < 0) R.color.bank_text else R.color.bank_positive))
            list.addView(row)
        }
    }
}

class TransferActivity : BankActivity() {
    private var originIndex = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!Bank.loggedIn) return
        setContentView(R.layout.activity_transfer)
        bindBack()
        val iban = findViewById<EditText>(R.id.iban_destino)
        val name = findViewById<EditText>(R.id.beneficiario)
        val amount = findViewById<EditText>(R.id.importe)
        val concept = findViewById<EditText>(R.id.concepto)

        val change = findViewById<Button>(R.id.btn_cambiar_origen)
        change.visibility = if (Bank.accounts.size > 1) View.VISIBLE else View.GONE
        change.setOnClickListener {
            originIndex = (originIndex + 1) % Bank.accounts.size
            renderOrigin()
        }
        renderOrigin()

        val list = findViewById<LinearLayout>(R.id.lista_contactos)
        for (c in Bank.contacts) {
            val row = layoutInflater.inflate(R.layout.item_contacto, list, false)
            row.findViewById<TextView>(R.id.contacto_nombre).text = c.name
            row.findViewById<TextView>(R.id.contacto_iban).text = Iban.format(c.iban)
            row.setOnClickListener {
                iban.setText(Iban.format(c.iban))
                name.setText(c.name)
                amount.requestFocus()
            }
            list.addView(row)
        }

        findViewById<Button>(R.id.btn_continuar).setOnClickListener {
            val from = Bank.accounts[originIndex]
            val cents = Money.parse(amount.text.toString())
            val error = when {
                !Iban.isValid(iban.text.toString()) -> getString(R.string.transfer_error_iban)
                Iban.normalize(iban.text.toString()) == from.iban -> getString(R.string.transfer_error_same)
                name.text.isBlank() -> getString(R.string.transfer_error_name)
                cents == null || cents <= 0 -> getString(R.string.transfer_error_amount)
                cents > from.balanceCents -> getString(R.string.transfer_error_balance)
                else -> null
            }
            showError(R.id.transfer_error, error)
            if (error == null) {
                Bank.pending = PendingTransfer(from.id, Iban.normalize(iban.text.toString()), name.text.toString().trim(), cents!!, concept.text.toString().trim())
                startActivity(Intent(this, ReviewActivity::class.java))
            }
        }
    }

    private fun renderOrigin() {
        val a = Bank.accounts[originIndex]
        text(R.id.origen_alias, a.alias)
        text(R.id.origen_iban, Iban.format(a.iban))
        text(R.id.origen_saldo, getString(R.string.transfer_available, Money.format(a.balanceCents)))
    }
}

class ReviewActivity : BankActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!Bank.loggedIn) return
        val t = Bank.pending ?: run { finish(); return }
        setContentView(R.layout.activity_review)
        bindBack()
        val from = Bank.account(t.fromAccountId)
        text(R.id.rev_origen_alias, from.alias)
        text(R.id.rev_origen_iban, Iban.format(from.iban))
        text(R.id.rev_iban_destino, Iban.format(t.toIban))
        text(R.id.rev_beneficiario, t.beneficiary)
        text(R.id.rev_importe, Money.format(t.amountCents))
        text(R.id.rev_concepto, t.concept.ifBlank { getString(R.string.review_no_concept) })
        findViewById<Button>(R.id.btn_enviar).setOnClickListener {
            startActivity(Intent(this, AuthActivity::class.java))
        }
        findViewById<Button>(R.id.btn_cancelar).setOnClickListener {
            Bank.pending = null
            goHome()
        }
    }
}

/** Paso de autenticación: huella con BiometricPrompt del sistema o código SMS (OTP). Lo hace siempre la persona. */
class AuthActivity : BankActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!Bank.loggedIn) return
        if (Bank.pending == null) { finish(); return }
        setContentView(R.layout.activity_auth)
        text(R.id.auth_importe, Money.format(Bank.pending!!.amountCents))

        val fingerprint = findViewById<Button>(R.id.btn_huella)
        val canUse = BiometricManager.from(this).canAuthenticate(BIOMETRIC_WEAK) == BiometricManager.BIOMETRIC_SUCCESS
        if (canUse) {
            text(R.id.huella_estado, getString(R.string.auth_fingerprint_ready))
            fingerprint.setOnClickListener { promptBiometric() }
        } else {
            fingerprint.isEnabled = false
            text(R.id.huella_estado, getString(R.string.auth_fingerprint_unavailable))
        }

        val otp = findViewById<EditText>(R.id.otp)
        val confirm = findViewById<Button>(R.id.btn_confirmar_otp)
        confirm.setOnClickListener {
            if (Bank.checkOtp(otp.text.toString())) {
                otp.text.clear()
                complete()
            } else {
                otp.text.clear()
                showError(R.id.otp_error, getString(R.string.auth_otp_error))
            }
        }
        otp.onDone { confirm.performClick() }
        findViewById<Button>(R.id.btn_cancelar).setOnClickListener {
            Bank.pending = null
            goHome()
        }
    }

    private fun promptBiometric() {
        val prompt = BiometricPrompt(this, ContextCompat.getMainExecutor(this), object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) = complete()
            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                text(R.id.huella_estado, getString(R.string.auth_fingerprint_failed))
            }
        })
        val info = BiometricPrompt.PromptInfo.Builder()
            .setTitle(getString(R.string.auth_prompt_title, Bank.name))
            .setSubtitle(getString(R.string.auth_prompt_subtitle))
            .setNegativeButtonText(getString(R.string.auth_prompt_use_code))
            .setAllowedAuthenticators(BIOMETRIC_WEAK)
            .build()
        prompt.authenticate(info)
    }

    private fun complete() {
        if (Bank.pending == null) return
        Bank.execute()
        startActivity(Intent(this, SuccessActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP))
        finish()
    }
}

class SuccessActivity : BankActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!Bank.loggedIn) return
        val r = Bank.lastResult ?: run { goHome(); return }
        setContentView(R.layout.activity_success)
        text(R.id.res_importe, Money.format(r.transfer.amountCents))
        text(R.id.res_beneficiario, r.transfer.beneficiary)
        text(R.id.res_iban_destino, Iban.format(r.transfer.toIban))
        text(R.id.res_referencia, r.reference)
        text(R.id.res_fecha, Dates.format(r.date))
        findViewById<Button>(R.id.btn_inicio).setOnClickListener { goHome() }
        // Atrás lleva al inicio, no de vuelta al paso de autenticación.
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() = goHome()
        })
    }
}
