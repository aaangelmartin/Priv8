package es.priv8.banks

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SessionTest {
    @Test fun debugWithoutSessionStartsLoggedIn() = assertTrue(Session.initial(stored = null, debug = true))

    @Test fun releaseWithoutSessionShowsLogin() = assertFalse(Session.initial(stored = null, debug = false))

    @Test fun logoutIsKeptInDebug() = assertFalse(Session.initial(stored = false, debug = true))

    @Test fun savedLoginIsKept() = assertTrue(Session.initial(stored = true, debug = false))
}
