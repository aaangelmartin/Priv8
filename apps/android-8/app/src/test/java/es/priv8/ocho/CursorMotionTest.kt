package es.priv8.ocho

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CursorMotionTest {

    @Test fun glideStaysBetween350And500Ms() {
        assertEquals(350L, CursorMotion.glideMs(0f, 0f, 2.75f))
        val mid = CursorMotion.glideMs(300f, 0f, 2.75f) // ~109 dp
        assertTrue(mid in 351L..499L)
        assertEquals(500L, CursorMotion.glideMs(3000f, 2000f, 2.75f))
        assertEquals(500L, CursorMotion.glideMs(3000f, 2000f, 0f)) // bad density: still bounded
    }

    @Test fun easingGoesFrom0To1() {
        assertEquals(0f, CursorMotion.ease(0f), 1e-6f)
        assertEquals(0.5f, CursorMotion.ease(0.5f), 1e-6f)
        assertEquals(1f, CursorMotion.ease(1f), 1e-6f)
        assertEquals(1f, CursorMotion.ease(2f), 1e-6f)
        assertTrue(CursorMotion.ease(0.25f) < 0.25f && CursorMotion.ease(0.75f) > 0.75f)
    }

    @Test fun hiddenDuringEveryPauseAndConfirmation() {
        assertTrue(CursorMotion.visible(null, confirming = false))
        assertFalse(CursorMotion.visible(null, confirming = true))
        for (p in listOf(Pause.AUTH, Pause.DIALOG, Pause.CONFIRM, Pause.OWN)) {
            assertFalse(p, CursorMotion.visible(p, confirming = false))
        }
    }

    @Test fun typingStepsArePrefixesAndBounded() {
        assertEquals(emptyList<String>(), CursorMotion.typingSteps(""))
        assertEquals(emptyList<String>(), CursorMotion.typingSteps("7"))
        assertEquals(listOf("2"), CursorMotion.typingSteps("20"))
        val text = "ES91 2100 0418 4502 0005 1332"
        val steps = CursorMotion.typingSteps(text)
        assertTrue(steps.size <= CursorMotion.TYPE_STEPS)
        assertTrue(steps.all { text.startsWith(it) && it.length < text.length })
        assertEquals(steps.sortedBy { it.length }, steps)
        // Bounded added time: steps x step pause plus the 500 ms glide stays under 0.8 s.
        assertTrue(CursorMotion.TYPE_STEPS * CursorMotion.TYPE_STEP_MS + CursorMotion.GLIDE_MAX_MS <= 800)
    }
}
