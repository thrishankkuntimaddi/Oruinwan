package com.oruinwan.app;

import android.os.Handler;
import android.os.Looper;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Over-the-air UI updates: a newer build of the app's UI (a zip published with each release)
 * replaces the one inside the APK without reinstalling.
 *
 * The page checks the bundle's Ed25519 signature against the key compiled into the app
 * (src/update/updater.js) and passes the signed SHA-256 here; this plugin downloads the zip,
 * refuses it unless the SHA-256 matches, unpacks it into app storage and points Capacitor at it
 * (setServerBasePath, persisted so the next start loads it too). The new UI must call confirm()
 * within WATCHDOG_MS of loading, or the app goes back to the last good UI (OtaBundleStore).
 */
@CapacitorPlugin(name = "OtaBundle")
public class OtaBundlePlugin extends Plugin {
    private static final long WATCHDOG_MS = 45_000;
    private static final long MAX_ZIP_BYTES = 150L * 1024 * 1024;
    private static final long MAX_UNPACKED_BYTES = 400L * 1024 * 1024;
    private static final int MAX_ENTRIES = 20_000;

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());
    private volatile boolean busy = false;
    private final Runnable watchdog = this::watchdogFired;

    @Override
    public void load() {
        // A bundle that is still unconfirmed at this start gets the same in-session watchdog.
        if (OtaBundleStore.isPending(getContext())) main.postDelayed(watchdog, WATCHDOG_MS);
    }

    @PluginMethod
    public void info(PluginCall call) {
        JSObject ret = new JSObject();
        String base = getBridge().getServerBasePath();
        boolean downloaded = base != null && base.startsWith(OtaBundleStore.root(getContext()).getAbsolutePath());
        ret.put("shellVersion", OtaBundleStore.shellVersion(getContext()));
        ret.put("source", downloaded ? "downloaded" : "bundled");
        ret.put("activeVersion", OtaBundleStore.activeVersion(getContext()));
        ret.put("pendingVersion", OtaBundleStore.pendingVersion(getContext()));
        call.resolve(ret);
    }

    @PluginMethod
    public void download(PluginCall call) {
        final String url = call.getString("url");
        final String sha256 = call.getString("sha256", "");
        final String version = call.getString("version", "");
        if (url == null || !url.startsWith("https://")) {
            call.reject("The update address is not valid.", "BAD_URL");
            return;
        }
        if (sha256 == null || !sha256.matches("[0-9a-fA-F]{64}") || !version.matches("[0-9A-Za-z.+-]{1,40}")) {
            call.reject("The update is missing its checksum.", "INVALID");
            return;
        }
        if (OtaBundleStore.isBad(getContext(), version)) {
            call.reject("This update didn't start on this device before, so it won't be installed again.", "BAD_VERSION");
            return;
        }
        if (busy) {
            call.reject("An update is already downloading.", "BUSY");
            return;
        }
        busy = true;
        executor.execute(() -> {
            File zip = null;
            File dir = null;
            try {
                File root = OtaBundleStore.root(getContext());
                if (!root.exists() && !root.mkdirs()) throw new OtaException("No space for the update.", "STORAGE");
                zip = new File(getContext().getCacheDir(), "ui-bundle-" + UUID.randomUUID() + ".zip");
                download(url, zip, sha256);
                dir = new File(root, version + "-" + UUID.randomUUID().toString().substring(0, 8));
                notifyProgress("unpacking", 100);
                unzip(zip, dir);
                if (!new File(dir, "index.html").isFile()) throw new OtaException("The update is incomplete.", "INVALID");
                JSObject ret = new JSObject();
                ret.put("path", dir.getAbsolutePath());
                call.resolve(ret);
            } catch (OtaException e) {
                if (dir != null) OtaBundleStore.deleteRecursive(dir);
                call.reject(e.getMessage(), e.code);
            } catch (Exception e) {
                if (dir != null) OtaBundleStore.deleteRecursive(dir);
                call.reject("The update could not be downloaded. Check your connection and try again.", "DOWNLOAD", e);
            } finally {
                if (zip != null) //noinspection ResultOfMethodCallIgnored
                    zip.delete();
                busy = false;
            }
        });
    }

    /** Switches to a downloaded bundle now (the page reloads) and on every later start. */
    @PluginMethod
    public void apply(PluginCall call) {
        String path = call.getString("path", "");
        String version = call.getString("version", "");
        File dir = new File(path);
        String root = OtaBundleStore.root(getContext()).getAbsolutePath() + File.separator;
        try {
            if (!dir.getCanonicalPath().startsWith(root) || !new File(dir, "index.html").isFile()) {
                call.reject("That update isn't ready.", "INVALID");
                return;
            }
        } catch (Exception e) {
            call.reject("That update isn't ready.", "INVALID");
            return;
        }
        OtaBundleStore.markPending(getContext(), dir.getAbsolutePath(), version);
        call.resolve();
        main.removeCallbacks(watchdog);
        main.postDelayed(watchdog, WATCHDOG_MS);
        main.post(() -> getBridge().setServerBasePath(dir.getAbsolutePath()));
    }

    /** The running UI started: keep it. */
    @PluginMethod
    public void confirm(PluginCall call) {
        main.removeCallbacks(watchdog);
        JSObject ret = new JSObject();
        ret.put("confirmed", OtaBundleStore.confirm(getContext()));
        call.resolve(ret);
    }

    /** Back to the UI inside the APK. */
    @PluginMethod
    public void reset(PluginCall call) {
        main.removeCallbacks(watchdog);
        OtaBundleStore.reset(getContext());
        call.resolve();
        main.post(() -> getBridge().setServerAssetPath("public"));
    }

    private void watchdogFired() {
        if (!OtaBundleStore.isPending(getContext())) return;
        String path = OtaBundleStore.rollback(getContext());
        if (path.isEmpty()) getBridge().setServerAssetPath("public");
        else getBridge().setServerBasePath(path);
    }

    private void download(String address, File target, String expectedSha) throws Exception {
        HttpURLConnection conn = null;
        String current = address;
        boolean reached = false;
        for (int hop = 0; hop < 6 && !reached; hop++) {
            conn = (HttpURLConnection) new URL(current).openConnection();
            conn.setInstanceFollowRedirects(false);
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(30000);
            int code = conn.getResponseCode();
            if (code >= 300 && code < 400) {
                String next = conn.getHeaderField("Location");
                conn.disconnect();
                if (next == null) throw new OtaException("The download address redirected nowhere.", "DOWNLOAD");
                String resolved = new URL(new URL(current), next).toString();
                if (!resolved.startsWith("https://")) throw new OtaException("The download tried to leave https, so it was stopped.", "DOWNLOAD");
                current = resolved;
                continue;
            }
            if (code != 200) {
                conn.disconnect();
                throw new OtaException("The update server answered " + code + ".", "DOWNLOAD");
            }
            reached = true;
        }
        if (!reached) throw new OtaException("The download address redirected too many times.", "DOWNLOAD");
        long total = conn.getContentLengthLong();
        if (total > MAX_ZIP_BYTES) throw new OtaException("The update is too large.", "INVALID");
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        long received = 0;
        int lastPercent = -1;
        try (InputStream in = conn.getInputStream(); FileOutputStream out = new FileOutputStream(target)) {
            byte[] buffer = new byte[64 * 1024];
            int read;
            while ((read = in.read(buffer)) != -1) {
                received += read;
                if (received > MAX_ZIP_BYTES) throw new OtaException("The update is too large.", "INVALID");
                out.write(buffer, 0, read);
                digest.update(buffer, 0, read);
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
        StringBuilder hex = new StringBuilder();
        for (byte b : digest.digest()) hex.append(String.format("%02x", b));
        if (!hex.toString().equalsIgnoreCase(expectedSha)) {
            throw new OtaException("The download didn't match the signed checksum, so it was not installed.", "CHECKSUM");
        }
    }

    private static void unzip(File zip, File dir) throws Exception {
        if (!dir.mkdirs()) throw new OtaException("No space for the update.", "STORAGE");
        String base = dir.getCanonicalPath() + File.separator;
        long written = 0;
        int entries = 0;
        try (ZipInputStream in = new ZipInputStream(new BufferedInputStream(new FileInputStream(zip)))) {
            ZipEntry entry;
            byte[] buffer = new byte[64 * 1024];
            while ((entry = in.getNextEntry()) != null) {
                if (++entries > MAX_ENTRIES) throw new OtaException("The update has too many files.", "INVALID");
                File out = new File(dir, entry.getName());
                if (!out.getCanonicalPath().startsWith(base)) throw new OtaException("The update has an unsafe file name.", "INVALID");
                if (entry.isDirectory()) {
                    //noinspection ResultOfMethodCallIgnored
                    out.mkdirs();
                    continue;
                }
                File parent = out.getParentFile();
                if (parent != null && !parent.exists() && !parent.mkdirs()) throw new OtaException("No space for the update.", "STORAGE");
                try (FileOutputStream fos = new FileOutputStream(out)) {
                    int read;
                    while ((read = in.read(buffer)) != -1) {
                        written += read;
                        if (written > MAX_UNPACKED_BYTES) throw new OtaException("The update is too large.", "INVALID");
                        fos.write(buffer, 0, read);
                    }
                }
            }
        }
    }

    private void notifyProgress(String state, int percent) {
        JSObject data = new JSObject();
        data.put("state", state);
        data.put("percent", percent);
        notifyListeners("progress", data);
    }

    private static class OtaException extends Exception {
        final String code;

        OtaException(String message, String code) {
            super(message);
            this.code = code;
        }
    }
}
