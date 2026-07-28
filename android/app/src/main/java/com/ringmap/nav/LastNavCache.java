package com.ringmap.nav;

import org.json.JSONObject;

/** 进程内同步状态仓，供主界面展示最近的监听、解析和导航状态。 */
public class LastNavCache {

    private static volatile JSONObject sLast;
    private static volatile String sDebug = "";
    private static volatile long sDebugTs = 0;
    private static volatile long sLastNotificationTs = 0;
    private static volatile long sLastParseSuccessTs = 0;
    private static volatile boolean sListenerConnected = false;
    private static volatile String sListenerState = "未连接";
    private static volatile long sLastWatchAckTs = 0;

    public static void set(JSONObject data) {
        sLast = data;
        sLastParseSuccessTs = System.currentTimeMillis();
    }

    public static JSONObject get() { return sLast; }

    public static void clear() { sLast = null; }

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

    public static void setWatchAck() { sLastWatchAckTs = System.currentTimeMillis(); }
    public static long getLastWatchAckTs() { return sLastWatchAckTs; }

    public static void setListenerConnected(boolean connected, String state) {
        sListenerConnected = connected;
        sListenerState = state == null ? (connected ? "已连接" : "已断开") : state;
    }

    public static boolean isListenerConnected() { return sListenerConnected; }
    public static String getListenerState() { return sListenerState; }
}
