package com.umbral.mareas;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import org.junit.Test;

public class AndroidUpdaterPluginTest {
    private PluginCall call(String json) throws Exception {
        return new PluginCall(null, "AndroidUpdater", "test", "startDownload", new JSObject(json));
    }

    @Test
    public void acceptsVersionCodesDecodedByTheRealCapacitorBridge() throws Exception {
        for (int version : new int[] {10200, 102000002, 1790030325, 2100000000}) {
            PluginCall request = call("{\"versionCode\":" + version + "}");
            // Reproduce the old failure: getLong rejects JSON Integer values.
            assertEquals(Long.valueOf(0), request.getLong("versionCode", 0L));
            assertEquals(Integer.valueOf(version), AndroidUpdaterPlugin.readVersionCode(request));
        }
    }

    @Test
    public void malformedCodesRemainInvalid() throws Exception {
        for (String json : new String[] {"{}", "{\"versionCode\":null}",
                "{\"versionCode\":\"1790030325\"}", "{\"versionCode\":1.5}",
                "{\"versionCode\":2147483648}"}) {
            assertEquals(Integer.valueOf(0), AndroidUpdaterPlugin.readVersionCode(call(json)));
        }
    }

    @Test
    public void acceptsConfiguredGithubReleaseRepositories() {
        assertTrue(AndroidUpdaterPlugin.validReleaseUrl(
            "https://github.com/example/game/releases/download/android-10201/mareas-del-umbral.apk", 10201));
        assertTrue(AndroidUpdaterPlugin.validReleaseUrl(
            "https://github.com/another-owner/another-repo/releases/latest/download/mareas-del-umbral.apk", 10201));
    }

    @Test
    public void rejectsUntrustedOrMismatchedReleaseUrls() {
        for (String url : new String[] {
                "http://github.com/example/game/releases/download/android-10201/mareas-del-umbral.apk",
                "https://example.com/example/game/releases/download/android-10201/mareas-del-umbral.apk",
                "https://github.com/example/game/releases/download/android-10200/mareas-del-umbral.apk",
                "https://github.com/example/game/releases/download/android-10201/other.apk",
                "https://github.com/example/game/releases/download/android-10201/mareas-del-umbral.apk?token=1",
                "https://user@github.com/example/game/releases/download/android-10201/mareas-del-umbral.apk",
                "https://github.com:443/example/game/releases/download/android-10201/mareas-del-umbral.apk",
                "https://github.com/example/game/releases/download/android-10201/mareas-del-umbral.apk#fragment",
                "https://github.com/example/game/releases/download/android-10201/%6dareas-del-umbral.apk",
                "https://github.com/example/game/releases/download/android-10201/mareas del umbral.apk",
                "https://[invalid"
        }) assertFalse(url, AndroidUpdaterPlugin.validReleaseUrl(url, 10201));
    }
}
