package com.ringmap.nav;

import org.junit.Test;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

/** 地图导航通知来源白名单的回归测试。 */
public class NavigationPackageTest {

    @Test
    public void acceptsSupportedMapPackages() {
        assertTrue(NavNotificationListener.isSupportedNavigationPackage("com.autonavi.minimap"));
        assertTrue(NavNotificationListener.isSupportedNavigationPackage("com.baidu.BaiduMap"));
    }

    @Test
    public void rejectsLookalikePackages() {
        assertFalse(NavNotificationListener.isSupportedNavigationPackage("com.baidu.fake"));
        assertFalse(NavNotificationListener.isSupportedNavigationPackage("com.example.amap.fake"));
        assertFalse(NavNotificationListener.isSupportedNavigationPackage(null));
    }
}
