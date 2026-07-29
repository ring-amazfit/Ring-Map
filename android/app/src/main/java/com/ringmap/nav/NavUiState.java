package com.ringmap.nav;

import java.util.Collections;
import java.util.List;

/** 手机端各页面共同观察的不可变状态快照。 */
public final class NavUiState {

    public enum Readiness {
        NEEDS_PERMISSION,
        CONNECTING_LISTENER,
        SERVICE_STOPPED,
        SERVICE_ERROR,
        WAITING_BRIDGE,
        WAITING_WATCH_ACK,
        READY,
        NAVIGATING
    }

    public final boolean notificationAccess;
    public final boolean listenerConnected;
    public final String listenerState;
    public final boolean serviceRunning;
    public final String serviceState;
    public final String serviceError;
    public final int clientCount;
    public final boolean navigating;
    public final String sessionId;
    public final long sessionStartedAt;
    public final long seq;
    public final String action;
    public final int distanceMeters;
    public final String distanceText;
    public final String road;
    public final String instruction;
    public final String sourceName;
    public final String quality;
    public final long capturedAt;
    public final long parsedAt;
    public final long emittedAt;
    public final long bridgeReceivedAt;
    public final long bridgeSentAt;
    public final long watchReceivedAt;
    public final long watchAppliedAt;
    public final long lastNotificationAt;
    public final long lastParseAt;
    public final long lastAckAt;
    public final long ackRoundTripMs;
    public final String ackStatus;
    public final String latestEvent;
    public final long now;
    public final List<NavEvent> events;

    private NavUiState(Builder builder) {
        notificationAccess = builder.notificationAccess;
        listenerConnected = builder.listenerConnected;
        listenerState = value(builder.listenerState);
        serviceRunning = builder.serviceRunning;
        serviceState = value(builder.serviceState);
        serviceError = value(builder.serviceError);
        clientCount = builder.clientCount;
        navigating = builder.navigating;
        sessionId = value(builder.sessionId);
        sessionStartedAt = builder.sessionStartedAt;
        seq = builder.seq;
        action = value(builder.action);
        distanceMeters = builder.distanceMeters;
        distanceText = value(builder.distanceText);
        road = value(builder.road);
        instruction = value(builder.instruction);
        sourceName = value(builder.sourceName);
        quality = value(builder.quality);
        capturedAt = builder.capturedAt;
        parsedAt = builder.parsedAt;
        emittedAt = builder.emittedAt;
        bridgeReceivedAt = builder.bridgeReceivedAt;
        bridgeSentAt = builder.bridgeSentAt;
        watchReceivedAt = builder.watchReceivedAt;
        watchAppliedAt = builder.watchAppliedAt;
        lastNotificationAt = builder.lastNotificationAt;
        lastParseAt = builder.lastParseAt;
        lastAckAt = builder.lastAckAt;
        ackRoundTripMs = builder.ackRoundTripMs;
        ackStatus = value(builder.ackStatus);
        latestEvent = value(builder.latestEvent);
        now = builder.now > 0L ? builder.now : System.currentTimeMillis();
        events = builder.events == null ? Collections.emptyList() : builder.events;
    }

    public Readiness readiness() {
        if (!notificationAccess) return Readiness.NEEDS_PERMISSION;
        if (!serviceError.isEmpty()) return Readiness.SERVICE_ERROR;
        if (!serviceRunning) return Readiness.SERVICE_STOPPED;
        if (!listenerConnected) return Readiness.CONNECTING_LISTENER;
        if (clientCount <= 0) return Readiness.WAITING_BRIDGE;
        if (lastAckAt <= 0L || now - lastAckAt > 30_000L) return Readiness.WAITING_WATCH_ACK;
        if (navigating) return Readiness.NAVIGATING;
        return Readiness.READY;
    }

    public long androidParseMs() {
        return capturedAt > 0L && parsedAt >= capturedAt ? parsedAt - capturedAt : -1L;
    }

