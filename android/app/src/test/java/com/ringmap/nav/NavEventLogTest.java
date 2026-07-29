package com.ringmap.nav;

import org.junit.Test;

import java.util.List;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

public class NavEventLogTest {

    @Test
    public void keepsNewestEventsWithinCapacity() {
        NavEventLog log = new NavEventLog(3);
        log.add(1L, "监听", "one");
        log.add(2L, "解析", "two");
        log.add(3L, "桥接", "three");
        log.add(4L, "手表", "four");

        List<NavEvent> events = log.snapshot();
        assertEquals(3, events.size());
        assertEquals("four", events.get(0).message);
        assertEquals("two", events.get(2).message);
    }

    @Test
    public void normalizesMultilineAndOverlongMessages() {
        NavEventLog log = new NavEventLog(3);
        log.add(1L, " 监听\n", "line one\nline two " + "x".repeat(300));

        NavEvent event = log.snapshot().get(0);
        assertEquals("监听", event.category);
        assertFalse(event.message.contains("\n"));
        assertTrue(event.message.length() <= 160);
    }
}
