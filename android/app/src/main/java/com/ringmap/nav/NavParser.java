package com.ringmap.nav;

import org.json.JSONObject;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** 将地图导航通知文本转换为手表端使用的导航数据。纯 Java，便于单元测试。 */
public final class NavParser {

    private static final Pattern DISTANCE_PATTERN = Pattern.compile(
            "(\\d+(?:\\.\\d+)?)\\s*(公里|千米|米|m|km)", Pattern.CASE_INSENSITIVE);
    private static final Pattern ROAD_PATTERN = Pattern.compile(
            "(?:进入|驶入|沿|上|经由|途经)\\s*([\\u4e00-\\u9fa5A-Za-z0-9]{2,24}?)"
                    + "(?=行驶|前行|直行|继续|[,，。；;]|$)");
    private static final Pattern REDUNDANT_SOURCE_SUFFIX = Pattern.compile(
            "\\s*[|｜·]\\s*(?:高德|百度)(?:地图)?导航(?:中)?$");

    private NavParser() {}

    public static boolean looksLikeNavigation(String rawText) {
        if (rawText == null) return false;
        String text = normalize(rawText);
        if (text.isEmpty()) return false;
        if (containsAny(text, "导航中", "持续为您导航", "正在为您骑行导航", "正在为您驾车导航",
                "正在为您步行导航", "骑行导航开始", "驾车导航开始", "步行导航开始",
                "导航结束", "导航已结束", "退出导航", "到达目的地")) {
            return true;
        }
        String action = detectAction(text);
        if (!"wait".equals(action)) return true;
        return text.contains("前方") && DISTANCE_PATTERN.matcher(text).find();
    }

    public static NavInstruction parseInstruction(String rawText) {
        if (rawText == null || rawText.trim().isEmpty()) return null;
        String text = REDUNDANT_SOURCE_SUFFIX.matcher(normalize(rawText)).replaceFirst("").trim();
        int meters = 0;
        String distanceText = "";
        Matcher distance = DISTANCE_PATTERN.matcher(text);
        if (distance.find()) {
            double value = Double.parseDouble(distance.group(1));
            String unit = distance.group(2).toLowerCase(Locale.ROOT);
            meters = unit.equals("km") || unit.contains("公里") || unit.contains("千米")
                    ? (int) Math.round(value * 1000) : (int) Math.round(value);
            distanceText = meters < 1000
                    ? meters + "米" : String.format(Locale.ROOT, "%.1f公里", meters / 1000.0);
        }
        Matcher road = ROAD_PATTERN.matcher(text);
        String roadName = road.find() ? road.group(1) : "";
        return new NavInstruction(text, detectAction(text), meters, distanceText, roadName);
    }

    public static JSONObject parse(String rawText) {
        return parse(rawText, null);
    }

    public static JSONObject parse(String rawText, String sourcePackage) {
        NavInstruction instruction = parseInstruction(rawText);
        if (instruction == null) return null;
        try {
            JSONObject data = new JSONObject();
            data.put("instruction", instruction.rawText);
            data.put("ts", System.currentTimeMillis());
            data.put("action", instruction.action);
            data.put("quality", NavSessionController.qualityOf(instruction));
            if (sourcePackage != null && !sourcePackage.isEmpty()) {
                data.put("sourcePackage", sourcePackage);
            }
            if (instruction.distance > 0) {
                data.put("distance", instruction.distance);
                data.put("distanceMeters", instruction.distance);
                data.put("distanceText", instruction.distanceText);
            }
            if (!instruction.road.isEmpty()) data.put("road", instruction.road);
            return data;
        } catch (Exception e) {
            throw new IllegalStateException("构造导航数据失败: " + rawText, e);
        }
    }

    public static String detectAction(String rawText) {
        if (rawText == null) return "wait";
        String text = normalize(rawText);
        if (text.isEmpty()) return "wait";

        if (containsAny(text, "到达目的地", "已到达", "抵达终点", "到达终点", "导航结束")) return "arrive";
        if (containsAny(text, "重新规划", "路线重算", "正在重算")) return "reroute";
        if (containsAny(text, "驶出环岛", "离开环岛", "环岛出口")) return "roundabout_exit";
        if (containsAny(text, "进入环岛", "驶入环岛", "前方环岛")) return "roundabout_enter";
        if (containsAny(text, "向右掉头", "向右调头", "右转掉头")) return "uturn_right";
        if (containsAny(text, "向左掉头", "向左调头", "左转掉头", "掉头", "调头")) return "uturn_left";
        if (containsAny(text, "向左急转", "左急转", "急左转")) return "sharp_left";
        if (containsAny(text, "向右急转", "右急转", "急右转")) return "sharp_right";
        if (containsAny(text, "左后方", "向左后方")) return "back_left";
        if (containsAny(text, "右后方", "向右后方")) return "back_right";
        if (containsAny(text, "稍向左", "稍左")) return "slight_left";
        if (containsAny(text, "稍向右", "稍右")) return "slight_right";
        if (containsAny(text, "左前方", "向左前方")) return "forward_left";
        if (containsAny(text, "右前方", "向右前方")) return "forward_right";
        if (containsAny(text, "靠左", "保持左侧", "左侧车道行驶", "最左车道", "左车道")) return "keep_left";
        if (containsAny(text, "靠右", "保持右侧", "右侧车道行驶", "最右车道", "右车道")) return "keep_right";
        if (containsAny(text, "向左合流", "左侧合流", "向左汇入", "向左变道", "左变道")) return "merge_left";
        if (containsAny(text, "向右合流", "右侧合流", "向右汇入", "向右变道", "右变道")) return "merge_right";
        if (containsAny(text, "左侧岔路", "左侧分叉", "向左分岔")) return "fork_left";
        if (containsAny(text, "右侧岔路", "右侧分叉", "向右分岔")) return "fork_right";
        if (containsAny(text, "左侧出口", "从左出口", "左侧匝道")) return "exit_left";
        if (containsAny(text, "右侧出口", "从右出口", "右侧匝道")) return "exit_right";
        if (containsAny(text, "左转", "左转弯", "向左转", "左拐")) return "turn_left";
        if (containsAny(text, "右转", "右转弯", "向右转", "右拐")) return "turn_right";
        if (containsAny(text, "直行", "继续向前", "向前行驶", "保持向前", "继续行驶", "沿当前道路行驶")) return "straight";
        return "wait";
    }

    private static String normalize(String text) {
        StringBuilder normalized = new StringBuilder(text.length());
        for (int index = 0; index < text.length(); index++) {
            char value = text.charAt(index);
            normalized.append(value >= '０' && value <= '９'
                    ? (char) ('0' + value - '０') : value);
        }
        return normalized.toString().replaceAll("\\s+", " ").trim();
    }

    private static boolean containsAny(String text, String... values) {
        for (String value : values) if (text.contains(value)) return true;
        return false;
    }
}
