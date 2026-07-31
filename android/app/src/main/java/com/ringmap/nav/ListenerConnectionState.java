package com.ringmap.nav;

/** 与 Android 生命周期无关的监听实例代际状态机。 */
final class ListenerConnectionState {

    private long generation;
    private boolean connected;

    synchronized long connected() {
        connected = true;
        return ++generation;
    }

    synchronized boolean disconnected(long candidateGeneration) {
        if (candidateGeneration <= 0L || candidateGeneration != generation) return false;
        connected = false;
        return true;
    }

    synchronized boolean isConnected() {
        return connected;
    }

    synchronized void forceDisconnected() {
        connected = false;
    }
}
