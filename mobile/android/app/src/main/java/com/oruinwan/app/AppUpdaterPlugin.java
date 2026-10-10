package com.oruinwan.app;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * In-app updates for sideloaded builds.
 *
 * Downloads the release APK into app-private storage, checks it (SHA-256 from the release
 * manifest, package name, newer version, same signing certificate) and only then hands it
 * to Android's package installer, which asks the user to confirm.
 */
@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private volatile boolean busy = false;

    @PluginMethod
    public void canInstallPackages(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", canInstall());
        call.resolve(ret);
    }

    @PluginMethod
    public void openInstallPermissionSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent intent = new Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + getContext().getPackageName())
            );
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        final String url = call.getString("url");
        final String version = call.getString("version", "update");
        final String expectedSha = call.getString("sha256", "");
        if (url == null || !(url.startsWith("https://") || url.startsWith("http://"))) {
            call.reject("The update address is not valid.", "BAD_URL");
            return;
        }
        if (busy) {
            call.reject("An update is already downloading.", "BUSY");
            return;
        }
        busy = true;
        executor.execute(() -> {
            try {
                File apk = download(url, version.replaceAll("[^0-9A-Za-z._-]", ""), expectedSha);
                notifyProgress("verifying", 100);
                verifyArchive(apk);
                notifyProgress("installing", 100);
                launchInstaller(apk);
                call.resolve();
            } catch (UpdateException e) {
                call.reject(e.getMessage(), e.code);
            } catch (Exception e) {
                call.reject("The update could not be downloaded. Check your connection and try again.", "DOWNLOAD", e);
            } finally {
                busy = false;
            }
        });
    }

    private boolean canInstall() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            return getContext().getPackageManager().canRequestPackageInstalls();
        }
        return true;
    }

    private File updatesDir() {
        File dir = new File(getContext().getCacheDir(), "updates");
        if (!dir.exists() && !dir.mkdirs()) {
            throw new IllegalStateException("Cannot create updates directory");
        }
        return dir;
    }

    private File download(String address, String version, String expectedSha) throws Exception {
        File dir = updatesDir();
        File[] old = dir.listFiles();
        if (old != null) {
            for (File f : old) {
                //noinspection ResultOfMethodCallIgnored
                f.delete();
            }
        }
        File target = new File(dir, "Oruinwan-" + version + ".apk");

        HttpURLConnection conn = null;
        String current = address;
        // Follow redirects manually so https → https hops on other hosts (release CDNs) work.
        for (int hop = 0; hop < 6; hop++) {
            conn = (HttpURLConnection) new URL(current).openConnection();
            conn.setInstanceFollowRedirects(false);
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(30000);
            conn.setRequestProperty("Accept", "application/vnd.android.package-archive, application/octet-stream, */*");
            int code = conn.getResponseCode();
            if (code >= 300 && code < 400) {
                String next = conn.getHeaderField("Location");
                conn.disconnect();
                if (next == null) throw new UpdateException("The download address redirected nowhere.", "DOWNLOAD");
                current = new URL(new URL(current), next).toString();
                continue;
            }
            if (code != 200) {
                conn.disconnect();
                throw new UpdateException("The update server answered " + code + ".", "DOWNLOAD");
            }
            break;
        }
        if (conn == null) throw new UpdateException("Too many redirects.", "DOWNLOAD");

        long total = conn.getContentLengthLong();
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        long received = 0;
        int lastPercent = -1;
        try (InputStream in = conn.getInputStream(); FileOutputStream out = new FileOutputStream(target)) {
            byte[] buffer = new byte[64 * 1024];
            int read;
            while ((read = in.read(buffer)) != -1) {
                out.write(buffer, 0, read);
                digest.update(buffer, 0, read);
                received += read;
                if (total > 0) {
                    int percent = (int) (received * 100 / total);
                    if (percent != lastPercent) {
                        lastPercent = percent;
                        notifyProgress("downloading", percent);
                    }
                }
            }
        } finally {
            conn.disconnect();
        }
        if (total > 0 && received != total) {
            throw new UpdateException("The download was cut short. Try again.", "DOWNLOAD");
        }
        if (expectedSha != null && !expectedSha.isEmpty()) {
            String actual = toHex(digest.digest());
            if (!actual.equalsIgnoreCase(expectedSha)) {
                //noinspection ResultOfMethodCallIgnored
                target.delete();
                throw new UpdateException("The download did not match the published checksum.", "CHECKSUM");
            }
        }
        return target;
    }

    @SuppressWarnings("deprecation")
    private void verifyArchive(File apk) throws Exception {
        PackageManager pm = getContext().getPackageManager();
        String self = getContext().getPackageName();
        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;

        PackageInfo archive = pm.getPackageArchiveInfo(apk.getAbsolutePath(), flags);
        if (archive == null) throw new UpdateException("The download is not a valid Android app.", "INVALID");
        if (!self.equals(archive.packageName)) {
            throw new UpdateException("The download is a different app, so it was not installed.", "INVALID");
        }
        PackageInfo installed = pm.getPackageInfo(self, flags);
        long installedCode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? installed.getLongVersionCode() : installed.versionCode;
        long archiveCode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? archive.getLongVersionCode() : archive.versionCode;
        if (archiveCode <= installedCode) {
            throw new UpdateException("This version is already installed.", "NOT_NEWER");
        }
        if (!signaturesOf(installed).equals(signaturesOf(archive))) {
            throw new UpdateException("The update is not signed with Oruinwan's release key, so it was not installed.", "SIGNATURE");
        }
    }

    @SuppressWarnings("deprecation")
    private Set<String> signaturesOf(PackageInfo info) throws Exception {
        Signature[] sigs;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            sigs = info.signingInfo == null ? null : info.signingInfo.getApkContentsSigners();
        } else {
            sigs = info.signatures;
        }
        Set<String> out = new HashSet<>();
        if (sigs == null) return out;
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        for (Signature s : sigs) {
            out.add(toHex(md.digest(s.toByteArray())));
        }
        return out;
    }

    private void launchInstaller(File apk) {
        Context ctx = getContext();
        Uri uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", apk);
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(uri, "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        ctx.startActivity(intent);
    }

    private void notifyProgress(String state, int percent) {
        JSObject data = new JSObject();
        data.put("state", state);
        data.put("percent", percent);
        notifyListeners("progress", data);
    }

    private static String toHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) sb.append(String.format("%02x", b));
        return sb.toString();
    }

    private static class UpdateException extends Exception {
        final String code;

        UpdateException(String message, String code) {
            super(message);
            this.code = code;
        }
    }
}
