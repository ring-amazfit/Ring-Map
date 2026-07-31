package com.ringmap.nav;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

/**
 * 前台保活与监听健康检查。
 *
 * 本机 WebSocket 由 {@link NavBridgeRuntime} 持有，而不是由本 Service 独占：
 * 前台服务使用声明明确用途的 specialUse 类型持续维护本机桥；即使服务被 OEM
 * 回收，系统通知监听回调仍可重新建立桥接，不依赖用户重新打开手机界面。
 */
public class NavigationService extends Service {

    private static final String TAG = "RingMapNav";
    private static final String CHANNEL_ID = "ringmap_nav";
    private static final int NOTIFICATION_ID = 1001;
    private static final long REBIND_INTERVAL_MS = 30_000L;

    private static volatile NavigationService sInstance;
    private static volatile String sState = "未运行";
    private static volatile String sError = "";

    private boolean foregroundStarted;
    private final Handler healthHandler = new Handler(Looper.getMainLooper());
    private final Runnable listenerHealthCheck = new Runnable() {
        @Override public void run() {
            if (!LastNavCache.isListenerConnected()) {
                NotificationListenerRecovery.request(NavigationService.this, true);
                LastNavCache.setDebug("[后台自检] 正在恢复系统通知监听");
                Log.i(TAG, "Background listener health check requested recovery");
            }
            NavBridgeRuntime.ensureStarted(getApplicationContext());
            healthHandler.postDelayed(this, REBIND_INTERVAL_MS);
        }
    };

    /** 当前 UI 的可用性以通知监听持有的本机桥为准。 */
    public static boolean isRunning() {
        return NavBridgeRuntime.isRunning();
    }

    public static boolean isForegroundRunning() {
        NavigationService service = sInstance;
        return service != null && service.foregroundStarted;
    }

    public static int getClientCount() {
        return NavBridgeRuntime.getClientCount();
    }

    public static String getState() {
        if (!NavBridgeRuntime.isRunning()) return sState;
        return isForegroundRunning() ? "监听桥运行中" : "监听桥运行中 · 前台服务未运行";
    }

    public static String getError() {
        String bridgeError = NavBridgeRuntime.getLastError();
        return bridgeError.isEmpty() ? sError : bridgeError;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        sInstance = this;
        sState = "启动中";
        sError = "";
        Log.d(TAG, "NavigationService onCreate");

        startForeground(NOTIFICATION_ID, createNotification("后台同步运行中 · 等待导航数据"));
        foregroundStarted = true;
        NavStateRepository.get().setForegroundServiceRunning(true);
        if (!NotificationAccess.isGranted(this)) {
            LastNavCache.setDebug("[监听未授权] 请在系统设置授予通知使用权");
        }
        ensureBridge();
        healthHandler.removeCallbacks(listenerHealthCheck);
        healthHandler.post(listenerHealthCheck);
        requestListenerRebind();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (!foregroundStarted) {
            startForeground(NOTIFICATION_ID, createNotification("后台同步运行中 · 等待导航数据"));
            foregroundStarted = true;
            NavStateRepository.get().setForegroundServiceRunning(true);
        }
        ensureBridge();
        requestListenerRebind();
        return START_STICKY;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // 从最近任务划掉界面时保留正在运行的前台保活；桥接本身也由通知监听兜底。
        try {
            ContextCompat.startForegroundService(this, new Intent(this, NavigationService.class));
        } catch (Exception error) {
            Log.w(TAG, "Restart service after task removal failed", error);
        }
        super.onTaskRemoved(rootIntent);
    }

    private void ensureBridge() {
        if (NavBridgeRuntime.ensureStarted(getApplicationContext())) {
            sState = "运行中";
            sError = "";
        } else {
            sState = "异常";
            sError = NavBridgeRuntime.getLastError();
        }
    }

    private void requestListenerRebind() {
        NotificationListenerRecovery.request(this);
    }

    private Notification createNotification(String text) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "导航服务",
                    NotificationManager.IMPORTANCE_LOW);
            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) manager.createNotificationChannel(channel);
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
        healthHandler.removeCallbacks(listenerHealthCheck);
        foregroundStarted = false;
        sInstance = null;
        sState = "未运行";
        NavStateRepository.get().setForegroundServiceRunning(false);
        if (NavBridgeRuntime.isRunning()) {
            NavStateRepository.get().setServiceState(true, getState(), "");
        } else {
            NavStateRepository.get().setServiceState(false, sState, getError());
            NavStateRepository.get().setClientCount(0);
        }
        Log.d(TAG, "NavigationService onDestroy");
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
