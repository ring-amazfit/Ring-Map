package com.ringmap.nav;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.UUID;

/** Android 端唯一导航会话控制器。纯 Java，便于覆盖时序和去重测试。 */
public final class NavSessionController {

    public static final long DUPLICATE_WINDOW_MS = 5000L;
    public static final long COMPLETE_FRESHNESS_MS = 45_000L;
    public static final long SOURCE_STALE_MS = 90_000L;
    public static final long SNAPSHOT_TTL_MS = 60_000L;

    public interface SessionIdFactory {
        String create();
    }

    public static final class Decision {
        public final boolean accepted;
        public final String reason;
        public final String sessionId;
        public final long sessionStartedAt;
        public final long seq;
        public final String sourcePackage;
        public final String notificationKey;
        public final String quality;
        public final String fingerprint;
        public final long capturedAt;
        public final long parsedAt;
        public final long emittedAt;
        public final NavInstruction instruction;

        private Decision(boolean accepted, String reason, String sessionId,
                         long sessionStartedAt, long seq, String sourcePackage,
                         String notificationKey, String quality, String fingerprint,
                         long capturedAt, long parsedAt, long emittedAt,
                         NavInstruction instruction) {
            this.accepted = accepted;
            this.reason = reason;
            this.sessionId = sessionId;
            this.sessionStartedAt = sessionStartedAt;
            this.seq = seq;
            this.sourcePackage = sourcePackage;
            this.notificationKey = notificationKey;
            this.quality = quality;
            this.fingerprint = fingerprint;
            this.capturedAt = capturedAt;
            this.parsedAt = parsedAt;
            this.emittedAt = emittedAt;
            this.instruction = instruction;
        }
    }

    public static final class EndDecision {
        public final boolean accepted;
        public final String reason;
        public final String sessionId;
        public final long sessionStartedAt;
        public final long seq;
        public final String sourcePackage;
        public final long emittedAt;

        private EndDecision(boolean accepted, String reason, String sessionId,
                            long sessionStartedAt, long seq, String sourcePackage,
                            long emittedAt) {
            this.accepted = accepted;
            this.reason = reason;
            this.sessionId = sessionId;
            this.sessionStartedAt = sessionStartedAt;
            this.seq = seq;
            this.sourcePackage = sourcePackage;
            this.emittedAt = emittedAt;
        }
    }

    private final SessionIdFactory sessionIdFactory;
    private boolean active;
    private String sessionId = "";
    private long sessionStartedAt;
    private long seq;
    private String sourcePackage = "";
    private String activeNotificationKey = "";
    private String lastFingerprint = "";
    private String lastQuality = "";
    private long lastEmittedAt;
    private long lastCompleteAt;
    private long lastNotificationAt;

    public NavSessionController() {
        this(() -> UUID.randomUUID().toString());
    }

    public NavSessionController(SessionIdFactory sessionIdFactory) {
        if (sessionIdFactory == null) throw new IllegalArgumentException("sessionIdFactory == null");
        this.sessionIdFactory = sessionIdFactory;
    }

    public Decision accept(String candidateSource, String notificationKey,
                           NavInstruction instruction, long capturedAt,
                           long parsedAt, long emittedAt) {
        return accept(candidateSource, notificationKey, instruction, capturedAt,
                capturedAt, parsedAt, emittedAt);
    }

    public synchronized Decision accept(String candidateSource, String notificationKey,
                                        NavInstruction instruction, long notificationAt,
                                        long capturedAt, long parsedAt, long emittedAt) {
        String source = clean(candidateSource);
        if (source.isEmpty() || instruction == null) {
            return rejected("invalid_candidate", instruction, source, notificationKey,
                    capturedAt, parsedAt, emittedAt);
        }
        long eventAt = notificationAt > 0L ? notificationAt : capturedAt;
        if (active && lastNotificationAt > 0L && eventAt < lastNotificationAt) {
            return rejected("old_notification", instruction, source, notificationKey,
                    capturedAt, parsedAt, emittedAt);
        }
        if (active && lastEmittedAt > 0L && emittedAt - lastEmittedAt > SOURCE_STALE_MS) {
            reset();
        }
        if (active && !sourcePackage.equals(source)) {
            return rejected("source_locked", instruction, source, notificationKey,
                    capturedAt, parsedAt, emittedAt);
        }
        if (active) lastNotificationAt = Math.max(lastNotificationAt, eventAt);

        String quality = qualityOf(instruction);
        String fingerprint = fingerprintOf(instruction);
        if (active && fingerprint.equals(lastFingerprint)
                && emittedAt - lastEmittedAt < DUPLICATE_WINDOW_MS) {
            return rejected("duplicate", instruction, source, notificationKey,
                    capturedAt, parsedAt, emittedAt);
        }
        if (active && "partial".equals(quality) && "complete".equals(lastQuality)
                && emittedAt - lastCompleteAt < COMPLETE_FRESHNESS_MS) {
            return rejected("partial_over_complete", instruction, source, notificationKey,
                    capturedAt, parsedAt, emittedAt);
        }

        if (!active) {
            active = true;
            sessionId = sessionIdFactory.create();
            sessionStartedAt = emittedAt;
            seq = 0L;
            sourcePackage = source;
            lastFingerprint = "";
            lastQuality = "";
            lastEmittedAt = 0L;
            lastCompleteAt = 0L;
            lastNotificationAt = 0L;
        }

        seq++;
        activeNotificationKey = clean(notificationKey);
        lastFingerprint = fingerprint;
        lastQuality = quality;
        lastEmittedAt = emittedAt;
        lastNotificationAt = Math.max(lastNotificationAt, eventAt);
        if ("complete".equals(quality)) lastCompleteAt = emittedAt;
        return new Decision(true, "accepted", sessionId, sessionStartedAt, seq,
                sourcePackage, clean(notificationKey), quality, fingerprint,
                capturedAt, parsedAt, emittedAt, instruction);
    }

