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

    @Test
    public void oldListenerLifecycleCannotDisconnectANewerGeneration() {
        ListenerConnectionState state = new ListenerConnectionState();
        long first = state.connected();
        long second = state.connected();

        assertFalse(state.disconnected(first));
        assertTrue(state.isConnected());
        assertTrue(state.disconnected(second));
        assertFalse(state.isConnected());
    }

    @Test
    public void snapshotLeaseOutlivesMultipleHealthScans() {
        assertTrue(NavSessionController.SNAPSHOT_TTL_MS
                >= NavNotificationListener.ACTIVE_SCAN_INTERVAL_MS * 3L);
    }
}
