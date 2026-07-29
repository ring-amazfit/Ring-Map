package com.ringmap.nav;

import android.util.Log;

import org.json.JSONObject;

/** 进程内事件总线：监听器发布权威协议快照，前台服务负责广播。 */
public final class NavDataBus {

    private static final String TAG = "RingDataBus";
    private static volatile Listener sListener;

    private NavDataBus() {}

    public interface Listener {
        void onNavData(String json);
        void onNavEnd(String json);
    }

    public static void setListener(Listener listener) {
        sListener = listener;
    }

    public static void publish(JSONObject navData) {
        if (navData == null) return;
        Listener listener = sListener;
        if (listener == null) {
            Log.d(TAG, "No service listener; snapshot remains available in LastNavCache");
            return;
        }
        listener.onNavData(navData.toString());
    }

    public static void clear(JSONObject endData) {
        if (endData == null) return;
        Listener listener = sListener;
        if (listener != null) listener.onNavEnd(endData.toString());
    }
}