    public EndDecision end(String candidateSource, long emittedAt) {
        return end(candidateSource, emittedAt, emittedAt);
    }

    public synchronized EndDecision end(String candidateSource, long notificationAt,
                                        long emittedAt) {
        if (!active) {
            return new EndDecision(false, "idle", "", 0L, 0L,
                    clean(candidateSource), emittedAt);
        }
        String source = clean(candidateSource);
        if (!source.isEmpty() && !sourcePackage.equals(source)) {
            return new EndDecision(false, "source_mismatch", sessionId,
                    sessionStartedAt, seq, source, emittedAt);
        }
        if (notificationAt > 0L && lastNotificationAt > 0L
                && notificationAt < lastNotificationAt) {
            return new EndDecision(false, "old_notification", sessionId,
                    sessionStartedAt, seq, sourcePackage, emittedAt);
        }

        long endSeq = seq + 1L;
        EndDecision result = new EndDecision(true, "accepted", sessionId,
                sessionStartedAt, endSeq, sourcePackage, emittedAt);
        reset();
        return result;
    }

    public synchronized boolean isActive() {
        return active;
    }

    public synchronized String getActiveSource() {
        return sourcePackage;
    }

    public synchronized String getSessionId() {
        return sessionId;
    }

    public synchronized long getSeq() {
        return seq;
    }

    public synchronized String getActiveNotificationKey() {
        return activeNotificationKey;
    }

    private Decision rejected(String reason, NavInstruction instruction, String source,
                              String notificationKey, long capturedAt, long parsedAt,
                              long emittedAt) {
        return new Decision(false, reason, sessionId, sessionStartedAt, seq,
                source, clean(notificationKey), qualityOf(instruction),
                instruction == null ? "" : fingerprintOf(instruction),
                capturedAt, parsedAt, emittedAt, instruction);
    }

    private void reset() {
        active = false;
        sessionId = "";
        sessionStartedAt = 0L;
        seq = 0L;
        sourcePackage = "";
        activeNotificationKey = "";
        lastFingerprint = "";
        lastQuality = "";
        lastEmittedAt = 0L;
        lastCompleteAt = 0L;
        lastNotificationAt = 0L;
    }

    public static String qualityOf(NavInstruction instruction) {
        if (instruction == null || "wait".equals(instruction.action)) return "partial";
        return "complete";
    }

    public static String fingerprintOf(NavInstruction instruction) {
        if (instruction == null) return "";
        String normalized = clean(instruction.action).toLowerCase(Locale.ROOT) + "|"
                + instruction.distance + "|" + normalize(instruction.road) + "|"
                + normalize(instruction.rawText);
        return shortSha256(normalized);
    }

    public static String instructionIdOf(NavInstruction instruction) {
        if (instruction == null) return "";
        String withoutDistance = normalize(instruction.rawText)
                .replaceAll("\\d+(?:\\.\\d+)?\\s*(?:公里|千米|米|km|m)", "#")
                .replaceAll("\\d+", "#");
        return shortSha256(clean(instruction.action) + "|" + normalize(instruction.road)
                + "|" + withoutDistance);
    }

    private static String shortSha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder out = new StringBuilder(16);
            for (int i = 0; i < 8; i++) out.append(String.format(Locale.ROOT, "%02x", bytes[i]));
            return out.toString();
        } catch (Exception e) {
            return Integer.toHexString(input.hashCode());
        }
    }

    private static String normalize(String value) {
        return clean(value).replaceAll("\\s+", " ").trim();
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim();
    }
}
