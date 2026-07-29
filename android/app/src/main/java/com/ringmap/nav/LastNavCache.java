package com.ringmap.nav;

import org.json.JSONObject;

/** 进程内同步状态仓，供服务补发和手机 UI 展示。 */
public final class LastNavCache {

    private static volatile JSONObject sLast;
    private static volatile String sDebug = "";
    private static volatile long sDebugTs;
    private static volatile long sLastNotificationTs;
    private static volatile long sLastParseSuccessTs;
    private static volatile boolean sListenerConnected;
    private static volatile String sListenerState = "未连接";
    private static volatile long sLastWatchAckTs;
    private static volatile String sLastAckSessionId = "";
    private static volatile long sLastAckSeq;
    private static volatile String sLastAckStatus = "";
    private static volatile long sWatchReceivedAt;
    private static volatile long sWatchAppliedAt;
    private static volatile long sAckRoundTripMs = -1L;

    private LastNavCache() {}

    public static synchronized void set(JSONObject data) {
        sLast = data;
        sLastParseSuccessTs = System.currentTimeMillis();
        NavStateRepository.get().onNavigationSnapshot(data);
    }

    public static JSONObject get() { return sLast; }

    /** 仅允许补发协议 TTL 内的快照，避免重连后显示旧转向。 */
    public static synchronized JSONObject getFresh() {
        JSONObject snapshot = sLast;
        return isFreshAt(snapshot, System.currentTimeMillis()) ? snapshot : null;
    }

    static boolean isFreshAt(JSONObject snapshot, long now) {
        if (snapshot == null) return false;
        return isFreshAt(snapshot.optLong("emittedAt", 0L),
                snapshot.optLong("ttlMs", 45_000L), now);
    }

    static boolean isFreshAt(long emittedAt, long ttlMs, long now) {
        long boundedTtl = Math.max(5_000L, Math.min(120_000L, ttlMs));
        return emittedAt > 0L && now - emittedAt <= boundedTtl;
    }

    public static synchronized void clear() {
        clear(null);
    }

    public static synchronized void clear(JSONObject end) {
        sLast = null;
        NavStateRepository.get().onNavigationEnded(end);
    }

    public static void setDebug(String msg) {
        sDebug = msg == null ? "" : msg;
        sDebugTs = System.currentTimeMillis();
    }

    public static void setNotificationDebug(String msg) {
        setDebug(msg);
        sLastNotificationTs = sDebugTs;
    }

    public static String getDebug() { return sDebug; }
    public static long getDebugTs() { return sDebugTs; }
    public static long getLastNotificationTs() { return sLastNotificationTs; }
    public static long getLastParseSuccessTs() { return sLastParseSuccessTs; }

    public static synchronized boolean setWatchAck(JSONObject ack) {
        if (ack == null || sLast == null) return false;
        long now = System.currentTimeMillis();
        if (!isFreshAt(sLast, now)) return false;
        String sessionId = ack.optString("sessionId", "");
        long seq = ack.optLong("seq", 0L);
        if (!sessionId.equals(sLast.optString("sessionId", ""))
                || seq != sLast.optLong("seq", -1L)) {
            return false;
        }
        String incomingStatus = ack.optString("status", "accepted");
        if (sessionId.equals(sLastAckSessionId) && seq == sLastAckSeq
                && !ackStatusAdvances(sLastAckStatus, incomingStatus)) {
            return false;
        }
        sLastWatchAckTs = now;
        sLastAckSessionId = sessionId;
        sLastAckSeq = seq;
        sLastAckStatus = incomingStatus;
        sWatchReceivedAt = ack.optLong("watchReceivedAt", 0L);
        sWatchAppliedAt = ack.optLong("widgetAppliedAt", 0L);
        long emittedAt = sLast.optLong("emittedAt", 0L);
        sAckRoundTripMs = emittedAt > 0L ? Math.max(0L, now - emittedAt) : -1L;
        NavStateRepository.get().onWatchAck(ack, now, sAckRoundTripMs);
        return true;
    }

    static boolean ackStatusAdvances(String previous, String incoming) {
        return ackRank(incoming) > ackRank(previous);
    }

    private static int ackRank(String status) {
        if ("applied".equals(status)) return 2;
        if ("accepted".equals(status)) return 1;
        return 0;
    }

    public static long getLastWatchAckTs() { return sLastWatchAckTs; }
    public static String getLastAckSessionId() { return sLastAckSessionId; }
    public static long getLastAckSeq() { return sLastAckSeq; }
    public static String getLastAckStatus() { return sLastAckStatus; }
    public static long getWatchReceivedAt() { return sWatchReceivedAt; }
    public static long getWatchAppliedAt() { return sWatchAppliedAt; }
    public static long getAckRoundTripMs() { return sAckRoundTripMs; }

    public static void setListenerConnected(boolean connected, String state) {
        sListenerConnected = connected;
        sListenerState = state == null ? (connected ? "已连接" : "已断开") : state;
        NavStateRepository.get().setListenerState(connected, sListenerState);
    }

    public static boolean isListenerConnected() { return sListenerConnected; }
    public static String getListenerState() { return sListenerState; }
}
