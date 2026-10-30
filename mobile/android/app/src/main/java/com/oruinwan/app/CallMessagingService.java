package com.oruinwan.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;

import org.json.JSONObject;

import java.util.Map;

/**
 * Firebase messages for Oruinwan. Takes the place of the push plugin's own service
 * (AndroidManifest.xml removes that one) and passes every message on to it, so message
 * notifications work as before. Calls are handled here, natively, so a closed app still rings:
 *  - data.type "call":        ring (CallRinger), unless the app is open (it shows its own
 *                             screen) or the person is already in a call.
 *  - data.type "call_cancel": stop ringing (answered elsewhere, declined, ended, timed out).
 *  - a message with ct/iv (data-only, sent to apps that decrypt): decrypted here with the
 *    conversation key the app left in NotifyKeys, and shown with the real text. The server's
 *    "New message" (data.body) is the fallback. While the app is on screen it shows its own.
 */
public class CallMessagingService extends MessagingService {

    private static final String TAG = "CallMessaging";

    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        try {
            Map<String, String> data = message.getData();
            String type = data != null ? data.get("type") : null;
            if ("call".equals(type) || "call_cancel".equals(type)) {
                JSONObject call = parseCall(data);
                if (call != null) {
                    if ("call_cancel".equals(type)) {
                        CallRinger.cancelIncoming(this, call.optString("huddleId", ""));
                        CallSessionPlugin.dispatchCallAction("cancel", call);
                    } else if (call.optBoolean("ring", true) && !MainActivity.isInForeground() && !CallService.isRunning()) {
                        CallRinger.showIncoming(this, call);
                    }
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not handle a call message", e);
        }
        try {
            Map<String, String> data = message.getData();
            if (data != null && data.get("ct") != null && !MainActivity.isInForeground()) showMessage(data, message.getMessageId());
        } catch (Exception e) {
            Log.w(TAG, "Could not show a message notification", e);
        }
        // The app (when running) still hears about every message, calls included.
        try {
            super.onMessageReceived(message);
        } catch (Exception e) {
            Log.w(TAG, "Push plugin could not handle the message", e);
        }
    }

    private static final String MESSAGES_CHANNEL = "messages";

    /** A message notification with the decrypted text (one per conversation, newest replaces). */
    private void showMessage(Map<String, String> data, String messageId) {
        String conv = data.get("conversationId");
        if (conv == null) conv = data.get("dmSessionId") != null ? data.get("dmSessionId") : data.get("channelId");
        String text = NotifyKeys.decrypt(this, conv, data.get("kv"), data.get("ct"), data.get("iv"));
        String body = text != null ? clip(text, 400) : data.getOrDefault("body", "New message");
        String title = data.getOrDefault("title", "Oruinwan");

        NotificationManager nm = getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm != null && nm.getNotificationChannel(MESSAGES_CHANNEL) == null) {
            NotificationChannel channel = new NotificationChannel(MESSAGES_CHANNEL, "Messages", NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Direct messages, mentions and replies");
            nm.createNotificationChannel(channel);
        }

        // A tap opens the app the same way a Firebase notification does: the push plugin reads
        // these extras and the app opens the conversation (src/features/home/openTarget.js).
        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        open.putExtra("google.message_id", messageId != null ? messageId : String.valueOf(System.currentTimeMillis()));
        for (Map.Entry<String, String> e : data.entrySet()) {
            if (!"ct".equals(e.getKey()) && !"iv".equals(e.getKey())) open.putExtra(e.getKey(), e.getValue());
        }
        int id = conv != null ? conv.hashCode() : (int) System.currentTimeMillis();
        PendingIntent pending = PendingIntent.getActivity(this, id, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder b = new NotificationCompat.Builder(this, MESSAGES_CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_message)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setAutoCancel(true)
            .setContentIntent(pending);
        if (conv != null) b.setGroup(conv);
        try {
            NotificationManagerCompat.from(this).notify(conv, id, b.build());
        } catch (SecurityException e) {
            Log.w(TAG, "Notifications aren't allowed", e);
        }
    }

    private static String clip(String text, int max) {
        String one = text.replaceAll("\\s+", " ").trim();
        return one.length() > max ? one.substring(0, max - 1) + "…" : one;
    }

    /** The call JSON from data.call, or the flat data fields. */
    private static JSONObject parseCall(Map<String, String> data) {
        try {
            String raw = data.get("call");
            if (raw != null && !raw.isEmpty()) return new JSONObject(raw);
            JSONObject flat = new JSONObject();
            for (Map.Entry<String, String> e : data.entrySet()) flat.put(e.getKey(), e.getValue());
            return flat.has("huddleId") ? flat : null;
        } catch (Exception e) {
            return null;
        }
    }
}
