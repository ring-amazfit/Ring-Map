package com.ringmap.nav;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import java.net.InetSocketAddress;

/**
 * 由系统通知监听启动的本机桥接运行时。
 *
 * NotificationListenerService 是系统绑定组件，即使 RingMap 界面不在前台也能收到
 * 高德/百度的导航通知。桥接不能只依赖有运行时长限制的 dataSync 前台服务，否则
 * 服务超时或被 OEM 回收后会丢失 WebSocket，迫使用户再次打开手机界面。
 */
public final class NavBridgeRuntime implements NavDataBus.Listener {

    private static final String TAG = "RingMapBridge";
    private static final int WS_PORT = 8886;
    private static final Object LOCK = new Object();
    private static final long[] RESTART_DELAYS_MS = {1000L, 3000L, 10000L, 30000L};
    private static final Handler RESTART_HANDLER = new Handler(Looper.getMainLooper());

    private static volatile NavBridgeRuntime instance;
    private static volatile String lastError = "";
    private static volatile Context applicationContext;
    private static int restartAttempt;

    private static final Runnable RESTART_TASK = new Runnable() {
        @Override public void run() {
            Context context = applicationContext;
            if (context != null) ensureStarted(context);
        }
    };

    private final NavWebSocketServer server;
    private volatile boolean started;

    private NavBridgeRuntime(NavWebSocketServer server) {
        this.server = server;
    }

    /** 幂等建立本机 WebSocket，并接管进程内导航事件总线。 */
    public static boolean ensureStarted(Context context) {
        synchronized (LOCK) {
            if (context != null) {
                Context app = context.getApplicationContext();
                applicationContext = app == null ? context : app;
            }
            NavBridgeRuntime current = instance;
            if (current != null && current.server != null) {
                NavDataBus.setListener(current);
                return true;
            }
            NavBridgeRuntime runtime = null;
            try {
                NavWebSocketServer server = new NavWebSocketServer(
                        new InetSocketAddress("127.0.0.1", WS_PORT));
                runtime = new NavBridgeRuntime(server);
                // start() binds on a worker thread. Publish this generation first so an
                // immediate onError(null) can invalidate the exact failed runtime.
                instance = runtime;
                lastError = "";
                NavDataBus.setListener(runtime);
                NavStateRepository.get().setServiceState(true, "桥接启动中", "");
                server.start();
                return true;
            } catch (Exception error) {
                if (instance == runtime) instance = null;
                lastError = error.getMessage() == null ? "本机桥启动失败" : error.getMessage();
                NavDataBus.setListener(null);
                NavStateRepository.get().setServiceState(false, "桥接异常", lastError);
                LastNavCache.setDebug("[桥接异常] 无法启动本机同步端口");
                Log.e(TAG, "Unable to start notification-owned bridge", error);
                scheduleRestartLocked();
                return false;
            }
        }
    }

    private static void scheduleRestartLocked() {
        if (applicationContext == null || instance != null) return;
        int index = Math.min(restartAttempt, RESTART_DELAYS_MS.length - 1);
        restartAttempt = Math.min(restartAttempt + 1, RESTART_DELAYS_MS.length - 1);
        RESTART_HANDLER.removeCallbacks(RESTART_TASK);
        RESTART_HANDLER.postDelayed(RESTART_TASK, RESTART_DELAYS_MS[index]);
    }

    public static boolean isRunning() {
        NavBridgeRuntime current = instance;
        return current != null && current.server != null && current.started;
    }

    public static int getClientCount() {
        NavBridgeRuntime current = instance;
        return current == null || current.server == null || !current.started
                ? 0 : current.server.getClientCount();
    }

    public static String getLastError() {
        return lastError;
    }

    static void onServerStarted(NavWebSocketServer startedServer) {
        synchronized (LOCK) {
            NavBridgeRuntime current = instance;
            if (current == null || current.server != startedServer) return;
            current.started = true;
            lastError = "";
            restartAttempt = 0;
            RESTART_HANDLER.removeCallbacks(RESTART_TASK);
            NavStateRepository.get().setServiceState(true, "监听桥运行中", "");
            Log.i(TAG, "Notification-owned bridge ready on port " + WS_PORT);
        }
    }

    static void onFatalServerError(NavWebSocketServer failedServer, Exception error) {
        synchronized (LOCK) {
            NavBridgeRuntime current = instance;
            if (current == null || current.server != failedServer) return;
            current.started = false;
            instance = null;
            lastError = error == null || error.getMessage() == null
                    ? "本机桥运行异常" : error.getMessage();
            NavDataBus.setListener(null);
            NavStateRepository.get().setServiceState(false, "桥接异常", lastError);
            LastNavCache.setDebug("[桥接异常] 正在自动恢复本机同步端口");
            Log.e(TAG, "Notification-owned bridge stopped unexpectedly", error);
            scheduleRestartLocked();
        }
    }

    @Override
    public void onNavData(String json) {
        if (server == null || !started || json == null) return;
        server.broadcast(json);
        Log.d(TAG, "Navigation snapshot broadcast to " + server.getClientCount()
                + " client(s), bytes=" + json.length());
    }

    @Override
    public void onNavEnd(String json) {
        if (server == null || !started || json == null) return;
        server.broadcast(json);
        Log.i(TAG, "Navigation end broadcast to " + server.getClientCount()
                + " client(s), bytes=" + json.length());
    }
}
