package com.ringmap.nav;

/** 兼容 Android 设置中短类名与完整类名两种通知监听组件格式。 */
public final class NotificationAccess {

    private NotificationAccess() {}

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
