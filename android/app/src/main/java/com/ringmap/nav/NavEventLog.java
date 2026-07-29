package com.ringmap.nav;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/** 有界、线程安全、仅驻留内存的诊断事件环。 */
public final class NavEventLog {

    private final int capacity;
    private final ArrayDeque<NavEvent> events = new ArrayDeque<>();

    public NavEventLog(int capacity) {
        if (capacity < 1) throw new IllegalArgumentException("capacity must be positive");
        this.capacity = capacity;
    }

    public synchronized void add(long timestamp, String category, String message) {
        events.addFirst(new NavEvent(timestamp, normalize(category, 24), normalize(message, 160)));
        while (events.size() > capacity) events.removeLast();
    }

    public synchronized List<NavEvent> snapshot() {
        return Collections.unmodifiableList(new ArrayList<>(events));
    }

    public synchronized void clear() {
        events.clear();
    }

    private static String normalize(String value, int limit) {
        String normalized = value == null ? "" : value.replaceAll("[\\r\\n\\t]+", " ")
                .replaceAll("\\s+", " ").trim();
        if (normalized.length() > limit) return normalized.substring(0, limit - 1) + "…";
        return normalized;
    }
}
