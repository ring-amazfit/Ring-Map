package com.ringmap.nav;

/** 一条不包含原始导航正文的进程内诊断事件。 */
public final class NavEvent {
    public final long timestamp;
    public final String category;
    public final String message;

    public NavEvent(long timestamp, String category, String message) {
        this.timestamp = timestamp;
        this.category = category;
        this.message = message;
    }
}