    public long bridgeReceiveMs() {
        return emittedAt > 0L && bridgeReceivedAt >= emittedAt ? bridgeReceivedAt - emittedAt : -1L;
    }

    public long bridgeDispatchMs() {
        return bridgeReceivedAt > 0L && bridgeSentAt >= bridgeReceivedAt
                ? bridgeSentAt - bridgeReceivedAt : -1L;
    }

    public long watchApplyMs() {
        return watchReceivedAt > 0L && watchAppliedAt >= watchReceivedAt
                ? watchAppliedAt - watchReceivedAt : -1L;
    }

    private static String value(String input) {
        return input == null ? "" : input;
    }

    public static final class Builder {
        private boolean notificationAccess;
        private boolean listenerConnected;
        private String listenerState = "未连接";
        private boolean serviceRunning;
        private String serviceState = "未运行";
        private String serviceError = "";
        private int clientCount;
        private boolean navigating;
        private String sessionId = "";
        private long sessionStartedAt;
        private long seq;
        private String action = "wait";
        private int distanceMeters;
        private String distanceText = "";
        private String road = "";
        private String instruction = "";
        private String sourceName = "";
        private String quality = "";
        private long capturedAt;
        private long parsedAt;
        private long emittedAt;
        private long bridgeReceivedAt;
        private long bridgeSentAt;
        private long watchReceivedAt;
        private long watchAppliedAt;
        private long lastNotificationAt;
        private long lastParseAt;
        private long lastAckAt;
        private long ackRoundTripMs = -1L;
        private String ackStatus = "";
        private String latestEvent = "";
        private long now;
        private List<NavEvent> events = Collections.emptyList();

        public Builder notificationAccess(boolean value) { notificationAccess = value; return this; }
        public Builder listenerConnected(boolean value) { listenerConnected = value; return this; }
        public Builder listenerState(String value) { listenerState = value; return this; }
        public Builder serviceRunning(boolean value) { serviceRunning = value; return this; }
        public Builder serviceState(String value) { serviceState = value; return this; }
        public Builder serviceError(String value) { serviceError = value; return this; }
        public Builder clientCount(int value) { clientCount = value; return this; }
        public Builder navigating(boolean value) { navigating = value; return this; }
        public Builder sessionId(String value) { sessionId = value; return this; }
        public Builder sessionStartedAt(long value) { sessionStartedAt = value; return this; }
        public Builder seq(long value) { seq = value; return this; }
        public Builder action(String value) { action = value; return this; }
        public Builder distanceMeters(int value) { distanceMeters = value; return this; }
        public Builder distanceText(String value) { distanceText = value; return this; }
        public Builder road(String value) { road = value; return this; }
        public Builder instruction(String value) { instruction = value; return this; }
        public Builder sourceName(String value) { sourceName = value; return this; }
        public Builder quality(String value) { quality = value; return this; }
        public Builder capturedAt(long value) { capturedAt = value; return this; }
        public Builder parsedAt(long value) { parsedAt = value; return this; }
        public Builder emittedAt(long value) { emittedAt = value; return this; }
        public Builder bridgeReceivedAt(long value) { bridgeReceivedAt = value; return this; }
        public Builder bridgeSentAt(long value) { bridgeSentAt = value; return this; }
        public Builder watchReceivedAt(long value) { watchReceivedAt = value; return this; }
        public Builder watchAppliedAt(long value) { watchAppliedAt = value; return this; }
        public Builder lastNotificationAt(long value) { lastNotificationAt = value; return this; }
        public Builder lastParseAt(long value) { lastParseAt = value; return this; }
        public Builder lastAckAt(long value) { lastAckAt = value; return this; }
        public Builder ackRoundTripMs(long value) { ackRoundTripMs = value; return this; }
        public Builder ackStatus(String value) { ackStatus = value; return this; }
        public Builder latestEvent(String value) { latestEvent = value; return this; }
        public Builder now(long value) { now = value; return this; }
        public Builder events(List<NavEvent> value) { events = value; return this; }
        public NavUiState build() { return new NavUiState(this); }
    }
}
