package com.oruinwan.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * "Decline" on the incoming-call notification. Stops the ringing without opening the app and
 * tells the server, so the caller sees the call was declined and the person's other devices stop
 * ringing. The server puts a short-lived signed `declineUrl` in the call payload, so no sign-in
 * token is needed here. If the app is running it is told too (it also sends huddle:decline).
 */
public class CallActionReceiver extends BroadcastReceiver {

    static final String ACTION_DECLINE = "com.oruinwan.app.call.DECLINE";
    private static final String TAG = "CallActionReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !ACTION_DECLINE.equals(intent.getAction())) return;
        JSONObject call;
        try {
            call = new JSONObject(intent.getStringExtra(CallRinger.EXTRA_CALL));
        } catch (Exception e) {
            return;
        }
        CallRinger.cancelIncoming(context, call.optString("huddleId", ""));
        CallSessionPlugin.dispatchCallAction("decline", call);

        String declineUrl = call.optString("declineUrl", "");
        if (!declineUrl.startsWith("https://") && !declineUrl.startsWith("http://")) return;
        PendingResult pending = goAsync();
        new Thread(() -> {
            try {
                HttpURLConnection conn = (HttpURLConnection) new URL(declineUrl).openConnection();
                conn.setRequestMethod("POST");
                conn.setConnectTimeout(8000);
                conn.setReadTimeout(8000);
                conn.setDoOutput(true);
                conn.setRequestProperty("Content-Type", "application/json");
                try (OutputStream out = conn.getOutputStream()) {
                    out.write("{}".getBytes(StandardCharsets.UTF_8));
                }
                int status = conn.getResponseCode();
                if (status >= 400) Log.w(TAG, "Decline was refused: HTTP " + status);
                conn.disconnect();
            } catch (Exception e) {
                Log.w(TAG, "Could not send the decline", e);
            } finally {
                pending.finish();
            }
        }).start();
    }
}
