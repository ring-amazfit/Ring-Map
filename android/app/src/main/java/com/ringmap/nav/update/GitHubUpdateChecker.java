package com.ringmap.nav.update;

import android.os.Build;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** 查询 GitHub Releases，不采集设备信息，也不会在后台自动下载 APK。 */
public final class GitHubUpdateChecker {
    public static final String RELEASES_URL = "https://api.github.com/repos/ring-amazfit/Ring-Map/releases/latest";

    private GitHubUpdateChecker() {}

    public static GitHubRelease fetchLatest() throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(RELEASES_URL).openConnection();
        connection.setRequestMethod("GET");
        connection.setConnectTimeout(8000);
        connection.setReadTimeout(10000);
        connection.setRequestProperty("Accept", "application/vnd.github+json");
        connection.setRequestProperty("User-Agent", "RingMap-Android/" + Build.VERSION.RELEASE);

        int code = connection.getResponseCode();
        if (code == HttpURLConnection.HTTP_NOT_FOUND) throw new NoReleaseException();
        if (code < 200 || code >= 300) throw new IllegalStateException("GitHub 返回 HTTP " + code);
        try (InputStream input = connection.getInputStream()) {
            return parse(readAll(input));
        } finally {
            connection.disconnect();
        }
    }

    public static GitHubRelease parse(String json) {
        String tag = field(json, "tag_name");
        String url = field(json, "html_url");
        if (tag == null || url == null) throw new IllegalArgumentException("GitHub 返回的数据不完整");
        return new GitHubRelease(tag, valueOr(field(json, "name"), tag),
                valueOr(field(json, "body"), "未提供更新说明。"), url, firstApkUrl(json));
    }

    public static boolean isNewer(String currentVersion, String releaseTag) {
        int[] current = versionParts(currentVersion);
        int[] release = versionParts(releaseTag);
        for (int index = 0; index < Math.max(current.length, release.length); index++) {
            int currentPart = index < current.length ? current[index] : 0;
            int releasePart = index < release.length ? release[index] : 0;
            if (releasePart != currentPart) return releasePart > currentPart;
        }
        return false;
    }

    private static String firstApkUrl(String json) {
        Matcher matcher = Pattern.compile("\\\"browser_download_url\\\"\\s*:\\s*\\\"((?:\\\\.|[^\\\"])*)\\\"").matcher(json);
        while (matcher.find()) {
            String url = decode(matcher.group(1));
            if (url.toLowerCase().endsWith(".apk")) return url;
        }
        return null;
    }

    private static String field(String json, String key) {
        Pattern pattern = Pattern.compile("\\\"" + Pattern.quote(key) + "\\\"\\s*:\\s*\\\"((?:\\\\.|[^\\\"])*)\\\"");
        Matcher matcher = pattern.matcher(json);
        return matcher.find() ? decode(matcher.group(1)) : null;
    }

    private static int[] versionParts(String value) {
        String[] raw = (value == null ? "" : value.trim().replaceFirst("^[vV]", ""))
                .split("[^0-9]+");
        int[] parts = new int[raw.length];
        for (int index = 0; index < raw.length; index++) {
            try { parts[index] = raw[index].isEmpty() ? 0 : Integer.parseInt(raw[index]); }
            catch (NumberFormatException ignored) { parts[index] = 0; }
        }
        return parts;
    }

    private static String valueOr(String value, String fallback) {
        return value == null || value.trim().isEmpty() ? fallback : value;
    }

    private static String decode(String value) {
        return value.replace("\\n", "\n").replace("\\r", "\r")
                .replace("\\\"", "\"").replace("\\\\", "\\");
    }

    private static String readAll(InputStream input) throws Exception {
        StringBuilder result = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(input, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) result.append(line).append('\n');
        }
        return result.toString();
    }

    public static final class NoReleaseException extends Exception {}
}
