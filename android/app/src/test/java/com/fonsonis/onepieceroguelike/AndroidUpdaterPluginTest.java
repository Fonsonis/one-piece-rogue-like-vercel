package com.fonsonis.onepieceroguelike;

import static org.junit.Assert.assertEquals;

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
}
