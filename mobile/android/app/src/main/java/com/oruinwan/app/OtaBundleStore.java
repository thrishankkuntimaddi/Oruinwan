package com.oruinwan.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;

import java.io.File;
import java.util.HashSet;
import java.util.Set;

/**
 * State of over-the-air UI bundles (see OtaBundlePlugin), and the boot guard that runs before
 * Capacitor's bridge starts.
 *
 * Capacitor loads the UI from the folder saved under CapWebViewSettings/serverBasePath when it
 * is set (and resets it itself after an APK update). A newly applied bundle is "pending" until
 * the page confirms it started. A pending bundle that has gone through two starts without
 * confirming is rolled back to the last good one (or the UI inside the APK) before the WebView
 * loads, and its version is never applied again.
 */
final class OtaBundleStore {
    static final String PREFS = "OruinwanOta";
    static final String CAP_PREFS = "CapWebViewSettings";
    static final String CAP_SERVER_PATH = "serverBasePath";

    private static final String SHELL = "shellVersion";
    private static final String ACTIVE_PATH = "activePath";
    private static final String ACTIVE_VERSION = "activeVersion";
    private static final String PENDING_PATH = "pendingPath";
    private static final String PENDING_VERSION = "pendingVersion";
    private static final String PENDING_BOOTS = "pendingBoots";
    private static final String BAD = "badVersions";

    private OtaBundleStore() {}

    static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static File root(Context ctx) {
        return new File(ctx.getFilesDir(), "ui-bundles");
    }

    static String shellVersion(Context ctx) {
        try {
            PackageInfo info = ctx.getPackageManager().getPackageInfo(ctx.getPackageName(), 0);
            return info.versionName != null ? info.versionName : "";
        } catch (Exception e) {
            return "";
        }
    }

    /** Called from MainActivity.onCreate before super.onCreate (before the WebView loads). */
    static void beforeBridge(Context ctx) {
        try {
            SharedPreferences p = prefs(ctx);
            String shell = shellVersion(ctx);
            if (!shell.equals(p.getString(SHELL, null))) {
                // A new APK carries its own, newer UI: forget downloaded bundles (Capacitor
                // also clears its saved path on a new binary).
                p.edit().clear().putString(SHELL, shell).apply();
                setCapacitorPath(ctx, "");
                deleteChildren(root(ctx), null);
                return;
            }
            String pending = p.getString(PENDING_PATH, null);
            if (pending == null) return;
            int boots = p.getInt(PENDING_BOOTS, 0);
            if (boots >= 2) {
                rollback(ctx);
            } else {
                p.edit().putInt(PENDING_BOOTS, boots + 1).apply();
            }
        } catch (Exception ignored) {
            // Never block the app from starting.
        }
    }

    /** Back to the last confirmed bundle, or the UI inside the APK. Returns the path now in use ("" = APK). */
    static String rollback(Context ctx) {
        SharedPreferences p = prefs(ctx);
        String bad = p.getString(PENDING_VERSION, null);
        String pendingPath = p.getString(PENDING_PATH, null);
        String active = p.getString(ACTIVE_PATH, "");
        if (active == null || !new File(active, "index.html").isFile()) active = "";
        Set<String> badSet = new HashSet<>(p.getStringSet(BAD, new HashSet<>()));
        if (bad != null) badSet.add(bad);
        SharedPreferences.Editor e = p.edit().putStringSet(BAD, badSet).remove(PENDING_PATH).remove(PENDING_VERSION).remove(PENDING_BOOTS);
        if (active.isEmpty()) e.remove(ACTIVE_PATH).remove(ACTIVE_VERSION);
        e.apply();
        setCapacitorPath(ctx, active);
        if (pendingPath != null && !pendingPath.equals(active)) deleteRecursive(new File(pendingPath));
        return active;
    }

    static void markPending(Context ctx, String path, String version) {
        prefs(ctx).edit().putString(PENDING_PATH, path).putString(PENDING_VERSION, version).putInt(PENDING_BOOTS, 1)
            .putString(SHELL, shellVersion(ctx)).apply();
        setCapacitorPath(ctx, path);
    }

    /** The running bundle started: it becomes the last good one, older bundles are removed. */
    static boolean confirm(Context ctx) {
        SharedPreferences p = prefs(ctx);
        String pending = p.getString(PENDING_PATH, null);
        if (pending == null) return false;
        String version = p.getString(PENDING_VERSION, "");
        p.edit().putString(ACTIVE_PATH, pending).putString(ACTIVE_VERSION, version)
            .remove(PENDING_PATH).remove(PENDING_VERSION).remove(PENDING_BOOTS).apply();
        deleteChildren(root(ctx), new File(pending));
        return true;
    }

    static void reset(Context ctx) {
        prefs(ctx).edit().remove(ACTIVE_PATH).remove(ACTIVE_VERSION).remove(PENDING_PATH).remove(PENDING_VERSION)
            .remove(PENDING_BOOTS).apply();
        setCapacitorPath(ctx, "");
        deleteChildren(root(ctx), null);
    }

    static boolean isPending(Context ctx) {
        return prefs(ctx).getString(PENDING_PATH, null) != null;
    }

    static String pendingVersion(Context ctx) {
        return prefs(ctx).getString(PENDING_VERSION, null);
    }

    static String activeVersion(Context ctx) {
        return prefs(ctx).getString(ACTIVE_VERSION, null);
    }

    static boolean isBad(Context ctx, String version) {
        return prefs(ctx).getStringSet(BAD, new HashSet<>()).contains(version);
    }

    static void setCapacitorPath(Context ctx, String path) {
        ctx.getSharedPreferences(CAP_PREFS, Context.MODE_PRIVATE).edit().putString(CAP_SERVER_PATH, path).apply();
    }

    static void deleteChildren(File dir, File keep) {
        File[] children = dir.listFiles();
        if (children == null) return;
        for (File child : children) {
            if (keep != null && child.getAbsolutePath().equals(keep.getAbsolutePath())) continue;
            deleteRecursive(child);
        }
    }

    static void deleteRecursive(File f) {
        File[] children = f.listFiles();
        if (children != null) for (File c : children) deleteRecursive(c);
        //noinspection ResultOfMethodCallIgnored
        f.delete();
    }
}
