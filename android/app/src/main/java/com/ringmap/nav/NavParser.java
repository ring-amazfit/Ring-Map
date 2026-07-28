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
            "(?:进入|上|沿|向|驶入)\\s*([\\u4e00-\\u9fa5A-Za-z0-9]{2,24}(?:路|街|道|桥|高速|国道|乡道|镇道))");

    private NavParser() {}

    public static boolean looksLikeNavigation(String text) {
        if (text == null) return false;
        return text.contains("导航中") || text.contains("持续为您导航") || text.contains("正在为您")
                || text.contains("骑行导航开始") || text.contains("驾车导航开始") || text.contains("步行导航开始")
                || text.contains("前方") || text.contains("米") || text.contains("公里")
                || text.contains("千米") || text.matches(".*\\d+\\s*(?:m|km).*" )
                || text.contains("左转") || text.contains("右转") || text.contains("直行")
                || text.contains("掉头") || text.contains("调头") || text.contains("到达")
                || text.contains("终点") || text.contains("进入") || text.contains("沿")
                || text.contains("前方路口") || text.contains("保持");
    }

    public static NavInstruction parseInstruction(String rawText) {
        if (rawText == null || rawText.trim().isEmpty()) return null;
        String text = rawText.replaceAll("\\s+", " ").trim();
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
            if (sourcePackage != null && !sourcePackage.isEmpty()) {
                data.put("sourcePackage", sourcePackage);
            }
            if (instruction.distance > 0) {
                data.put("distance", instruction.distance);
                data.put("distanceText", instruction.distanceText);
            }
            if (!instruction.road.isEmpty()) data.put("road", instruction.road);
            return data;
        } catch (Exception e) {
            throw new IllegalStateException("构造导航数据失败: " + rawText, e);
        }
    }

    public static String detectAction(String text) {
        if (text == null) return "straight";
        if (containsAny(text, "掉头", "调头", "左后", "右后")) return "uturn";
        if (containsAny(text, "稍向左", "靠左", "左前方", "稍左", "向左前方行驶")) return "slight_left";
        if (containsAny(text, "稍向右", "靠右", "右前方", "稍右", "向右前方行驶")) return "slight_right";
        if (containsAny(text, "左转", "左转弯", "向左转", "左拐")) return "left";
        if (containsAny(text, "右转", "右转弯", "向右转", "右拐")) return "right";
        if (containsAny(text, "到达", "终点", "目的地")) return "arrive";
        return "straight";
    }

    private static boolean containsAny(String text, String... values) {
        for (String value : values) if (text.contains(value)) return true;
        return false;
    }
}
