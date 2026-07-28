package com.ringmap.nav;

/** 与 Android JSON/通知 API 解耦的导航指令模型。 */
public final class NavInstruction {
    public final String rawText;
    public final String action;
    public final int distance;
    public final String distanceText;
    public final String road;

    public NavInstruction(String rawText, String action, int distance,
                          String distanceText, String road) {
        this.rawText = rawText;
        this.action = action;
        this.distance = distance;
        this.distanceText = distanceText;
        this.road = road;
    }
}
