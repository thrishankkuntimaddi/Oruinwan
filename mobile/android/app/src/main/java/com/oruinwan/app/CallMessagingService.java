package com.oruinwan.app;

import android.util.Log;

import androidx.annotation.NonNull;

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
        // The app (when running) still hears about every message, calls included.
        try {
            super.onMessageReceived(message);
        } catch (Exception e) {
            Log.w(TAG, "Push plugin could not handle the message", e);
        }
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
