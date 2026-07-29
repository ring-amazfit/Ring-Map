package com.ringmap.nav;

import androidx.lifecycle.LiveData;
import androidx.lifecycle.MutableLiveData;

import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/** 后台链路到手机 UI 的唯一事件驱动状态仓。 */
public final class NavStateRepository {

    private static final NavStateRepository INSTANCE = new NavStateRepository();

    public static NavStateRepository get() {
        return INSTANCE;
    }

    private final MutableLiveData<NavUiState> state = new MutableLiveData<>();
    private final NavEventLog eventLog = new NavEventLog(100);
    private boolean notificationAccess;
    private boolean listenerConnected;
    private String listenerState = "未连接";
    private boolean serviceRunning;
    private String serviceState = "未运行";
    private String serviceError = "";
    private int clientCount;
    private JSONObject navigation;
    private long lastNotificationAt;
    private long lastParseAt;
    private long lastAckAt;
    private String ackStatus = "";
    private long bridgeReceivedAt;
    private long bridgeSentAt;
    private long watchReceivedAt;
    private long watchAppliedAt;
    private long ackRoundTripMs = -1L;
    private long now = System.currentTimeMillis();

    private NavStateRepository() {
        publishLocked();
    }

    public LiveData<NavUiState> state() {
        return state;
    }

    public synchronized NavUiState current() {
        NavUiState current = state.getValue();
        return current == null ? buildLocked() : current;
    }

    public synchronized void setNotificationAccess(boolean granted) {
        if (notificationAccess != granted) {
            notificationAccess = granted;
            addEventLocked("权限", granted ? "通知使用权已授予" : "通知使用权未授予");
        }
        publishLocked();
    }

    public synchronized void setListenerState(boolean connected, String value) {
        boolean changed = listenerConnected != connected || !safe(value).equals(listenerState);
        listenerConnected = connected;
        listenerState = safe(value).isEmpty() ? (connected ? "已连接" : "已断开") : value;
        if (changed) addEventLocked("监听", connected ? "系统通知监听已连接" : "系统通知监听已断开");
        publishLocked();
    }

    public synchronized void setServiceState(boolean running, String value, String error) {
        boolean changed = serviceRunning != running || !safe(value).equals(serviceState)
                || !safe(error).equals(serviceError);
        serviceRunning = running;
        serviceState = safe(value);
        serviceError = safe(error);
        if (changed) {
            addEventLocked("服务", !serviceError.isEmpty() ? "同步服务异常" :
                    (running ? "同步服务正在运行" : "同步服务已停止"));
        }
        publishLocked();
    }

    public synchronized void setClientCount(int count) {
        int normalized = Math.max(0, count);
        if (clientCount != normalized) {
            clientCount = normalized;
            addEventLocked("桥接", normalized > 0
                    ? "Zepp App-Side 已连接，客户端 " + normalized
                    : "Zepp App-Side 已断开");
        }
        publishLocked();
    }

    public synchronized void onMapNotification(String sourceName) {
        lastNotificationAt = System.currentTimeMillis();
        addEventLocked("通知", safe(sourceName) + " 导航通知已到达");
        publishLocked();
    }

    public synchronized void onNavigationSnapshot(JSONObject snapshot) {
        long previousSeq = navigation == null ? -1L : navigation.optLong("seq", -1L);
        String previousSession = navigation == null ? "" : navigation.optString("sessionId", "");
        navigation = snapshot;
        lastParseAt = System.currentTimeMillis();
        if (snapshot != null) {
            if (previousSeq != snapshot.optLong("seq", -1L)
                    || !previousSession.equals(snapshot.optString("sessionId", ""))) {
                ackStatus = "";
                bridgeReceivedAt = 0L;
                bridgeSentAt = 0L;
                watchReceivedAt = 0L;
                watchAppliedAt = 0L;
                ackRoundTripMs = -1L;
            }
            addEventLocked("解析", "动作 " + snapshot.optString("action", "wait")
                    + " · 序号 " + snapshot.optLong("seq", 0L));
        }
        publishLocked();
    }

    public synchronized void onNavigationEnded(JSONObject end) {
        navigation = null;
        String suffix = end == null ? "" : " · 序号 " + end.optLong("seq", 0L);
        addEventLocked("导航", "会话已结束" + suffix);
        publishLocked();
    }

