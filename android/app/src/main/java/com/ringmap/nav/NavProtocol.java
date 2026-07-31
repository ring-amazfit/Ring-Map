package com.ringmap.nav;

import org.json.JSONObject;

import java.util.concurrent.atomic.AtomicLong;

/** RingMap Android、App-Side 与手表共用的协议 v2 编码器。 */
public final class NavProtocol {

    public static final int VERSION = 2;
    private static final AtomicLong LAST_REVISION = new AtomicLong();

    private NavProtocol() {}

    public static JSONObject snapshot(NavSessionController.Decision decision) {
        if (decision == null || !decision.accepted || decision.instruction == null) {
            throw new IllegalArgumentException("accepted navigation decision required");
        }
        try {
            NavInstruction instruction = decision.instruction;
            JSONObject data = base("nav_snapshot");
            data.put("state", "active");
            data.put("sessionId", decision.sessionId);
            data.put("sessionStartedAt", decision.sessionStartedAt);
            data.put("seq", decision.seq);
            data.put("eventId", decision.sessionId + ":" + decision.seq);
            data.put("fingerprint", decision.fingerprint);
            data.put("capturedAt", decision.capturedAt);
            data.put("parsedAt", decision.parsedAt);
            data.put("emittedAt", decision.emittedAt);
            data.put("ttlMs", NavSessionController.SNAPSHOT_TTL_MS);
            data.put("sourcePackage", decision.sourcePackage);
            data.put("sourceName", sourceName(decision.sourcePackage));
            data.put("quality", decision.quality);
            data.put("action", instruction.action);
            data.put("instruction", instruction.rawText);
            data.put("instructionId", NavSessionController.instructionIdOf(instruction));
            data.put("hapticToken", decision.sessionId + ":"
                    + NavSessionController.instructionIdOf(instruction));
            if (instruction.distance > 0) {
                data.put("distance", instruction.distance);
                data.put("distanceMeters", instruction.distance);
                data.put("distanceText", instruction.distanceText);
            }
            if (!instruction.road.isEmpty()) data.put("road", instruction.road);
            return data;
        } catch (Exception e) {
            throw new IllegalStateException("Cannot encode navigation snapshot", e);
        }
    }

    public static JSONObject end(NavSessionController.EndDecision decision) {
        if (decision == null || !decision.accepted) {
            throw new IllegalArgumentException("accepted end decision required");
        }
        try {
            JSONObject data = base("nav_end");
            data.put("state", "ended");
            data.put("sessionId", decision.sessionId);
            data.put("sessionStartedAt", decision.sessionStartedAt);
            data.put("seq", decision.seq);
            data.put("sourcePackage", decision.sourcePackage);
            data.put("sourceName", sourceName(decision.sourcePackage));
            data.put("emittedAt", decision.emittedAt);
            return data;
        } catch (Exception e) {
            throw new IllegalStateException("Cannot encode navigation end", e);
        }
    }

    public static JSONObject bridgeState(String status, int clientCount) {
        try {
            JSONObject data = base("bridge_state");
            data.put("status", status == null ? "unknown" : status);
            data.put("bridgeOrigin", "android");
            data.put("clientCount", clientCount);
            data.put("emittedAt", System.currentTimeMillis());
            return data;
        } catch (Exception e) {
            throw new IllegalStateException("Cannot encode bridge state", e);
        }
    }

    public static JSONObject idle() {
        try {
            JSONObject data = base("idle");
            data.put("state", "idle");
            data.put("emittedAt", System.currentTimeMillis());
            return data;
        } catch (Exception e) {
            throw new IllegalStateException("Cannot encode idle state", e);
        }
    }

    public static JSONObject pong(long pingAt) {
        try {
            JSONObject data = base("pong");
            data.put("pingAt", pingAt);
            data.put("emittedAt", System.currentTimeMillis());
            return data;
        } catch (Exception e) {
            throw new IllegalStateException("Cannot encode pong", e);
        }
    }

    private static JSONObject base(String type) throws Exception {
        JSONObject data = new JSONObject();
        data.put("protocolVersion", VERSION);
        data.put("type", type);
        data.put("stateRevision", nextRevision());
        return data;
    }

    static long nextRevision() {
        while (true) {
            long previous = LAST_REVISION.get();
            long next = Math.max(System.currentTimeMillis(), previous + 1L);
            if (LAST_REVISION.compareAndSet(previous, next)) return next;
        }
    }

    public static String sourceName(String packageName) {
        if ("com.baidu.BaiduMap".equals(packageName)) return "百度地图";
        if ("com.autonavi.minimap".equals(packageName)) return "高德地图";
        return "系统导航";
    }
}
