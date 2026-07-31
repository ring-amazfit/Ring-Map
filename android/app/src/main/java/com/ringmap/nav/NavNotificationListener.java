package com.ringmap.nav;

import android.app.Notification;
import android.content.ComponentName;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.text.TextUtils;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import org.json.JSONObject;

import java.util.Arrays;
import java.util.Comparator;

/** 读取高德/百度系统导航通知，并发布权威协议 v2 快照。 */
public class NavNotificationListener extends NotificationListenerService {

    private static final String TAG = "NavListener";
    private static final long END_VERIFY_DELAY_MS = 1200L;
    private static final long ARRIVAL_END_VERIFY_DELAY_MS = 3500L;
    static final long ACTIVE_SCAN_INTERVAL_MS = 15_000L;
    private static final long[] REBIND_DELAYS_MS = {3000L, 10000L, 30000L, 60000L};
    private static final NavSessionController SESSION = new NavSessionController();
    private static volatile Handler rebindHandler;
    private static volatile Handler endHandler;
    private static int rebindAttempt;

    private final Handler activeScanHandler = new Handler(Looper.getMainLooper());
    private long instanceId;

    private static Handler rebindHandler() {
        Handler handler = rebindHandler;
        if (handler == null) {
            synchronized (NavNotificationListener.class) {
                handler = rebindHandler;
                if (handler == null) {
                    handler = new Handler(Looper.getMainLooper());
                    rebindHandler = handler;
                }
            }
        }
        return handler;
    }

    private static Handler endHandler() {
        Handler handler = endHandler;
        if (handler == null) {
            synchronized (NavNotificationListener.class) {
                handler = endHandler;
                if (handler == null) {
                    handler = new Handler(Looper.getMainLooper());
                    endHandler = handler;
                }
            }
        }
        return handler;
    }

    private static final Runnable REBIND_TASK = new Runnable() {
        @Override public void run() {
            if (LastNavCache.isListenerConnected()) return;
            try {
                requestRebind(new ComponentName(NavNotificationListener.class.getPackage().getName(),
                        NavNotificationListener.class.getName()));
                Log.i(TAG, "Requested notification listener rebind, attempt=" + rebindAttempt);
            } catch (Exception e) {
                Log.w(TAG, "Notification listener rebind failed", e);
            }
            int index = Math.min(rebindAttempt, REBIND_DELAYS_MS.length - 1);
            rebindAttempt = Math.min(rebindAttempt + 1, REBIND_DELAYS_MS.length - 1);
            rebindHandler().postDelayed(this, REBIND_DELAYS_MS[index]);
        }
    };

    private static void scheduleRebind() {
        rebindHandler().removeCallbacks(REBIND_TASK);
        rebindAttempt = 0;
        rebindHandler().postDelayed(REBIND_TASK, REBIND_DELAYS_MS[0]);
    }

    private final Runnable ACTIVE_SCAN_TASK = new Runnable() {
        @Override public void run() {
            if (instanceId <= 0L || !LastNavCache.isListenerConnected()) return;
            scanActiveNotifications(false);
            if (instanceId > 0L && LastNavCache.isListenerConnected()) {
                activeScanHandler.postDelayed(this, ACTIVE_SCAN_INTERVAL_MS);
            }
        }
    };

    private static final String[] SUPPORTED_NAV_PACKAGES = {
            "com.autonavi.minimap",
            "com.baidu.BaiduMap"
    };

    public static boolean isSupportedNavigationPackage(String packageName) {
        if (packageName == null) return false;
        for (String supported : SUPPORTED_NAV_PACKAGES) {
            if (supported.equals(packageName)) return true;
        }
        return false;
    }

    @Override
    public void onListenerConnected() {
        super.onListenerConnected();
        Log.i(TAG, "Notification listener connected");
        instanceId = LastNavCache.listenerConnected("已连接");
        LastNavCache.setDebug("[监听已连接] 正在扫描地图导航通知");
        rebindHandler().removeCallbacks(REBIND_TASK);
        rebindAttempt = 0;
        NavBridgeRuntime.ensureStarted(getApplicationContext());
        scanActiveNotifications(true);
        activeScanHandler.removeCallbacks(ACTIVE_SCAN_TASK);
        if (instanceId > 0L && LastNavCache.isListenerConnected()) {
            activeScanHandler.postDelayed(ACTIVE_SCAN_TASK, ACTIVE_SCAN_INTERVAL_MS);
        }
    }

