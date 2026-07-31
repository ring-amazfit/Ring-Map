package com.ringmap.nav;

import android.content.ComponentName;
import android.content.Context;
import android.service.notification.NotificationListenerService;
import android.util.Log;

/** OEM 断开通知监听后的统一、限频恢复入口。 */
public final class NotificationListenerRecovery {

    private static final String TAG = "NavRecovery";
    private static final long REBIND_COOLDOWN_MS = 3_000L;

    private static long lastRebindAt;

    private NotificationListenerRecovery() {}

    public static void request(Context context) {
        request(context, false);
    }

    /** force 仅跳过限频；绝不切换组件状态，避免 ColorOS/HyperOS 撤销授权。 */
    public static synchronized void request(Context context, boolean force) {
        if (context == null) return;
        Context app = context.getApplicationContext();
        if (app == null) app = context;
        if (!NotificationAccess.isGranted(app)) return;

        long now = System.currentTimeMillis();
        if (!force && now - lastRebindAt < REBIND_COOLDOWN_MS) return;
        lastRebindAt = now;
        ComponentName component = new ComponentName(app, NavNotificationListener.class);
        try {
            NotificationListenerService.requestRebind(component);
            Log.i(TAG, "Notification listener rebind requested");
        } catch (RuntimeException error) {
            Log.w(TAG, "Notification listener rebind request failed", error);
        }
    }
}
