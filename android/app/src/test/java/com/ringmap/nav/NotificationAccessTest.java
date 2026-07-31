package com.ringmap.nav;

import org.junit.Test;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

/** 系统通知使用权组件格式兼容性回归测试。 */
public class NotificationAccessTest {

    @Test
    public void recognizesShortClassComponentFormat() {
        assertTrue(NotificationAccess.isEnabled(
                "com.other/.Other:com.ringmap.nav/.NavNotificationListener",
                "com.ringmap.nav",
                "com.ringmap.nav.NavNotificationListener"));
    }

    @Test
    public void recognizesFullClassComponentFormat() {
        assertTrue(NotificationAccess.isEnabled(
                "com.ringmap.nav/com.ringmap.nav.NavNotificationListener",
                "com.ringmap.nav",
                "com.ringmap.nav.NavNotificationListener"));
    }

    @Test
    public void rejectsAnotherListener() {
        assertFalse(NotificationAccess.isEnabled(
                "com.other/.OtherListener",
                "com.ringmap.nav",
                "com.ringmap.nav.NavNotificationListener"));
    }

    @Test
    public void officialApiResultOverridesAStaleSecureSetting() {
        assertFalse(NotificationAccess.resolveGrantedState(
                true,
                false,
                "com.ringmap.nav/.NavNotificationListener",
                "com.ringmap.nav",
                "com.ringmap.nav.NavNotificationListener"));
        assertTrue(NotificationAccess.resolveGrantedState(
                true,
                true,
                null,
                "com.ringmap.nav",
                "com.ringmap.nav.NavNotificationListener"));
    }

    @Test
    public void legacyDevicesStillUseTheSecureSetting() {
        assertTrue(NotificationAccess.resolveGrantedState(
                false,
                false,
                "com.ringmap.nav/.NavNotificationListener",
                "com.ringmap.nav",
                "com.ringmap.nav.NavNotificationListener"));
    }
}
