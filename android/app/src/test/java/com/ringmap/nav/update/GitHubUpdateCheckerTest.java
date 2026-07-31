package com.ringmap.nav.update;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public final class GitHubUpdateCheckerTest {

    @Test
    public void parsesLatestReleaseAndFindsApkAsset() {
        GitHubRelease release = GitHubUpdateChecker.parse("{"
                + "\"tag_name\":\"v2.7.0\","
                + "\"name\":\"RingMap 2.7.0\","
                + "\"body\":\"修复后台连接\","
                + "\"html_url\":\"https://github.com/ring-amazfit/Ring-Map/releases/tag/v2.7.0\","
                + "\"assets\":[{\"browser_download_url\":\"https://example.com/RingMap-v2.7.0.apk\"}]"
                + "}");

        assertEquals("v2.7.0", release.tagName);
        assertEquals("RingMap 2.7.0", release.name);
        assertEquals("https://example.com/RingMap-v2.7.0.apk", release.apkUrl);
    }

    @Test
    public void comparesNumericVersionParts() {
        assertTrue(GitHubUpdateChecker.isNewer("2.9.0", "v2.10.0"));
        assertTrue(GitHubUpdateChecker.isNewer("2.6.1", "v2.7.0"));
        assertFalse(GitHubUpdateChecker.isNewer("2.7.0", "v2.7.0"));
        assertFalse(GitHubUpdateChecker.isNewer("2.8.0", "v2.7.9"));
    }
}
