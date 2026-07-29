package com.ringmap.nav;

import org.junit.Test;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotEquals;
import static org.junit.Assert.assertTrue;

public class NavSessionControllerTest {

    private static NavSessionController controller() {
        return new NavSessionController(new NavSessionController.SessionIdFactory() {
            private int next = 1;

            @Override
            public String create() {
                return "session-" + next++;
            }
        });
    }

    private static NavInstruction instruction(String raw, String action, int distance, String road) {
        String distanceText = distance > 0 ? distance + "米" : "";
        return new NavInstruction(raw, action, distance, distanceText, road);
    }

    @Test
    public void assignsSessionAndMonotonicSequence() {
        NavSessionController controller = controller();

        NavSessionController.Decision first = controller.accept(
                "com.autonavi.minimap", "key-a",
                instruction("前方200米左转进入中山路", "turn_left", 200, "中山路"),
                1000L, 1010L, 1020L);
        NavSessionController.Decision second = controller.accept(
                "com.autonavi.minimap", "key-b",
                instruction("前方100米左转进入中山路", "turn_left", 100, "中山路"),
                3000L, 3010L, 3020L);

        assertTrue(first.accepted);
        assertTrue(second.accepted);
        assertEquals("session-1", first.sessionId);
        assertEquals(first.sessionId, second.sessionId);
        assertEquals(1L, first.seq);
        assertEquals(2L, second.seq);
    }

    @Test
    public void suppressesSemanticDuplicatesInsideWindowButAllowsRefreshLater() {
        NavSessionController controller = controller();
        NavInstruction instruction = instruction("前方200米左转进入中山路", "turn_left", 200, "中山路");

        NavSessionController.Decision first = controller.accept(
                "com.autonavi.minimap", "key-a", instruction, 1000L, 1010L, 1020L);
        NavSessionController.Decision duplicate = controller.accept(
                "com.autonavi.minimap", "key-b", instruction, 1100L, 1110L, 1120L);
        NavSessionController.Decision refresh = controller.accept(
                "com.autonavi.minimap", "key-c", instruction, 3000L, 3010L, 3020L);

        assertTrue(first.accepted);
        assertFalse(duplicate.accepted);
        assertEquals("duplicate", duplicate.reason);
        assertTrue(refresh.accepted);
        assertEquals(2L, refresh.seq);
        assertEquals(first.fingerprint, refresh.fingerprint);
    }

    @Test
    public void partialBannerCannotOverwriteFreshCompleteInstruction() {
        NavSessionController controller = controller();
        controller.accept(
                "com.autonavi.minimap", "key-a",
                instruction("前方200米右转进入中山路", "turn_right", 200, "中山路"),
                1000L, 1010L, 1020L);

        NavSessionController.Decision partial = controller.accept(
                "com.autonavi.minimap", "key-banner",
                instruction("高德地图持续为您导航", "wait", 0, ""),
                2000L, 2010L, 2020L);

        assertFalse(partial.accepted);
        assertEquals("partial_over_complete", partial.reason);
    }

    @Test
    public void locksSourceUntilCurrentSessionEnds() {
        NavSessionController controller = controller();
        controller.accept(
                "com.autonavi.minimap", "amap",
                instruction("前方200米直行", "straight", 200, ""),
                1000L, 1010L, 1020L);

        NavSessionController.Decision foreign = controller.accept(
                "com.baidu.BaiduMap", "baidu",
                instruction("前方100米右转", "turn_right", 100, ""),
                2000L, 2010L, 2020L);

        assertFalse(foreign.accepted);
        assertEquals("source_locked", foreign.reason);
    }

    @Test
    public void staleSourceCanBeReplacedByAnotherSupportedMap() {
        NavSessionController controller = controller();
        NavSessionController.Decision first = controller.accept(
                "com.autonavi.minimap", "amap",
                instruction("前方200米直行", "straight", 200, ""),
                1000L, 1010L, 1020L);

        NavSessionController.Decision switched = controller.accept(
                "com.baidu.BaiduMap", "baidu",
                instruction("前方100米右转", "turn_right", 100, ""),
                100_000L, 100_010L, 100_020L);

        assertTrue(switched.accepted);
        assertNotEquals(first.sessionId, switched.sessionId);
        assertEquals("com.baidu.BaiduMap", switched.sourcePackage);
        assertEquals(1L, switched.seq);
    }

    @Test
    public void endCarriesCurrentSessionAndNewNavigationGetsNewSession() {
        NavSessionController controller = controller();
        NavSessionController.Decision first = controller.accept(
                "com.autonavi.minimap", "amap",
                instruction("前方200米直行", "straight", 200, ""),
                1000L, 1010L, 1020L);

        NavSessionController.EndDecision end = controller.end("com.autonavi.minimap", 2000L);
        NavSessionController.Decision next = controller.accept(
                "com.baidu.BaiduMap", "baidu",
                instruction("前方100米右转", "turn_right", 100, ""),
                3000L, 3010L, 3020L);

        assertTrue(end.accepted);
        assertEquals(first.sessionId, end.sessionId);
        assertEquals(2L, end.seq);
        assertTrue(next.accepted);
        assertNotEquals(first.sessionId, next.sessionId);
        assertEquals(1L, next.seq);
    }

    @Test
    public void endFromDifferentSourceCannotTerminateCurrentSession() {
        NavSessionController controller = controller();
        controller.accept(
                "com.autonavi.minimap", "amap",
                instruction("前方200米直行", "straight", 200, ""),
                1000L, 1010L, 1020L);

        NavSessionController.EndDecision end = controller.end("com.baidu.BaiduMap", 2000L);

        assertFalse(end.accepted);
        assertEquals("source_mismatch", end.reason);
        assertTrue(controller.isActive());
    }
}
