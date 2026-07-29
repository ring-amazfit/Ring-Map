package com.ringmap.nav;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.service.notification.NotificationListenerService;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONObject;

import java.net.InetSocketAddress;

/**
 * 导航服务 — 前台保活 + WebSocket 推送
 *
 * 新架构（通知监听模式）：
 *   地图 App 在系统导航 → NavNotificationListener 解析通知 → NavDataBus →
 *   本 Service 订阅总线 → WebSocket 推送到 ZeppOS 手表
 *
 * 本 Service 不再做路线规划/定位/导航，只负责：
 *   1. 持有 NavWebSocketServer 实例（供手表 app-side 连接）
 *   2. 注册为 NavDataBus.Listener，收到数据就 broadcast
 *   3. 前台通知保活（避免被系统杀掉导致 WebSocket 断开）
 */
public class NavigationService extends Service implements NavDataBus.Listener {

    private static final String TAG = "RingMapNav";
    private static final String CHANNEL_ID = "ringmap_nav";
    private static final int NOTIFICATION_ID = 1001;
    private static final int WS_PORT = 8886;
    private static final long REBIND_INTERVAL_MS = 30_000L;

    private static volatile NavigationService sInstance;
    private static volatile String sState = "未运行";
    private static volatile String sError = "";
    private NavWebSocketServer mWsServer;
    private boolean foregroundStarted;
    private final Handler healthHandler = new Handler(Looper.getMainLooper());
    private final Runnable listenerHealthCheck = new Runnable() {
        @Override public void run() {
            if (!LastNavCache.isListenerConnected()) {
                try {
                    NotificationListenerService.requestRebind(
                            new ComponentName(NavigationService.this, NavNotificationListener.class));
                    LastNavCache.setDebug("[后台自检] 正在请求系统重新绑定通知监听");
                    Log.i(TAG, "Background listener health check requested rebind");
                } catch (Exception e) {
                    Log.w(TAG, "Background notification listener rebind failed", e);
                }
            }
            healthHandler.postDelayed(this, REBIND_INTERVAL_MS);
        }
    };

    public static boolean isRunning() { return sInstance != null && "运行中".equals(sState); }
    public static int getClientCount() {
        NavigationService service = sInstance;
        return service == null || service.mWsServer == null ? 0 : service.mWsServer.getClientCount();
    }
    public static String getState() { return sState; }
    public static String getError() { return sError; }
    public static long getLastWatchAckTs() { return LastNavCache.getLastWatchAckTs(); }

    @Override
    public void onCreate() {
        super.onCreate();
        sInstance = this;
        sState = "启动中";
        sError = "";
        NavStateRepository.get().setServiceState(false, sState, sError);
        Log.d(TAG, "NavigationService onCreate");

        startForeground(NOTIFICATION_ID, createNotification("后台同步运行中 · 等待导航数据"));
        foregroundStarted = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null && !manager.isNotificationListenerAccessGranted(
                    new ComponentName(this, NavNotificationListener.class))) {
                LastNavCache.setDebug("[监听未授权] 请在系统设置授予通知使用权");
            }
        }
        try {
            // 前台身份建立后再启动 WebSocket，避免 Android 12+ 启动超时。
            mWsServer = new NavWebSocketServer(new InetSocketAddress("127.0.0.1", WS_PORT));
            mWsServer.start();
            Log.d(TAG, "WebSocket server started on port " + WS_PORT);
            sState = "运行中";
            NavStateRepository.get().setServiceState(true, sState, "");
            NavDataBus.setListener(this);
            healthHandler.removeCallbacks(listenerHealthCheck);
            healthHandler.post(listenerHealthCheck);
            try {
                NotificationListenerService.requestRebind(
                        new ComponentName(this, NavNotificationListener.class));
            } catch (Exception e) {
                Log.w(TAG, "Notification listener rebind request failed", e);
            }
        } catch (Exception e) {
            sState = "异常";
            sError = e.getMessage() == null ? "WebSocket 服务启动失败" : e.getMessage();
            NavStateRepository.get().setServiceState(false, sState, sError);
            Log.e(TAG, "NavigationService start failed", e);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (!foregroundStarted) {
            startForeground(NOTIFICATION_ID, createNotification("后台同步运行中 · 等待导航数据"));
            foregroundStarted = true;
        }
        return START_STICKY;
    }

    // === NavDataBus.Listener ===

    @Override
    public void onNavData(String json) {
        if (mWsServer != null) {
            mWsServer.broadcast(json);
            Log.d(TAG, "Navigation snapshot broadcast to " + mWsServer.getClientCount()
                    + " client(s), bytes=" + (json == null ? 0 : json.length()));
        } else {
            Log.w(TAG, "Navigation data received before WebSocket server was ready");
        }
    }

    @Override
    public void onNavEnd(String json) {
        if (mWsServer != null) {
            mWsServer.broadcast(json);
            Log.i(TAG, "Navigation end broadcast to " + mWsServer.getClientCount()
                    + " client(s), bytes=" + (json == null ? 0 : json.length()));
        }
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // 小米/HyperOS 从最近任务划掉页面后，主动重新拉起前台服务；
        // START_STICKY 作为系统级兜底，避免后台同步停止。
        try {
            ContextCompat.startForegroundService(this, new Intent(this, NavigationService.class));
        } catch (Exception e) {
            Log.w(TAG, "Restart service after task removal failed", e);
        }
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onTimeout(int startId, int fgsType) {
        Log.w(TAG, "Foreground service timeout, startId=" + startId + ", type=" + fgsType);
        NavStateRepository.get().record("服务", "系统触发前台服务超时");
        stopSelf(startId);
    }

    // === 前台通知 ===

    private Notification createNotification(String text) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "导航服务", NotificationManager.IMPORTANCE_LOW);
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.createNotificationChannel(channel);
        }
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("环间导航")
                .setContentText(text)
                .setSmallIcon(android.R.drawable.ic_menu_directions)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setShowWhen(false)
                .build();
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        Log.d(TAG, "NavigationService onDestroy");

        healthHandler.removeCallbacks(listenerHealthCheck);
        NavDataBus.setListener(null);
        sState = "未运行";
        sInstance = null;
        NavStateRepository.get().setServiceState(false, sState, "");
        NavStateRepository.get().setClientCount(0);

        if (mWsServer != null) {
            try {
                mWsServer.stop();
            } catch (Exception e) {
                Log.e(TAG, "WebSocket stop error", e);
            }
        }
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
