package com.ringmap.nav;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class LastNavCacheTest {
    @Test
    public void appliedAckCannotBeDowngradedByAnotherClient() {
        assertTrue(LastNavCache.ackStatusAdvances("", "accepted"));
        assertTrue(LastNavCache.ackStatusAdvances("accepted", "applied"));
        assertFalse(LastNavCache.ackStatusAdvances("applied", "accepted"));
        assertFalse(LastNavCache.ackStatusAdvances("applied", "applied"));
    }

    @Test
    public void freshnessUsesTheSnapshotAbsoluteExpiry() {
        assertTrue(LastNavCache.isFreshAt(1_000L, 45_000L, 46_000L));
        assertFalse(LastNavCache.isFreshAt(1_000L, 45_000L, 46_001L));
        assertFalse(LastNavCache.isFreshAt(0L, 45_000L, 1_000L));
    }
}
