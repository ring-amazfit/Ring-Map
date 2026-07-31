package com.ringmap.nav.update;

/** GitHub latest-release 响应中 RingMap 更新页实际需要的字段。 */
public final class GitHubRelease {
    public final String tagName;
    public final String name;
    public final String body;
    public final String htmlUrl;
    public final String apkUrl;

    GitHubRelease(String tagName, String name, String body, String htmlUrl, String apkUrl) {
        this.tagName = tagName;
        this.name = name;
        this.body = body;
        this.htmlUrl = htmlUrl;
        this.apkUrl = apkUrl;
    }
}
