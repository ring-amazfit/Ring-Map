package com.ringmap.nav;

import android.app.NotificationManager;
import android.content.ComponentName;
import android.content.Context;
import android.os.Build;
import android.provider.Settings;

/** 统一判断系统是否真正授予当前通知监听组件访问权。 */
public final class NotificationAccess {

    private NotificationAccess() {}

    public static boolean isGranted(Context context) {
        if (context == null) return false;
        ComponentName component = new ComponentName(context, NavNotificationListener.class);
        boolean officialApiAvailable = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1;
        boolean officialGranted = false;
        if (officialApiAvailable) {
            NotificationManager manager =
                    (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            officialGranted = manager != null
                    && manager.isNotificationListenerAccessGranted(component);
        }
        String enabled = officialApiAvailable ? null : Settings.Secure.getString(
                context.getContentResolver(), "enabled_notification_listeners");
        return resolveGrantedState(officialApiAvailable, officialGranted, enabled,
                context.getPackageName(), NavNotificationListener.class.getName());
    }

    static boolean resolveGrantedState(boolean officialApiAvailable, boolean officialGranted,
                                       String enabledListeners, String packageName,
                                       String className) {
        if (officialApiAvailable) return officialGranted;
        return isEnabled(enabledListeners, packageName, className);
    }

    public static boolean isEnabled(String enabledListeners, String packageName, String className) {
        if (enabledListeners == null || enabledListeners.trim().isEmpty()) return false;
        String shortComponent = packageName + "/." + className.substring(packageName.length() + 1);
        String fullComponent = packageName + "/" + className;
        for (String entry : enabledListeners.split(":")) {
            if (entry == null) continue;
            String normalized = entry.trim();
            if (fullComponent.equals(normalized) || shortComponent.equals(normalized)) return true;
        }
        return false;
    }
}
