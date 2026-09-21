package com.fonsonis.onepieceroguelike;

import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;

@CapacitorPlugin(name = "AndroidUpdater")
public class AndroidUpdaterPlugin extends Plugin {
    private static final String PREFS = "android_updater";
    private static final String KEY_DOWNLOAD_ID = "download_id";
    private static final String KEY_VERSION_CODE = "version_code";
    private static final String KEY_FILE_NAME = "file_name";
    private static final String KEY_PENDING_INSTALL = "pending_install";
    private static final long NO_DOWNLOAD = -1L;

    private DownloadManager downloads() {
        return (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
    }

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private boolean validReleaseUrl(String value) {
        if (value == null) return false;
        Uri uri = Uri.parse(value);
        return "https".equalsIgnoreCase(uri.getScheme())
            && "github.com".equalsIgnoreCase(uri.getHost())
            && uri.getPath() != null
            && uri.getPath().startsWith("/Fonsonis/one-piece-rogue-like-vercel/releases/");
    }

    private File updateFile(String fileName) {
        File directory = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        return directory == null ? null : new File(directory, fileName);
    }

    private void clearStoredDownload(boolean removeFromManager) {
        long id = prefs().getLong(KEY_DOWNLOAD_ID, NO_DOWNLOAD);
        if (removeFromManager && id != NO_DOWNLOAD) downloads().remove(id);
        String fileName = prefs().getString(KEY_FILE_NAME, null);
        File file = fileName == null ? null : updateFile(fileName);
        if (file != null && file.exists()) file.delete();
        prefs().edit().clear().apply();
    }

    private JSObject idleStatus() {
        return new JSObject().put("state", "idle");
    }

    private JSObject currentStatus() {
        long id = prefs().getLong(KEY_DOWNLOAD_ID, NO_DOWNLOAD);
        if (id == NO_DOWNLOAD) return idleStatus();

        DownloadManager.Query query = new DownloadManager.Query().setFilterById(id);
        try (Cursor cursor = downloads().query(query)) {
            if (cursor == null || !cursor.moveToFirst()) {
                clearStoredDownload(false);
                return idleStatus();
            }

            int rawStatus = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
            long downloaded = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR));
            long total = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES));
            int reason = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON));
            String state;
            switch (rawStatus) {
                case DownloadManager.STATUS_PENDING:
                    state = "pending";
                    break;
                case DownloadManager.STATUS_RUNNING:
                    state = "running";
                    break;
                case DownloadManager.STATUS_PAUSED:
                    state = "paused";
                    break;
                case DownloadManager.STATUS_SUCCESSFUL:
                    state = downloads().getUriForDownloadedFile(id) == null ? "failed" : "successful";
                    break;
                default:
                    state = "failed";
                    break;
            }

            return new JSObject()
                .put("state", state)
                .put("downloadId", id)
                .put("versionCode", prefs().getLong(KEY_VERSION_CODE, 0L))
                .put("bytesDownloaded", Math.max(0L, downloaded))
                .put("totalBytes", Math.max(0L, total))
                .put("reason", reason);
        } catch (Exception error) {
            return new JSObject().put("state", "failed").put("reason", error.getMessage());
        }
    }

    @PluginMethod
    public void startDownload(PluginCall call) {
        String url = call.getString("url");
        Integer versionCode = readVersionCode(call);
        if (!validReleaseUrl(url)) {
            call.reject("La URL de actualización no pertenece al repositorio oficial.");
            return;
        }
        if (versionCode == null || versionCode <= 0L) {
            call.reject("La actualización no incluye un versionCode válido.");
            return;
        }

        JSObject existing = currentStatus();
        long storedVersion = prefs().getLong(KEY_VERSION_CODE, 0L);
        String existingState = existing.optString("state", "idle");
        if (storedVersion == versionCode && !"idle".equals(existingState) && !"failed".equals(existingState)) {
            call.resolve(existing);
            return;
        }
        if (!"idle".equals(existingState)) clearStoredDownload(true);

        String fileName = "one-piece-rogue-like-update-" + versionCode + ".apk";
        File oldFile = updateFile(fileName);
        if (oldFile != null && oldFile.exists()) oldFile.delete();

        try {
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url))
                .setTitle("One Piece Rogue Like")
                .setDescription("Descargando actualización " + versionCode)
                .setMimeType("application/vnd.android.package-archive")
                .setAllowedOverMetered(true)
                .setAllowedOverRoaming(false)
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                .setDestinationInExternalFilesDir(getContext(), Environment.DIRECTORY_DOWNLOADS, fileName);
            long id = downloads().enqueue(request);
            prefs().edit()
                .putLong(KEY_DOWNLOAD_ID, id)
                .putLong(KEY_VERSION_CODE, versionCode)
                .putString(KEY_FILE_NAME, fileName)
                .putBoolean(KEY_PENDING_INSTALL, false)
                .apply();
            call.resolve(currentStatus());
        } catch (Exception error) {
            clearStoredDownload(false);
            call.reject("Android no pudo iniciar la descarga.", error);
        }
    }

    static Integer readVersionCode(PluginCall call) {
        // Android version codes fit in a signed int. The JSON bridge decodes
        // these numbers as Integer; PluginCall.getLong only accepts Long and
        // silently returns its default for Integer values.
        return call.getInt("versionCode", 0);
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        call.resolve(currentStatus());
    }

    @PluginMethod
    public void install(PluginCall call) {
        JSObject status = currentStatus();
        if (!"successful".equals(status.optString("state"))) {
            call.reject("La descarga todavía no está completa.");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !getContext().getPackageManager().canRequestPackageInstalls()) {
            prefs().edit().putBoolean(KEY_PENDING_INSTALL, true).apply();
            Intent permission = new Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + getContext().getPackageName())
            );
            getActivity().startActivity(permission);
            call.resolve(new JSObject().put("state", "permissionRequired"));
            return;
        }

        if (openInstaller()) call.resolve(new JSObject().put("state", "installing"));
        else call.reject("Android no pudo abrir el instalador del APK.");
    }

    private boolean openInstaller() {
        long id = prefs().getLong(KEY_DOWNLOAD_ID, NO_DOWNLOAD);
        Uri apk = id == NO_DOWNLOAD ? null : downloads().getUriForDownloadedFile(id);
        if (apk == null) return false;
        Intent install = new Intent(Intent.ACTION_VIEW)
            .setDataAndType(apk, "application/vnd.android.package-archive")
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        try {
            prefs().edit().putBoolean(KEY_PENDING_INSTALL, false).apply();
            getActivity().startActivity(install);
            return true;
        } catch (Exception error) {
            return false;
        }
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        if (!prefs().getBoolean(KEY_PENDING_INSTALL, false)) return;
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || getContext().getPackageManager().canRequestPackageInstalls()) {
            openInstaller();
        }
    }
}
