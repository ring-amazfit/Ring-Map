package com.ringmap.nav;

import android.util.Log;

import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.WebSocketServer;
import org.json.JSONObject;

import java.net.InetSocketAddress;
import java.util.Set;
import java.util.concurrent.CopyOnWriteArraySet;

/** 本机 WebSocket 服务器，客户端仅为 ZeppOS App-Side 中继。 */
public class NavWebSocketServer extends WebSocketServer {

    private static final String TAG = "RingMapWS";
    private final Set<WebSocket> clients = new CopyOnWriteArraySet<>();
    private volatile long lastClientConnectedAt;
    private volatile long lastClientActivityAt;
    private volatile String lastError = "";

    public NavWebSocketServer(InetSocketAddress address) {
        super(address);
        setReuseAddr(true);
        setConnectionLostTimeout(15);
    }

    @Override
    public void onOpen(WebSocket connection, ClientHandshake handshake) {
        // Zepp 可能同时运行手表页、设置页等多个 App-Side 上下文。
        // 连接必须并存；互相驱逐会让各自的自动重连形成无限乒乓。
        clients.add(connection);
        long now = System.currentTimeMillis();
        lastClientConnectedAt = now;
        lastClientActivityAt = now;
        Log.i(TAG, "ZeppOS app-side connected: " + connection.getRemoteSocketAddress()
                + ", clients=" + clients.size());
        NavStateRepository.get().setClientCount(clients.size());
        connection.send(NavProtocol.bridgeState("connected", clients.size()).toString());
        sendCurrentState(connection);
    }

    @Override
    public void onClose(WebSocket connection, int code, String reason, boolean remote) {
        clients.remove(connection);
        lastClientActivityAt = System.currentTimeMillis();
        NavStateRepository.get().setClientCount(clients.size());
        Log.i(TAG, "ZeppOS app-side disconnected: " + reason + ", clients=" + clients.size());
    }

    @Override
    public void onMessage(WebSocket connection, String message) {
        lastClientActivityAt = System.currentTimeMillis();
        try {
            JSONObject packet = new JSONObject(message == null ? "" : message);
            if (packet.optInt("protocolVersion", 0) != NavProtocol.VERSION) {
                Log.w(TAG, "Unsupported protocol packet");
                return;
            }
            String type = packet.optString("type", "");
            if ("hello".equals(type) || "resync".equals(type)) {
                sendCurrentState(connection);
            } else if ("ping".equals(type)) {
                connection.send(NavProtocol.pong(packet.optLong("emittedAt", 0L)).toString());
            } else if ("nav_ack".equals(type)) {
                if (LastNavCache.setWatchAck(packet)) {
                    Log.i(TAG, "Watch ACK: session=" + packet.optString("sessionId")
                            + ", seq=" + packet.optLong("seq")
                            + ", status=" + packet.optString("status"));
                } else {
                    Log.d(TAG, "Ignored stale watch ACK");
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Invalid WebSocket message", e);
        }
    }

    private void sendCurrentState(WebSocket connection) {
        JSONObject current = LastNavCache.getFresh();
        if (current != null) {
            connection.send(current.toString());
        } else {
            connection.send(NavProtocol.idle().toString());
        }
    }

    @Override
    public void onError(WebSocket connection, Exception error) {
        lastError = error == null ? "WebSocket error" : String.valueOf(error.getMessage());
        NavStateRepository.get().record("桥接", "WebSocket 发生错误");
        if (connection == null) NavBridgeRuntime.onFatalServerError(this, error);
        Log.e(TAG, "WebSocket error", error);
    }

    @Override
    public void onStart() {
        NavBridgeRuntime.onServerStarted(this);
        Log.i(TAG, "WebSocket server started on " + getAddress());
        NavStateRepository.get().record("桥接", "本机端口 8886 已监听");
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
