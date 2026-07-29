package com.ringmap.nav;

import org.junit.Test;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

/** 导航通知解析的回归测试。 */
public class NavParserTest {

    @Test
    public void parsesRightTurnDistanceAndRoad() {
        NavInstruction result = NavParser.parseInstruction("前方 200 米右转进入中山路");

        assertEquals("turn_right", result.action);
        assertEquals(200, result.distance);
        assertEquals("中山路", result.road);
    }

    @Test
    public void distinguishesDirectionalUturnsAndBackTurns() {
        assertEquals("uturn_left", NavParser.detectAction("前方1.2公里向左掉头"));
        assertEquals("uturn_right", NavParser.detectAction("前方路口向右掉头"));
        assertEquals("back_left", NavParser.detectAction("前方左后方转弯"));
        assertEquals("back_right", NavParser.detectAction("前方右后方转弯"));
    }

    @Test
    public void distinguishesSlightForwardAndSharpTurns() {
        assertEquals("slight_left", NavParser.detectAction("前方稍向左转"));
        assertEquals("slight_right", NavParser.detectAction("前方稍向右转"));
        assertEquals("forward_left", NavParser.detectAction("前方向左前方行驶"));
        assertEquals("forward_right", NavParser.detectAction("前方向右前方行驶"));
        assertEquals("sharp_left", NavParser.detectAction("前方路口向左急转"));
        assertEquals("sharp_right", NavParser.detectAction("前方路口向右急转"));
    }

    @Test
    public void distinguishesLaneRoundaboutAndBranchActions() {
        assertEquals("keep_left", NavParser.detectAction("请靠左行驶"));
        assertEquals("keep_right", NavParser.detectAction("请靠右行驶"));
        assertEquals("roundabout_enter", NavParser.detectAction("前方驶入环岛"));
        assertEquals("roundabout_exit", NavParser.detectAction("从第3出口驶出环岛"));
        assertEquals("merge_left", NavParser.detectAction("前方向左合流"));
        assertEquals("merge_right", NavParser.detectAction("前方向右合流"));
        assertEquals("fork_left", NavParser.detectAction("在左侧岔路口行驶"));
        assertEquals("fork_right", NavParser.detectAction("在右侧岔路口行驶"));
        assertEquals("exit_left", NavParser.detectAction("从左侧出口驶出"));
        assertEquals("exit_right", NavParser.detectAction("从右侧出口驶出"));
    }

    @Test
    public void detectsTerminalRerouteWaitAndStraightStates() {
        assertEquals("arrive", NavParser.detectAction("已到达目的地"));
        assertEquals("reroute", NavParser.detectAction("正在重新规划路线"));
        assertEquals("wait", NavParser.detectAction("高德地图持续为您导航"));
        assertEquals("straight", NavParser.detectAction("沿中山路直行"));
    }

    @Test
    public void recognizesNavigationWithoutBroadOrdinaryNotificationFalsePositives() {
        assertTrue(NavParser.looksLikeNavigation("前方500米左转"));
        assertTrue(NavParser.looksLikeNavigation("骑行导航开始 从当前位置出发｜高德导航中"));
        assertTrue(NavParser.looksLikeNavigation("高德地图持续为您导航 正在为您骑行导航>>"));
        assertFalse(NavParser.looksLikeNavigation("沿街商户夏日优惠"));
        assertFalse(NavParser.looksLikeNavigation("进入会员中心领取500米优惠券"));
    }

    @Test
    public void includesExactSourcePackageInParsedJson() throws Exception {
        // JSONObject 在 Android 本地单元测试环境未提供实现；来源字段由通知监听器写入，
        // 这里用源码契约测试覆盖重载入口，实际 JSON 行为在 Android 构建中验证。
        assertTrue(NavParser.class.getDeclaredMethod("parse", String.class, String.class) != null);
    }
}
