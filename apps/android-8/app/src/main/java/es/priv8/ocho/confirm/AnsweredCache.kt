package es.priv8.ocho.confirm

import org.json.JSONObject

/**
 * The approval_results already given, so a true re-send of a confirm_request
 * (contracts v1.1: the core re-sends pending requests after each hello) gets
 * the same answer again and the person is never asked twice.
 *
 * Ids alone are not enough: a restarted core counts again from `c1`, and a
 * new, different request must never inherit an old approval. An answer is
 * therefore tied to the exact request: session + id + [ConfirmRequest.fingerprint]
 * (SHA-256 of the canonical confirm_request). Only an exact match is answered
 * from here; anything else is a new request for the person.
 *
 * The hello carries no core instance id (bridge.schema.json), so the device
 * cannot tell a reconnect from a restarted core. On every new connection
 * ([onConnected]) the answers that already went out are dropped: a core that
 * received one has closed that request and will not re-send it. Only answers
 * that could not be sent (bridge down) are kept, so a lost answer still
 * reaches the core after the reconnect. Every answer is also dropped once the
 * request's own expires_s has passed, since the core refuses it by then.
 *
 * Not thread-safe: [ConfirmFlow] uses it from the main thread only.
 */
class AnsweredCache(
    private val max: Int = 32,
    private val clock: () -> Long = System::currentTimeMillis,
) {
    private class Entry(val request: ConfirmRequest, val result: JSONObject, var delivered: Boolean, val expiresAt: Long)

    /** Insertion order, oldest first. Keyed by session + id: at most one answer per id. */
    private val entries = LinkedHashMap<String, Entry>()

    val size: Int get() = entries.size

    /** Stores [result] for [request]. [receivedAt] is when the request arrived (ms, same clock). */
    fun put(request: ConfirmRequest, result: JSONObject, delivered: Boolean, receivedAt: Long = clock()) {
        val key = slot(request)
        entries.remove(key)
        entries[key] = Entry(request, result, delivered, receivedAt + request.expiresS * 1000L)
        while (entries.size > max) entries.remove(entries.keys.first())
    }

    /**
     * The answer to repeat for [request], or null if it must go to the person.
     * A stored answer for the same session and id but a different request is
     * stale (another core instance) and is dropped.
     */
    fun lookup(request: ConfirmRequest): JSONObject? {
        prune()
        val key = slot(request)
        val e = entries[key] ?: return null
        if (e.request.fingerprint != request.fingerprint) {
            entries.remove(key)
            return null
        }
        return e.result
    }

    /** The answer for [request] went out (again) through the bridge. */
    fun delivered(request: ConfirmRequest) {
        entries[slot(request)]?.takeIf { it.request.fingerprint == request.fingerprint }?.delivered = true
    }

    /** A new bridge connection (hello just sent): keep only answers still owed to the core. */
    fun onConnected() {
        entries.values.removeAll { it.delivered }
        prune()
    }

    /** A request for [session] arrived: answers from other sessions are not asked for again. */
    fun onSession(session: String) {
        entries.values.removeAll { it.request.session != session }
    }

    private fun prune() {
        val now = clock()
        entries.values.removeAll { now >= it.expiresAt }
    }

    private fun slot(r: ConfirmRequest) = "${r.session}\u0000${r.id}"
}