    public synchronized void onWatchAck(JSONObject ack, long receivedAt, long roundTripMs) {
        lastAckAt = receivedAt;
        ackStatus = ack == null ? "" : ack.optString("status", "accepted");
        bridgeReceivedAt = ack == null ? 0L : ack.optLong("bridgeReceivedAt", 0L);
        bridgeSentAt = ack == null ? 0L : ack.optLong("bridgeSentAt", 0L);
        watchReceivedAt = ack == null ? 0L : ack.optLong("watchReceivedAt", 0L);
        watchAppliedAt = ack == null ? 0L : ack.optLong("widgetAppliedAt", 0L);
        ackRoundTripMs = roundTripMs;
        addEventLocked("手表", "ACK " + ackStatus + " · 序号 "
                + (ack == null ? 0L : ack.optLong("seq", 0L)));
        publishLocked();
    }

    public synchronized void record(String category, String message) {
        addEventLocked(category, message);
        publishLocked();
    }

    public synchronized void tick(long timestamp) {
        now = timestamp;
        publishLocked();
    }

    public synchronized void clearEvents() {
        eventLog.clear();
        addEventLocked("诊断", "事件记录已清除");
        publishLocked();
    }

    public synchronized String diagnosticsText() {
        NavUiState snapshot = buildLocked();
        StringBuilder output = new StringBuilder();
        output.append("RingMap Android 3.0.1\n")
                .append("通知权限: ").append(snapshot.notificationAccess).append('\n')
                .append("监听连接: ").append(snapshot.listenerConnected).append('\n')
                .append("服务状态: ").append(snapshot.serviceState).append('\n')
                .append("桥接客户端: ").append(snapshot.clientCount).append('\n')
                .append("导航会话: ").append(snapshot.navigating ? "active" : "idle").append('\n')
                .append("当前序号: ").append(snapshot.seq).append('\n')
                .append("ACK: ").append(snapshot.ackStatus).append('\n')
                .append("往返耗时: ").append(snapshot.ackRoundTripMs).append("ms\n\n")
                .append("最近事件:\n");
        SimpleDateFormat format = new SimpleDateFormat("HH:mm:ss", Locale.ROOT);
        for (NavEvent event : snapshot.events) {
            output.append(format.format(new Date(event.timestamp))).append(" · ")
                    .append(event.category).append(" · ").append(event.message).append('\n');
        }
        return output.toString();
    }

    private void addEventLocked(String category, String message) {
        eventLog.add(System.currentTimeMillis(), category, message);
    }

    private void publishLocked() {
        now = Math.max(now, System.currentTimeMillis());
        state.postValue(buildLocked());
    }

    private NavUiState buildLocked() {
        JSONObject nav = navigation;
        if (nav != null && !LastNavCache.isFreshAt(nav, now)) nav = null;
        List<NavEvent> events = eventLog.snapshot();
        String latest = events.isEmpty() ? "" : events.get(0).category + " · " + events.get(0).message;
        NavUiState.Builder builder = new NavUiState.Builder()
                .notificationAccess(notificationAccess)
                .listenerConnected(listenerConnected)
                .listenerState(listenerState)
                .serviceRunning(serviceRunning)
                .serviceState(serviceState)
                .serviceError(serviceError)
                .clientCount(clientCount)
                .lastNotificationAt(lastNotificationAt)
                .lastParseAt(lastParseAt)
                .lastAckAt(lastAckAt)
                .ackStatus(ackStatus)
                .bridgeReceivedAt(bridgeReceivedAt)
                .bridgeSentAt(bridgeSentAt)
                .watchReceivedAt(watchReceivedAt)
                .watchAppliedAt(watchAppliedAt)
                .ackRoundTripMs(ackRoundTripMs)
                .latestEvent(latest)
                .events(events)
                .now(now);
        if (nav != null) {
            builder.navigating(true)
                    .sessionId(nav.optString("sessionId", ""))
                    .sessionStartedAt(nav.optLong("sessionStartedAt", 0L))
                    .seq(nav.optLong("seq", 0L))
                    .action(nav.optString("action", "wait"))
                    .distanceMeters(nav.optInt("distanceMeters", nav.optInt("distance", 0)))
                    .distanceText(nav.optString("distanceText", ""))
                    .road(nav.optString("road", ""))
                    .instruction(nav.optString("instruction", ""))
                    .sourceName(nav.optString("sourceName", ""))
                    .quality(nav.optString("quality", ""))
                    .capturedAt(nav.optLong("capturedAt", 0L))
                    .parsedAt(nav.optLong("parsedAt", 0L))
                    .emittedAt(nav.optLong("emittedAt", 0L));
        }
        return builder.build();
    }

    private static String safe(String value) {
        return value == null ? "" : value;
    }
}
