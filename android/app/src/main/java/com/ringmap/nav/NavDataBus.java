package com.ringmap.nav;

import android.util.Log;

import org.json.JSONObject;

/**
 * 导航数据总线 — 解耦 NotificationListener 与 WebSocket Server
 *
 * NotificationListener 解析地图导航通知 → 调用 NavDataBus.publish(navData)
 * NavWebSocketServer 订阅总线，收到数据后 broadcast 到所有手表连接
 *
 * 这样监听器和服务可以独立启停，互不依赖。
 */
public class NavDataBus {

    private static final String TAG = "RingDataBus";
    private static volatile Listener sListener;

    public interface Listener {
        /** 数据更新时调用，data 是已序列化的 JSON 字符串 */
        void onNavData(String json);
        /** 导航明确结束时调用，通知中继器清空旧导航 */
        void onNavEnd();
    }

    public static void setListener(Listener listener) {
        sListener = listener;
    }

    /**
     * 发布导航数据
     * @param navData 已构造好的导航数据 JSON
     */
    public static void publish(JSONObject navData) {
        if (navData == null) return;
        Listener l = sListener;
        if (l == null) {
            Log.d(TAG, "No listener, drop: " + navData);
            return;
        }
        l.onNavData(navData.toString());
    }

    public static void clear() {
        Listener l = sListener;
        if (l != null) l.onNavEnd();
    }
}
