package com.oruinwan.app;

import android.content.Context;
import android.os.Build;

import java.io.File;
import java.io.FileOutputStream;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

/**
 * Keeps the last native crash on the phone, so the app can say "Oruinwan closed unexpectedly"
 * next time and let the person copy the details for a bug report (CallSessionPlugin.lastCrash).
 * Android's own crash handling still runs afterwards.
 */
final class CrashLog {

    private static final String FILE = "last-crash.txt";
    private static boolean installed = false;

    private CrashLog() {}

    static synchronized void install(Context context) {
        if (installed) return;
        installed = true;
        final Context app = context.getApplicationContext();
        final Thread.UncaughtExceptionHandler previous = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, error) -> {
            try {
                StringWriter trace = new StringWriter();
                error.printStackTrace(new PrintWriter(trace));
                String text = "Oruinwan " + BuildConfig.VERSION_NAME + " (" + BuildConfig.VERSION_CODE + ")\n"
                    + "Android " + Build.VERSION.RELEASE + " (API " + Build.VERSION.SDK_INT + "), "
                    + Build.MANUFACTURER + " " + Build.MODEL + "\n"
                    + "Thread: " + thread.getName() + "\n"
                    + "Time: " + System.currentTimeMillis() + "\n\n"
                    + trace;
                try (FileOutputStream out = new FileOutputStream(new File(app.getFilesDir(), FILE))) {
                    out.write(text.getBytes(StandardCharsets.UTF_8));
                }
            } catch (Throwable ignored) {
                // never make a crash worse
            }
            if (previous != null) previous.uncaughtException(thread, error);
        });
    }

    /** The last crash's details, or null. */
    static String read(Context context) {
        try {
            File f = new File(context.getFilesDir(), FILE);
            if (!f.exists()) return null;
            return new String(Files.readAllBytes(f.toPath()), StandardCharsets.UTF_8);
        } catch (Exception e) {
            return null;
        }
    }

    static void clear(Context context) {
        try {
            new File(context.getFilesDir(), FILE).delete();
        } catch (Exception ignored) {
            // nothing to clear
        }
    }
}
