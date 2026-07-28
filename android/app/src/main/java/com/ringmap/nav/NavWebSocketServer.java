package com.ringmap.nav;

import android.util.Log;

import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.WebSocketServer;

import java.net.InetSocketAddress;
import java.util.Set;
import java.util.concurrent.CopyOnWriteArraySet;

/** 本地 WebSocket 服务器，客户端是 ZeppOS App-Side 中继。 */
public class NavWebSocketServer extends WebSocketServer {

    private static final String TAG = "RingMapWS";
    private final Set<WebSocket> clients = new CopyOnWriteArraySet<>();
    private volatile long lastClientConnectedAt;
    private volatile long lastClientActivityAt;
    private volatile String lastError = "";

    public NavWebSocketServer(InetSocketAddress address) {
        super(address);
        // 允许短时间重启服务时复用 8886，避免旧连接 TIME_WAIT 造成“地址已占用”。
        setReuseAddr(true);
        setConnectionLostTimeout(15);
    }

    @Override
    public void onOpen(WebSocket conn, ClientHandshake handshake) {
        clients.add(conn);
        long now = System.currentTimeMillis();
        lastClientConnectedAt = now;
        lastClientActivityAt = now;
        Log.d(TAG, "ZeppOS app-side connected: " + conn.getRemoteSocketAddress());
        conn.send("wconnected");
        // 手表在导航已经开始后才打开应用时，立即补发最近一条指令，避免一直停在等待中。
        if (LastNavCache.get() != null) conn.send(LastNavCache.get().toString());
    }

    @Override
    public void onClose(WebSocket conn, int code, String reason, boolean remote) {
        clients.remove(conn);
        lastClientActivityAt = System.currentTimeMillis();
        Log.d(TAG, "ZeppOS app-side disconnected: " + reason + ", clients=" + clients.size());
    }

    @Override
    public void onMessage(WebSocket conn, String message) {
        lastClientActivityAt = System.currentTimeMillis();
        Log.d(TAG, "Message from ZeppOS: " + message);
        if (message != null && message.contains("watch_ack")) {
            LastNavCache.setWatchAck();
        }
    }

    @Override
    public void onError(WebSocket conn, Exception ex) {
        lastError = ex == null ? "WebSocket error" : String.valueOf(ex.getMessage());
        Log.e(TAG, "WebSocket error", ex);
    }

    @Override
    public void onStart() {
        Log.d(TAG, "WebSocket server started on " + getAddress());
        startConnectionLostTimer();
    }

    @Override
    public void broadcast(String data) {
        lastClientActivityAt = System.currentTimeMillis();
        super.broadcast(data);
    }

    public int getClientCount() { return clients.size(); }
    public long getLastClientConnectedAt() { return lastClientConnectedAt; }
    public long getLastClientActivityAt() { return lastClientActivityAt; }
    public String getLastError() { return lastError; }
}
