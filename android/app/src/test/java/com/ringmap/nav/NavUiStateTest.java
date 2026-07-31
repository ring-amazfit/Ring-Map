package com.ringmap.nav;

import org.junit.Test;

import static org.junit.Assert.assertEquals;

public class NavUiStateTest {

    private NavUiState.Builder readyBase() {
        return new NavUiState.Builder()
                .notificationAccess(true)
                .listenerConnected(true)
                .serviceRunning(true)
                .serviceState("运行中")
                .clientCount(1)
                .lastAckAt(10_000L)
                .ackStatus("accepted")
                .now(20_000L);
    }

    @Test
    public void derivesReadinessInPriorityOrder() {
        assertEquals(NavUiState.Readiness.NEEDS_PERMISSION,
                new NavUiState.Builder().now(100L).build().readiness());
        assertEquals(NavUiState.Readiness.SERVICE_STOPPED,
                new NavUiState.Builder().notificationAccess(true).now(100L).build().readiness());
        assertEquals(NavUiState.Readiness.SERVICE_STOPPED,
                new NavUiState.Builder().notificationAccess(true).listenerConnected(true)
                        .now(100L).build().readiness());
        assertEquals(NavUiState.Readiness.SERVICE_ERROR,
                new NavUiState.Builder().notificationAccess(true).listenerConnected(true)
                        .serviceError("port unavailable").now(100L).build().readiness());
        assertEquals(NavUiState.Readiness.WAITING_BRIDGE,
                new NavUiState.Builder().notificationAccess(true).listenerConnected(true)
                        .serviceRunning(true).now(100L).build().readiness());
        assertEquals(NavUiState.Readiness.WAITING_WATCH_ACK,
                new NavUiState.Builder().notificationAccess(true).listenerConnected(true)
                        .serviceRunning(true).clientCount(1).now(100_000L).build().readiness());
        assertEquals(NavUiState.Readiness.READY, readyBase().build().readiness());
        assertEquals(NavUiState.Readiness.NAVIGATING,
                readyBase().navigating(true).sessionId("session-a").seq(4).build().readiness());
    }

    @Test
    public void acknowledgedCurrentSequenceDoesNotExpireLikeAHeartbeat() {
        NavUiState state = readyBase()
                .navigating(true)
                .sessionId("session-a")
                .seq(4)
                .ackStatus("applied")
                .lastAckAt(10_000L)
                .now(50_001L)
                .build();

        assertEquals(NavUiState.Readiness.NAVIGATING, state.readiness());
    }

    @Test
    public void reportsListenerReconnectOnlyAfterTheBridgeIsRunning() {
        assertEquals(NavUiState.Readiness.CONNECTING_LISTENER,
                new NavUiState.Builder().notificationAccess(true)
                        .listenerConnected(false)
                        .serviceRunning(true)
                        .serviceState("监听桥运行中")
                        .now(100L)
                        .build()
                        .readiness());
    }

    @Test
    public void calculatesMeasuredLatencyWithoutMixingClockDomains() {
        NavUiState state = readyBase()
                .emittedAt(1000L)
                .bridgeReceivedAt(1120L)
                .bridgeSentAt(1140L)
                .watchReceivedAt(5000L)
                .watchAppliedAt(5085L)
                .ackRoundTripMs(430L)
                .build();

        assertEquals(120L, state.bridgeReceiveMs());
        assertEquals(20L, state.bridgeDispatchMs());
        assertEquals(85L, state.watchApplyMs());
        assertEquals(430L, state.ackRoundTripMs);
    }
}
