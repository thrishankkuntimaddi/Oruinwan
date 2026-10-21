package com.oruinwan.app;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

/**
 * Keeps a huddle alive while Oruinwan is in the background or the screen is locked. Android
 * stops a backgrounded app's microphone and camera unless a foreground service with an ongoing
 * notification is running, so the call shows "In call · # design" with Mute and Leave.
 * Started and stopped by CallSessionPlugin; the call itself runs in the WebView.
 */
public class CallService extends Service {

    static final String ACTION_START = "com.oruinwan.app.call.START";
    static final String ACTION_UPDATE = "com.oruinwan.app.call.UPDATE";
    static final String ACTION_MUTE = "com.oruinwan.app.call.MUTE";
    static final String ACTION_LEAVE = "com.oruinwan.app.call.LEAVE";

    static final String EXTRA_TITLE = "title";
    static final String EXTRA_MUTED = "muted";
    static final String EXTRA_VIDEO = "video";
    static final String EXTRA_STARTED_AT = "startedAt";

    private static final String CHANNEL_ID = "oruinwan_calls";
    private static final int NOTIFICATION_ID = 4711;
    private static final String TAG = "CallService";

    private static volatile boolean running = false;

    static boolean isRunning() {
        return running;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_MUTE.equals(action)) {
            CallSessionPlugin.dispatchAction("mute");
            return START_NOT_STICKY;
        }
        if (ACTION_LEAVE.equals(action)) {
            CallSessionPlugin.dispatchAction("leave");
            return START_NOT_STICKY;
        }
        if (intent == null) {
            // Restarted by the system without a call to show: nothing to keep alive.
            stopSelf();
            return START_NOT_STICKY;
        }
        String title = intent.getStringExtra(EXTRA_TITLE);
        boolean muted = intent.getBooleanExtra(EXTRA_MUTED, false);
        boolean video = intent.getBooleanExtra(EXTRA_VIDEO, false);
        long startedAt = intent.getLongExtra(EXTRA_STARTED_AT, System.currentTimeMillis());
        try {
            Notification notification = build(title == null ? "Huddle" : title, muted, video, startedAt);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                startForeground(NOTIFICATION_ID, notification, serviceTypes(video));
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
            running = true;
        } catch (Exception e) {
            // Android 12+ refuses to start one from the background; the call still runs in the foreground.
            Log.w(TAG, "Could not start the call service", e);
            stopSelf();
        }
        return START_NOT_STICKY;
    }

    /** Microphone always; camera too while it is on and allowed (Android 14 checks both). */
    private int serviceTypes(boolean video) {
        int types = ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE;
        boolean cameraAllowed = ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
        if (video && cameraAllowed) types |= ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA;
        return types;
    }

    private Notification build(String title, boolean muted, boolean video, long startedAt) {
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm != null && nm.getNotificationChannel(CHANNEL_ID) == null) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Calls in progress", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Shown while you're in a huddle, so the call keeps running in the background.");
            channel.setShowBadge(false);
            nm.createNotificationChannel(channel);
        }
        int immutable = PendingIntent.FLAG_IMMUTABLE;

        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openApp = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | immutable);

        PendingIntent mute = PendingIntent.getService(this, 1, new Intent(this, CallService.class).setAction(ACTION_MUTE), PendingIntent.FLAG_UPDATE_CURRENT | immutable);
        PendingIntent leave = PendingIntent.getService(this, 2, new Intent(this, CallService.class).setAction(ACTION_LEAVE), PendingIntent.FLAG_UPDATE_CURRENT | immutable);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_call)
            .setContentTitle((video ? "Video call · " : "In call · ") + title)
            .setContentText(muted ? "You're muted · tap to return to the call" : "Tap to return to the call")
            .setContentIntent(openApp)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setWhen(startedAt)
            .setUsesChronometer(true)
            .setShowWhen(true)
            .addAction(0, muted ? "Unmute" : "Mute", mute)
            .addAction(0, "Leave", leave)
            .build();
    }

    /** The app was swiped away from recent apps: the WebView (and the call) is gone too. */
    @Override
    public void onTaskRemoved(Intent rootIntent) {
        CallSessionPlugin.dispatchAction("leave");
        stopSelf();
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        running = false;
        stopForeground(STOP_FOREGROUND_REMOVE);
        super.onDestroy();
    }
}
