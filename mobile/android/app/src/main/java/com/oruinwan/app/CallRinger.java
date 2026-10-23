package com.oruinwan.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.Person;

import org.json.JSONObject;

/**
 * Incoming calls on Android.
 *  - App closed or in the background: a ringing "call" notification with Answer and Decline,
 *    and a full-screen intent that opens the app over the lock screen (Android's CallStyle).
 *  - App open: the app shows its own incoming-call screen; startRinging/stopRinging play the
 *    phone's ringtone and vibrate meanwhile.
 * The call's details travel as JSON (the server's huddle:ring / FCM "call" payload).
 */
final class CallRinger {

    static final String CHANNEL_ID = "oruinwan_incoming_calls";
    static final String EXTRA_CALL = "oruinwan.call";
    static final String EXTRA_CALL_ACTION = "oruinwan.callAction"; // "answer" | "open"
    private static final String TAG = "CallRinger";
    private static final long DEFAULT_TTL_MS = 45_000L;

    private static Ringtone ringtone;
    private static Vibrator vibrator;

    private CallRinger() {}

    /** A stable notification id for one call. */
    static int notificationId(String huddleId) {
        return 0x0CA11000 + Math.abs(String.valueOf(huddleId).hashCode() % 0xFFFF);
    }

    static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (nm == null || nm.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Incoming calls", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Rings when someone calls you in a direct message.");
        Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        channel.setSound(sound, new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build());
        channel.enableVibration(true);
        channel.setVibrationPattern(new long[] { 0, 800, 600, 800, 600 });
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(channel);
    }

    /** Shows the ringing notification. Returns false when it could not be shown. */
    static boolean showIncoming(Context context, JSONObject call) {
        try {
            String huddleId = call.optString("huddleId", "");
            if (huddleId.isEmpty()) return false;
            if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) {
                Log.w(TAG, "Notifications are off for Oruinwan: can't ring");
                return false;
            }
            ensureChannel(context);
            JSONObject from = call.optJSONObject("from");
            String caller = from != null ? from.optString("name", "Someone") : "Someone";
            boolean video = call.optBoolean("video", false);
            String title = call.optString("title", "");
            long ttl = DEFAULT_TTL_MS;
            long expiresAt = call.optLong("expiresAt", 0);
            if (expiresAt > 0) ttl = Math.max(5_000L, expiresAt - System.currentTimeMillis());

            int id = notificationId(huddleId);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
            PendingIntent answer = PendingIntent.getActivity(context, id, appIntent(context, call, "answer"), flags);
            PendingIntent fullScreen = PendingIntent.getActivity(context, id + 1, appIntent(context, call, "open"), flags);
            Intent declineIntent = new Intent(context, CallActionReceiver.class)
                .setAction(CallActionReceiver.ACTION_DECLINE)
                .putExtra(EXTRA_CALL, call.toString());
            PendingIntent decline = PendingIntent.getBroadcast(context, id + 2, declineIntent, flags);

            Person person = new Person.Builder().setName(caller).setImportant(true).build();
            NotificationCompat.Builder b = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_call)
                .setContentTitle(caller)
                .setContentText((video ? "Incoming video call" : "Incoming voice call") + (title.isEmpty() ? "" : " · " + title))
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOngoing(true)
                .setAutoCancel(false)
                .setTimeoutAfter(ttl)
                .setContentIntent(fullScreen)
                .setFullScreenIntent(fullScreen, true)
                .setStyle(NotificationCompat.CallStyle.forIncomingCall(person, decline, answer).setIsVideo(video));
            NotificationManagerCompat.from(context).notify(id, b.build());
            return true;
        } catch (SecurityException e) {
            Log.w(TAG, "No permission to post the call notification", e);
            return false;
        } catch (Exception e) {
            Log.w(TAG, "Could not show the incoming call", e);
            return false;
        }
    }

    static void cancelIncoming(Context context, String huddleId) {
        try {
            NotificationManagerCompat.from(context).cancel(notificationId(huddleId));
        } catch (Exception e) {
            Log.w(TAG, "Could not cancel the incoming call", e);
        }
        stopRinging();
    }

    private static Intent appIntent(Context context, JSONObject call, String action) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setAction("com.oruinwan.app.call." + action);
        intent.putExtra(EXTRA_CALL, call.toString());
        intent.putExtra(EXTRA_CALL_ACTION, action);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return intent;
    }

    /** The phone's ringtone and vibration while the app shows its own incoming-call screen. */
    static synchronized void startRinging(Context context) {
        stopRinging();
        try {
            Uri uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            ringtone = RingtoneManager.getRingtone(context.getApplicationContext(), uri);
            if (ringtone != null) {
                ringtone.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build());
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) ringtone.setLooping(true);
                ringtone.play();
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not play the ringtone", e);
        }
        try {
            vibrator = (Vibrator) context.getApplicationContext().getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator != null && vibrator.hasVibrator()) {
                long[] pattern = { 0, 800, 600 };
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
                else vibrator.vibrate(pattern, 0);
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not vibrate", e);
        }
    }

    static synchronized void stopRinging() {
        try {
            if (ringtone != null) ringtone.stop();
        } catch (Exception ignored) {
            // already stopped
        }
        ringtone = null;
        try {
            if (vibrator != null) vibrator.cancel();
        } catch (Exception ignored) {
            // already stopped
        }
        vibrator = null;
    }
}