    @Override
    public void onDestroy() {
        activeScanHandler.removeCallbacks(ACTIVE_SCAN_TASK);
        boolean current = LastNavCache.listenerDisconnected(instanceId, "已断开");
        instanceId = 0L;
        if (current || !LastNavCache.isListenerConnected()) {
            LastNavCache.setDebug("[监听已销毁] 正在自动恢复");
            scheduleRebind();
        }
        super.onDestroy();
    }

    @Override
    public void onListenerDisconnected() {
        super.onListenerDisconnected();
        Log.i(TAG, "Notification listener disconnected");
        activeScanHandler.removeCallbacks(ACTIVE_SCAN_TASK);
        boolean current = LastNavCache.listenerDisconnected(instanceId, "已断开");
        instanceId = 0L;
        if (current || !LastNavCache.isListenerConnected()) {
            LastNavCache.setDebug("[监听已断开] 正在自动恢复");
            scheduleRebind();
        }
    }

    private void scanActiveNotifications(boolean reportFailure) {
        try {
            StatusBarNotification[] active = getActiveNotifications();
            if (active == null) return;
            Arrays.sort(active, Comparator.comparingLong(item ->
                    item == null ? Long.MIN_VALUE : item.getPostTime()));
            for (StatusBarNotification item : active) handleNotification(item);
        } catch (SecurityException | IllegalStateException error) {
            Log.w(TAG, "Cannot scan active notifications", error);
            if (reportFailure) {
                LastNavCache.setDebug("[监听异常] 系统拒绝读取通知，正在自动重绑");
            }
            activeScanHandler.removeCallbacks(ACTIVE_SCAN_TASK);
            if (LastNavCache.listenerDisconnected(instanceId, "系统拒绝读取")) {
                instanceId = 0L;
                scheduleRebind();
            }
        }
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        handleNotification(sbn);
    }

    @Override
    public void onNotificationRemoved(StatusBarNotification sbn) {
        if (sbn == null || !isSupportedNavigationPackage(sbn.getPackageName())) return;
        String activeSource = SESSION.getActiveSource();
        if (!SESSION.isActive() || !sbn.getPackageName().equals(activeSource)) return;

        String expectedSessionId = SESSION.getSessionId();
        long expectedSeq = SESSION.getSeq();
        long delay = END_VERIFY_DELAY_MS;
        JSONObject current = LastNavCache.get();
        if (current != null && "arrive".equals(current.optString("action"))) {
            delay = ARRIVAL_END_VERIFY_DELAY_MS;
        }
        endHandler().removeCallbacksAndMessages(null);
        endHandler().postDelayed(
                () -> verifyNavigationEnded(activeSource, expectedSessionId, expectedSeq), delay);
    }

    private void verifyNavigationEnded(String expectedSource, String expectedSessionId,
                                       long expectedSeq) {
        if (!SESSION.isActive()
                || !expectedSource.equals(SESSION.getActiveSource())
                || !expectedSessionId.equals(SESSION.getSessionId())
                || expectedSeq != SESSION.getSeq()) {
            Log.d(TAG, "Navigation advanced after notification removal; ignore old end check");
            return;
        }
        try {
            StatusBarNotification[] active = getActiveNotifications();
            if (active != null) {
                for (StatusBarNotification item : active) {
                    if (item == null || !expectedSource.equals(item.getPackageName())) continue;
                    String text = notificationText(item.getNotification());
                    if (!isExplicitEnd(text) && NavParser.looksLikeNavigation(text)) {
                        Log.d(TAG, "Navigation notification replacement detected; keep session active");
                        return;
                    }
                }
            }
        } catch (SecurityException e) {
            Log.w(TAG, "Cannot verify navigation notification removal", e);
            return;
        }
        if (expectedSessionId.equals(SESSION.getSessionId())
                && expectedSeq == SESSION.getSeq()) {
            endNavigation(expectedSource, "地图导航通知已全部移除",
                    System.currentTimeMillis());
        }
    }

