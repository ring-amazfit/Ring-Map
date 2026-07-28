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

/** 读取地图导航常驻通知并同步到手表。 */
public class NavNotificationListener extends NotificationListenerService {

// Core maps are supported through notification text; keep this list exact to avoid intercepting unrelated apps.
    private static final String TAG = "NavListener";
    private static Handler createRebindHandler() {
        try {
            Looper current = Looper.myLooper();
            if (current != null) return new Handler(current);
        } catch (RuntimeException ignored) {}
        return null;
    }

    private static final Handler REBIND_HANDLER = createRebindHandler();
    private static final Handler END_HANDLER = createRebindHandler();
    private static final long END_VERIFY_DELAY_MS = 1200L;
    private static final long[] REBIND_DELAYS_MS = {3000L, 10000L, 30000L};
    private static int rebindAttempt;
    private static String lastNavigationKey;
    private static String lastNavigationPackage;
    private static final Runnable REBIND_TASK = new Runnable() {
        @Override public void run() {
            try {
                requestRebind(new ComponentName(NavNotificationListener.class.getPackage().getName(), NavNotificationListener.class.getName()));
                Log.i(TAG, "Requested notification listener rebind, attempt=" + rebindAttempt);
            } catch (Exception e) {
                Log.w(TAG, "Notification listener rebind failed", e);
            }
            if (rebindAttempt < REBIND_DELAYS_MS.length - 1) {
                rebindAttempt++;
                if (REBIND_HANDLER != null) REBIND_HANDLER.postDelayed(this, REBIND_DELAYS_MS[rebindAttempt]);
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
        LastNavCache.setDebug("[监听已连接] 正在扫描地图导航通知");

        // 地图导航通常是常驻通知。仅等 onNotificationPosted 会错过它，
        // 所以授权/服务重连后主动读取当前仍在通知栏中的通知。
        try {
            StatusBarNotification[] active = getActiveNotifications();
            if (active != null) {
                for (StatusBarNotification sbn : active) handleNotification(sbn);
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
        // 高德会用多条通知表示同一导航，并在步骤更新时替换其中一条。
        // 延迟扫描仍存活的地图导航通知，避免把普通通知替换误判为导航结束。
        if (END_HANDLER != null) {
            END_HANDLER.removeCallbacksAndMessages(null);
            END_HANDLER.postDelayed(this::verifyNavigationEnded, END_VERIFY_DELAY_MS);
        } else {
            verifyNavigationEnded();
        }
    }

    private void verifyNavigationEnded() {
        try {
            StatusBarNotification[] active = getActiveNotifications();
            if (active != null) {
                for (StatusBarNotification item : active) {
                    if (item == null || !isSupportedNavigationPackage(item.getPackageName())) continue;
                    String text = notificationText(item.getNotification());
                    if (!isExplicitEnd(text) && NavParser.looksLikeNavigation(text)) {
                        Log.d(TAG, "Navigation notification replacement detected; keep navigation active");
                        return;
                    }
                }
            }
        } catch (SecurityException e) {
            Log.w(TAG, "Cannot verify navigation notification removal", e);
            return;
        }
        Log.i(TAG, "No active navigation notification remains; ending navigation");
        lastNavigationKey = null;
        lastNavigationPackage = null;
        LastNavCache.setDebug("[导航结束] 地图导航通知已全部移除");
        NavDataBus.clear();
    }

    private void handleNotification(StatusBarNotification sbn) {
        if (sbn == null) return;
        String pkg = sbn.getPackageName();
        if (!isSupportedNavigationPackage(pkg)) return;

        Notification notification = sbn.getNotification();
        String rawText = notificationText(notification);
        if (TextUtils.isEmpty(rawText)) return;

        Log.d(TAG, "Navigation notification from " + pkg + ": " + rawText);
        LastNavCache.setNotificationDebug("[" + pkg + "] " + rawText);

        if (isExplicitEnd(rawText)) {
            lastNavigationKey = null;
            lastNavigationPackage = null;
            LastNavCache.setDebug("[导航结束] " + rawText);
            NavDataBus.clear();
            return;
        }

        if (!NavParser.looksLikeNavigation(rawText)) {
            Log.d(TAG, "Notification is not navigation: " + rawText);
            return;
        }
        JSONObject nav = NavParser.parse(rawText, pkg);
        if (nav == null) {
            LastNavCache.setDebug("[解析失败] " + rawText);
            return;
        }
        lastNavigationKey = sbn.getKey();
        lastNavigationPackage = pkg;
        LastNavCache.set(nav);
        Log.i(TAG, "Navigation parsed: action=" + nav.optString("action")
                + ", distance=" + nav.optString("distanceText")
                + ", source=" + pkg);
        NavDataBus.publish(nav);
    }

    private boolean isExplicitEnd(String text) {
        return text != null && (text.contains("导航结束") || text.contains("导航已结束")
                || text.contains("到达目的地") || text.contains("退出导航"));
    }

    private String notificationText(Notification notification) {
        if (notification == null || notification.extras == null) return "";
        Bundle extras = notification.extras;
        StringBuilder raw = new StringBuilder();
        append(raw, cs(extras, NotificationCompat.EXTRA_TITLE));
        append(raw, cs(extras, NotificationCompat.EXTRA_TEXT));
        append(raw, cs(extras, NotificationCompat.EXTRA_BIG_TEXT));
        append(raw, cs(extras, NotificationCompat.EXTRA_SUB_TEXT));
        append(raw, cs(extras, NotificationCompat.EXTRA_SUMMARY_TEXT));
        CharSequence info = extras.getCharSequence(NotificationCompat.EXTRA_INFO_TEXT);
        if (!TextUtils.isEmpty(info)) append(raw, info.toString());
        return raw.toString().replaceAll("\\s+", " ").trim();
    }

    private void append(StringBuilder builder, String value) {
        if (!TextUtils.isEmpty(value)) builder.append(value).append(' ');
    }

    private String cs(Bundle extras, String key) {
        CharSequence c = extras.getCharSequence(key);
        return c != null ? c.toString() : null;
    }
}
