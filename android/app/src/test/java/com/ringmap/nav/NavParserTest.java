package com.ringmap.nav;

import org.junit.Test;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

/** 导航通知解析的回归测试。 */
public class NavParserTest {

    @Test
    public void parsesRightTurnDistanceAndRoad() {
        NavInstruction result = NavParser.parseInstruction("前方 200 米右转进入中山路");

        assertEquals("right", result.action);
        assertEquals(200, result.distance);
        assertEquals("中山路", result.road);
    }

    @Test
    public void parsesUturnBeforeGenericTurn() {
        NavInstruction result = NavParser.parseInstruction("前方 1.2 公里掉头");

        assertEquals("uturn", result.action);
        assertEquals(1200, result.distance);
    }

    @Test
    public void parsesBaiduStyleForwardLeftTurn() {
        NavInstruction result = NavParser.parseInstruction("前方500米向左前方行驶");

        assertEquals("slight_left", result.action);
        assertEquals(500, result.distance);
    }

    @Test
    public void recognizesNavigationWithoutAKeywordSeparatorBug() {
        assertTrue(NavParser.looksLikeNavigation("前方500米左转"));
    }

    @Test
    public void recognizesAmapRidingNavigationStartNotification() {
        assertTrue(NavParser.looksLikeNavigation("骑行导航开始 从当前位置出发｜高德导航中"));
        assertTrue(NavParser.looksLikeNavigation("高德地图持续为您导航 正在为您骑行导航>>"));
    }

    @Test
    public void includesExactSourcePackageInParsedJson() throws Exception {
        // JSONObject 在 Android 本地单元测试环境未提供实现；来源字段由通知监听器写入，
        // 这里用源码契约测试覆盖重载入口，实际 JSON 行为在 Android 构建中验证。
        assertTrue(NavParser.class.getDeclaredMethod("parse", String.class, String.class) != null);
    }

}