    private void handleNotification(StatusBarNotification sbn) {
        if (sbn == null) return;
        NavBridgeRuntime.ensureStarted(getApplicationContext());
        String sourcePackage = sbn.getPackageName();
        if (!isSupportedNavigationPackage(sourcePackage)) return;
        long capturedAt = System.currentTimeMillis();
        long notificationAt = sbn.getPostTime() > 0L ? sbn.getPostTime() : capturedAt;

        String rawText = notificationText(sbn.getNotification());
        if (TextUtils.isEmpty(rawText)) return;
        String sourceName = NavProtocol.sourceName(sourcePackage);
        // 通知正文仅用于本次解析与已连接手表的当前步骤显示；诊断缓存不保留正文或路名。
        LastNavCache.setNotificationDebug("[通知到达] " + sourceName);
        NavStateRepository.get().onMapNotification(sourceName);

        if (isExplicitEnd(rawText)) {
            endNavigation(sourcePackage, "地图导航已结束", notificationAt);
            return;
        }
        if (!NavParser.looksLikeNavigation(rawText)) {
            Log.d(TAG, "Notification is not navigation: source=" + sourcePackage);
            return;
        }

        NavInstruction instruction = NavParser.parseInstruction(rawText);
        long parsedAt = System.currentTimeMillis();
        if (instruction == null) {
            LastNavCache.setDebug("[解析失败] 未提取到导航动作");
            return;
        }

        NavSessionController.Decision decision = SESSION.accept(
                sourcePackage, sbn.getKey(), instruction, notificationAt,
                capturedAt, parsedAt, System.currentTimeMillis());
        if (!decision.accepted) {
            LastNavCache.setDebug("[导航忽略] " + decision.reason + " · " + instruction.action);
            NavStateRepository.get().record("解析", "候选已忽略 · " + decision.reason);
            Log.d(TAG, "Navigation candidate ignored: " + decision.reason);
            return;
        }

        JSONObject snapshot = NavProtocol.snapshot(decision);
        LastNavCache.set(snapshot);
        LastNavCache.setDebug("[导航更新] " + NavProtocol.sourceName(sourcePackage)
                + " · " + instruction.action + " · #" + decision.seq);
        Log.i(TAG, "Navigation parsed: session=" + decision.sessionId
                + ", seq=" + decision.seq + ", action=" + instruction.action
                + ", distance=" + instruction.distanceText + ", source=" + sourcePackage);
        NavDataBus.publish(snapshot);
    }

    private void endNavigation(String sourcePackage, String reason, long notificationAt) {
        NavSessionController.EndDecision decision = SESSION.end(sourcePackage,
                notificationAt, System.currentTimeMillis());
        if (!decision.accepted) {
            Log.d(TAG, "Navigation end ignored: " + decision.reason + ", source=" + sourcePackage);
            return;
        }
        JSONObject end = NavProtocol.end(decision);
        // 清理必须独立于 NavigationService 是否存活，防止重连时复活旧快照。
        LastNavCache.clear(end);
        LastNavCache.setDebug("[导航结束] " + NavProtocol.sourceName(sourcePackage));
        NavDataBus.clear(end);
        Log.i(TAG, "Navigation ended: session=" + decision.sessionId + ", seq=" + decision.seq);
    }

    private boolean isExplicitEnd(String text) {
        return text != null && (text.contains("导航结束") || text.contains("导航已结束")
                || text.contains("退出导航") || text.contains("停止导航"));
    }

    private String notificationText(Notification notification) {
        if (notification == null || notification.extras == null) return "";
        Bundle extras = notification.extras;
        StringBuilder raw = new StringBuilder();
        append(raw, charSequence(extras, NotificationCompat.EXTRA_TITLE));
        append(raw, charSequence(extras, NotificationCompat.EXTRA_TEXT));
        append(raw, charSequence(extras, NotificationCompat.EXTRA_BIG_TEXT));
        append(raw, charSequence(extras, NotificationCompat.EXTRA_SUB_TEXT));
        append(raw, charSequence(extras, NotificationCompat.EXTRA_SUMMARY_TEXT));
        CharSequence info = extras.getCharSequence(NotificationCompat.EXTRA_INFO_TEXT);
        if (!TextUtils.isEmpty(info)) append(raw, info.toString());
        CharSequence[] lines = extras.getCharSequenceArray(NotificationCompat.EXTRA_TEXT_LINES);
        if (lines != null) {
            for (CharSequence line : lines) {
                if (!TextUtils.isEmpty(line)) append(raw, line.toString());
            }
        }
        return joinNotificationText(raw.toString());
    }

    static String joinNotificationText(String... values) {
        StringBuilder output = new StringBuilder();
        if (values != null) {
            for (String value : values) {
                if (value != null && !value.trim().isEmpty()) output.append(value).append(' ');
            }
        }
        return output.toString().replaceAll("\\s+", " ").trim();
    }

    private void append(StringBuilder builder, String value) {
        if (!TextUtils.isEmpty(value)) builder.append(value).append(' ');
    }

    private String charSequence(Bundle extras, String key) {
        CharSequence value = extras.getCharSequence(key);
        return value == null ? null : value.toString();
    }
}
