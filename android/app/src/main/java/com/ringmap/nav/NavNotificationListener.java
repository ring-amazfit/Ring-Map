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

/** 读取高德/百度系统导航通知，并发布权威协议 v2 快照。 */
public class NavNotificationListener extends NotificationListenerService {

    private static final String TAG = "NavListener";
    private static final long END_VERIFY_DELAY_MS = 1200L;
    private static final long ARRIVAL_END_VERIFY_DELAY_MS = 3500L;
    private static final long[] REBIND_DELAYS_MS = {3000L, 10000L, 30000L};
    private static final NavSessionController SESSION = new NavSessionController();

    private static Handler createHandler() {
        try {
            Looper current = Looper.myLooper();
            if (current != null) return new Handler(current);
        } catch (RuntimeException ignored) {}
        return null;
    }

    private static final Handler REBIND_HANDLER = createHandler();
    private static final Handler END_HANDLER = createHandler();
    private static int rebindAttempt;

    private static final Runnable REBIND_TASK = new Runnable() {
        @Override public void run() {
            try {
                requestRebind(new ComponentName(NavNotificationListener.class.getPackage().getName(),
                        NavNotificationListener.class.getName()));
                Log.i(TAG, "Requested notification listener rebind, attempt=" + rebindAttempt);
            } catch (Exception e) {
                Log.w(TAG, "Notification listener rebind failed", e);
            }
            if (rebindAttempt < REBIND_DELAYS_MS.length - 1) {
                rebindAttempt++;
                if (REBIND_HANDLER != null) {
                    REBIND_HANDLER.postDelayed(this, REBIND_DELAYS_MS[rebindAttempt]);
                }
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
        LastNavCache.setListenerConnected(true, "已连接");
        LastNavCache.setDebug("[监听已连接] 正在扫描地图导航通知");
        if (REBIND_HANDLER != null) REBIND_HANDLER.removeCallbacks(REBIND_TASK);

        try {
            StatusBarNotification[] active = getActiveNotifications();
            if (active != null) {
                for (StatusBarNotification item : active) handleNotification(item);
            }
        } catch (SecurityException e) {
            Log.w(TAG, "Cannot scan active notifications", e);
            LastNavCache.setDebug("[监听已连接] 无法读取现有通知，请重新授权");
        }
    }

    @Override
    public void onDestroy() {
        LastNavCache.setListenerConnected(false, "已断开");
        super.onDestroy();
    }

    @Override
    public void onListenerDisconnected() {
        super.onListenerDisconnected();
        Log.i(TAG, "Notification listener disconnected");
        LastNavCache.setListenerConnected(false, "已断开");
        LastNavCache.setDebug("[监听已断开] 正在自动恢复");
        if (REBIND_HANDLER != null) {
            REBIND_HANDLER.removeCallbacks(REBIND_TASK);
            rebindAttempt = 0;
            REBIND_HANDLER.postDelayed(REBIND_TASK, REBIND_DELAYS_MS[0]);
        }
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        handleNotification(sbn);
    }

    @Override
    public void onNotificationRemoved(StatusBarNotification sbn) {
        if (sbn == null || !isSupportedNavigationPackage(sbn.getPackageName())) return;
        if (!SESSION.isActive() || !sbn.getPackageName().equals(SESSION.getActiveSource())) return;

        long delay = END_VERIFY_DELAY_MS;
        JSONObject current = LastNavCache.get();
        if (current != null && "arrive".equals(current.optString("action"))) {
            delay = ARRIVAL_END_VERIFY_DELAY_MS;
        }
        if (END_HANDLER != null) {
            END_HANDLER.removeCallbacksAndMessages(null);
            END_HANDLER.postDelayed(this::verifyNavigationEnded, delay);
        } else {
            verifyNavigationEnded();
        }
    }

    private void verifyNavigationEnded() {
        String activeSource = SESSION.getActiveSource();
        if (!SESSION.isActive() || activeSource.isEmpty()) return;
        try {
            StatusBarNotification[] active = getActiveNotifications();
            if (active != null) {
                for (StatusBarNotification item : active) {
                    if (item == null || !activeSource.equals(item.getPackageName())) continue;
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
        endNavigation(activeSource, "地图导航通知已全部移除");
    }

    private void handleNotification(StatusBarNotification sbn) {
        if (sbn == null) return;
        String sourcePackage = sbn.getPackageName();
        if (!isSupportedNavigationPackage(sourcePackage)) return;
        long capturedAt = System.currentTimeMillis();

        String rawText = notificationText(sbn.getNotification());
        if (TextUtils.isEmpty(rawText)) return;
        LastNavCache.setNotificationDebug("[" + NavProtocol.sourceName(sourcePackage) + "] " + rawText);
        NavStateRepository.get().onMapNotification(NavProtocol.sourceName(sourcePackage));

        if (isExplicitEnd(rawText)) {
            endNavigation(sourcePackage, rawText);
            return;
        }
        if (!NavParser.looksLikeNavigation(rawText)) {
            Log.d(TAG, "Notification is not navigation: " + rawText);
            return;
        }

        NavInstruction instruction = NavParser.parseInstruction(rawText);
        long parsedAt = System.currentTimeMillis();
        if (instruction == null) {
            LastNavCache.setDebug("[解析失败] 未提取到导航动作");
            return;
        }

        NavSessionController.Decision decision = SESSION.accept(
                sourcePackage, sbn.getKey(), instruction,
                capturedAt, parsedAt, System.currentTimeMillis());
        if (!decision.accepted) {
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

    private void endNavigation(String sourcePackage, String reason) {
        NavSessionController.EndDecision decision = SESSION.end(sourcePackage,
                System.currentTimeMillis());
        if (!decision.accepted) {
            Log.d(TAG, "Navigation end ignored: " + decision.reason + ", source=" + sourcePackage);
            return;
        }
        JSONObject end = NavProtocol.end(decision);
        // 清理必须独立于 NavigationService 是否存活，防止重连时复活旧快照。
        LastNavCache.clear(end);
        LastNavCache.setDebug("[导航结束] " + reason);
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
        return raw.toString().replaceAll("\\s+", " ").trim();
    }

    private void append(StringBuilder builder, String value) {
        if (!TextUtils.isEmpty(value)) builder.append(value).append(' ');
    }

    private String charSequence(Bundle extras, String key) {
        CharSequence value = extras.getCharSequence(key);
        return value == null ? null : value.toString();
    }
}
