package com.ringmap.nav;

import java.util.Locale;

public final class UiFormat {

    private UiFormat() {}

    public static String age(long timestamp, long now) {
        if (timestamp <= 0L) return "尚未发生";
        long seconds = Math.max(0L, (now - timestamp) / 1000L);
        if (seconds < 5L) return "刚刚";
        if (seconds < 60L) return seconds + " 秒前";
        if (seconds < 3600L) return (seconds / 60L) + " 分钟前";
        return (seconds / 3600L) + " 小时前";
    }

    public static String metric(long millis) {
        if (millis < 0L) return "未测得";
        if (millis < 1000L) return millis + " ms";
        return String.format(Locale.CHINA, "%.2f s", millis / 1000f);
    }

    public static String actionTitle(String action) {
        if (action == null) return "等待新指令";
        switch (action) {
            case "straight": return "继续直行";
            case "turn_left": return "向左转弯";
            case "turn_right": return "向右转弯";
            case "slight_left": return "稍向左转";
            case "slight_right": return "稍向右转";
            case "forward_left": return "驶向左前方";
            case "forward_right": return "驶向右前方";
            case "back_left": return "驶向左后方";
            case "back_right": return "驶向右后方";
            case "uturn_left": return "向左掉头";
            case "uturn_right": return "向右掉头";
            case "sharp_left": return "向左急转";
            case "sharp_right": return "向右急转";
            case "keep_left": return "保持左侧";
            case "keep_right": return "保持右侧";
            case "roundabout_enter": return "进入环岛";
            case "roundabout_exit": return "驶出环岛";
            case "merge_left": return "向左合流";
            case "merge_right": return "向右合流";
            case "fork_left": return "选择左侧岔路";
            case "fork_right": return "选择右侧岔路";
            case "exit_left": return "从左侧出口驶出";
            case "exit_right": return "从右侧出口驶出";
            case "arrive": return "已到达目的地";
            case "reroute": return "正在重新规划";
            default: return "等待新指令";
        }
    }

    public static int actionIcon(String action) {
        if (action == null) return R.drawable.nav_wait;
        switch (action) {
            case "straight": return R.drawable.nav_straight;
            case "turn_left": return R.drawable.nav_turn_left;
            case "turn_right": return R.drawable.nav_turn_right;
            case "slight_left": return R.drawable.nav_slight_left;
            case "slight_right": return R.drawable.nav_slight_right;
            case "forward_left": return R.drawable.nav_forward_left;
            case "forward_right": return R.drawable.nav_forward_right;
            case "back_left": return R.drawable.nav_back_left;
            case "back_right": return R.drawable.nav_back_right;
            case "uturn_left": return R.drawable.nav_uturn_left;
            case "uturn_right": return R.drawable.nav_uturn_right;
            case "sharp_left": return R.drawable.nav_sharp_left;
            case "sharp_right": return R.drawable.nav_sharp_right;
            case "keep_left": return R.drawable.nav_keep_left;
            case "keep_right": return R.drawable.nav_keep_right;
            case "roundabout_enter": return R.drawable.nav_roundabout_enter;
            case "roundabout_exit": return R.drawable.nav_roundabout_exit;
            case "merge_left": return R.drawable.nav_merge_left;
            case "merge_right": return R.drawable.nav_merge_right;
            case "fork_left": return R.drawable.nav_fork_left;
            case "fork_right": return R.drawable.nav_fork_right;
            case "exit_left": return R.drawable.nav_exit_left;
            case "exit_right": return R.drawable.nav_exit_right;
            case "arrive": return R.drawable.nav_arrive;
            case "reroute": return R.drawable.nav_reroute;
            default: return R.drawable.nav_wait;
        }
    }

    public static String shortSession(String sessionId) {
        if (sessionId == null || sessionId.isEmpty()) return "—";
        return sessionId.length() <= 12 ? sessionId : sessionId.substring(0, 8) + "…";
    }
}
