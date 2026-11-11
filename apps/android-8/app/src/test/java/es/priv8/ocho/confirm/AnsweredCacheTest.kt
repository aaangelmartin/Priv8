package es.priv8.ocho.confirm

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class AnsweredCacheTest {
    private var now = 1_000L
    private val cache = AnsweredCache(max = 4) { now }

    private fun msg(id: String = "c1", session: String = "demo", amount: String = "‹IMPORTE_1·positivo›", target: String = "e7") =
        JSONObject(
            """
            {"type":"confirm_request","id":"$id","session":"$session","kind":"transferir",
             "action":{"op":"tap","target":"$target","label":"Enviar"},
             "summary":[{"voice":"cloud","text":"Vas a enviar"},{"voice":"local","token":"$amount","say_as":"currency"},
                        {"voice":"cloud","text":"¿Lo confirmas?"}],
             "channels":["voz","pantalla"],"sca":"persona","expires_s":300}
            """.trimIndent(),
        )

    private fun req(m: JSONObject) = ConfirmRequest.parse(m)!!

    private fun approved(id: String = "c1") =
        JSONObject().put("type", "approval_result").put("id", id).put("ok", true).put("via", "voz").put("by", "persona")

    @Test fun fingerprintIgnoresKeyOrderButNotContent() {
        val a = req(msg())
        val reordered = JSONObject()
        val src = msg()
        src.keys().asSequence().toList().reversed().forEach { reordered.put(it, src.get(it)) }
        assertEquals(a.fingerprint, req(reordered).fingerprint)
        assertNotEquals(a.fingerprint, req(msg(target = "e8")).fingerprint) // action is covered too
        assertNotEquals(a.fingerprint, req(msg(amount = "‹IMPORTE_2·positivo›")).fingerprint)
    }

    @Test fun exactResendGetsTheSameAnswer() {
        val r = req(msg())
        cache.put(r, approved(), delivered = false)
        val again = cache.lookup(req(msg()))
        assertNotNull(again)
        assertEquals(true, again!!.getBoolean("ok"))
        assertEquals("c1", again.getString("id"))
    }

    @Test fun sameIdDifferentContentIsNew() {
        cache.put(req(msg()), approved(), delivered = false)
        // A restarted core counts from c1 again: same session and id, different request.
        assertNull(cache.lookup(req(msg(amount = "‹IMPORTE_9·positivo›"))))
        // The stale answer is gone: not even the old request matches now.
        assertNull(cache.lookup(req(msg())))
        assertEquals(0, cache.size)
    }

    @Test fun otherSessionDoesNotMatch() {
        cache.put(req(msg()), approved(), delivered = false)
        assertNull(cache.lookup(req(msg(session = "otra"))))
        cache.onSession("otra")
        assertEquals(0, cache.size)
    }

    @Test fun newHelloKeepsOnlyAnswersStillOwed() {
        val lost = req(msg(id = "c1"))
        val delivered = req(msg(id = "c2"))
        cache.put(lost, approved("c1"), delivered = false) // bridge was down
        cache.put(delivered, approved("c2"), delivered = true)
        cache.onConnected()
        // The answer that never left is re-sent after the reconnect (#85)...
        assertNotNull(cache.lookup(lost))
        // ...the one the core already got is forgotten: a re-send of c2 now
        // can only come from another core instance, so the person is asked.
        assertNull(cache.lookup(delivered))
        // Once re-sent, the next hello forgets it too.
        cache.delivered(lost)
        cache.onConnected()
        assertNull(cache.lookup(lost))
    }

    @Test fun answersExpireWithTheRequest() {
        val r = req(msg())
        cache.put(r, approved(), delivered = false, receivedAt = now)
        now += 299_000
        assertNotNull(cache.lookup(r))
        now += 1_000
        assertNull(cache.lookup(r))
    }

    @Test fun keepsTheLastMax() {
        (1..6).forEach { cache.put(req(msg(id = "c$it")), approved("c$it"), delivered = false) }
        assertEquals(4, cache.size)
        assertNull(cache.lookup(req(msg(id = "c1"))))
        assertNotNull(cache.lookup(req(msg(id = "c6"))))
    }
}
