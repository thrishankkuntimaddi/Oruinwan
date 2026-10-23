package com.oruinwan.app;

import android.Manifest;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;
import android.view.WindowManager;

import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * Calls on Android (src/native/callSession.js): keeps a huddle running while the app is in
 * the background (CallService, an ongoing "In call" notification with Mute and Leave), rings for
 * incoming calls (CallRinger), switches between the speaker and the earpiece, keeps the screen
 * on during video, and asks for the microphone, camera and notifications.
 * checkPermissions / requestPermissions come from Plugin (aliases below).
 *
 * Every method catches its own errors: a failure here must never close the app.
 */
@CapacitorPlugin(
    name = "CallSession",
    permissions = {
        @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO }),
        @Permission(alias = "camera", strings = { Manifest.permission.CAMERA }),
        @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
    }
)
public class CallSessionPlugin extends Plugin {

    private static final String TAG = "CallSessionPlugin";
    private static CallSessionPlugin instance;
    // Call actions from notifications that arrived before the app's JavaScript was listening.
    private static final List<JSObject> pendingCallActions = new ArrayList<>();
    private boolean audioChanged = false;

    @Override
    public void load() {
        instance = this;
        drainPending();
    }

    @Override
    protected void handleOnDestroy() {
        if (instance == this) instance = null;
    }

    /** A tap on the in-call notification's Mute or Leave button, passed on to the call. */
    static void dispatchAction(String action) {
        CallSessionPlugin plugin = instance;
        if (plugin == null) return;
        JSObject data = new JSObject();
        data.put("action", action);
        plugin.notifyListeners("action", data);
    }

    /** An incoming call's notification: "answer" | "open" | "decline" | "cancel", with the call. */
    static void dispatchCallAction(String action, JSONObject call) {
        JSObject data = new JSObject();
        data.put("action", action);
        try {
            data.put("call", JSObject.fromJSONObject(call));
        } catch (Exception e) {
            data.put("call", new JSObject());
        }
        synchronized (pendingCallActions) {
            CallSessionPlugin plugin = instance;
            if (plugin == null) {
                pendingCallActions.add(data);
                return;
            }
            // Kept until the app adds its listener (a cold start from the notification).
            plugin.notifyListeners("callAction", data, true);
        }
    }

    private void drainPending() {
        synchronized (pendingCallActions) {
            for (JSObject data : pendingCallActions) notifyListeners("callAction", data, true);
            pendingCallActions.clear();
        }
    }

    private boolean granted(String permission) {
        return ContextCompat.checkSelfPermission(getContext(), permission) == PackageManager.PERMISSION_GRANTED;
    }

    private Intent serviceIntent(String action, PluginCall call) {
        Intent intent = new Intent(getContext(), CallService.class);
        intent.setAction(action);
        intent.putExtra(CallService.EXTRA_TITLE, call.getString("title", "Huddle"));
        intent.putExtra(CallService.EXTRA_MUTED, Boolean.TRUE.equals(call.getBoolean("muted", false)));
        intent.putExtra(CallService.EXTRA_VIDEO, Boolean.TRUE.equals(call.getBoolean("video", false)));
        Long startedAt = call.getLong("startedAt");
        intent.putExtra(CallService.EXTRA_STARTED_AT, startedAt != null ? startedAt : System.currentTimeMillis());
        return intent;
    }

    @PluginMethod
    public void start(PluginCall call) {
        // Android only lets a microphone foreground service start while the app is on screen and
        // the microphone is allowed; starting it otherwise closes the app. Skip it instead: the
        // call still works while the app is open.
        if (!granted(Manifest.permission.RECORD_AUDIO)) {
            call.reject("The microphone isn't allowed, so the call can't keep running in the background.", "NO_MICROPHONE");
            return;
        }
        if (!MainActivity.isInForeground()) {
            call.reject("Oruinwan isn't on screen, so the call can't be kept running in the background yet.", "NOT_FOREGROUND");
            return;
        }
        try {
            ContextCompat.startForegroundService(getContext(), serviceIntent(CallService.ACTION_START, call));
            call.resolve();
        } catch (Exception e) {
            Log.w(TAG, "Could not start the call service", e);
            call.reject("Could not keep the call running in the background: " + e.getMessage());
        }
    }

    @PluginMethod
    public void update(PluginCall call) {
        if (!CallService.isRunning()) {
            call.resolve();
            return;
        }
        try {
            getContext().startService(serviceIntent(CallService.ACTION_UPDATE, call));
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        try {
            getContext().stopService(new Intent(getContext(), CallService.class));
        } catch (Exception e) {
            Log.w(TAG, "Could not stop the call service", e);
        }
        restoreAudio();
        setScreenOn(false);
        call.resolve();
    }

    /** on: true for the loudspeaker, false for the earpiece (or a connected headset). */
    @PluginMethod
    public void setSpeaker(PluginCall call) {
        try {
            boolean on = Boolean.TRUE.equals(call.getBoolean("on", true));
            AudioManager am = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
            if (am == null) {
                call.reject("No audio service");
                return;
            }
            am.setMode(AudioManager.MODE_IN_COMMUNICATION);
            audioChanged = true;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                int wanted = on ? AudioDeviceInfo.TYPE_BUILTIN_SPEAKER : AudioDeviceInfo.TYPE_BUILTIN_EARPIECE;
                AudioDeviceInfo target = null;
                for (AudioDeviceInfo device : am.getAvailableCommunicationDevices()) {
                    if (device.getType() == wanted) target = device;
                }
                if (target != null) am.setCommunicationDevice(target);
                else am.clearCommunicationDevice();
            } else {
                am.setSpeakerphoneOn(on);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not switch the speaker: " + e.getMessage());
        }
    }

    @PluginMethod
    public void keepScreenOn(PluginCall call) {
        setScreenOn(Boolean.TRUE.equals(call.getBoolean("on", false)));
        call.resolve();
    }

    /** "Google Pixel 8": shown to the person's other devices ("In a call on Pixel 8"). */
    @PluginMethod
    public void deviceName(PluginCall call) {
        String maker = Build.MANUFACTURER == null ? "" : Build.MANUFACTURER.trim();
        String model = Build.MODEL == null ? "" : Build.MODEL.trim();
        String name = model;
        if (!maker.isEmpty() && !model.toLowerCase().startsWith(maker.toLowerCase())) {
            name = Character.toUpperCase(maker.charAt(0)) + maker.substring(1) + " " + model;
        }
        JSObject out = new JSObject();
        out.put("name", name.trim());
        call.resolve(out);
    }

    /** This app's page in system settings, to allow a permission that was turned down for good. */
    @PluginMethod
    public void openSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.fromParts("package", getContext().getPackageName(), null));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not open settings: " + e.getMessage());
        }
    }

    // ---------------------------------------------------------------- notifications permission

    /** 'granted' | 'prompt' | 'denied': notifications for this app (Android 13+ asks for them). */
    @PluginMethod
    public void notificationPermission(PluginCall call) {
        JSObject out = new JSObject();
        out.put("state", notificationState());
        call.resolve(out);
    }

    @PluginMethod
    public void requestNotificationPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || getPermissionState("notifications") == PermissionState.GRANTED) {
            notificationPermission(call);
            return;
        }
        requestPermissionForAlias("notifications", call, "notificationPermissionResult");
    }

    @PermissionCallback
    private void notificationPermissionResult(PluginCall call) {
        notificationPermission(call);
    }

    private String notificationState() {
        try {
            boolean enabled = NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return enabled ? "granted" : "denied";
            PermissionState state = getPermissionState("notifications");
            if (state == PermissionState.GRANTED) return enabled ? "granted" : "denied";
            if (state == PermissionState.DENIED) return "denied";
            return "prompt";
        } catch (Exception e) {
            return "prompt";
        }
    }

    /** Android 14+: calls can open full screen over the lock screen only if the person allows it. */
    @PluginMethod
    public void fullScreenCallsAllowed(PluginCall call) {
        boolean allowed = true;
        try {
            if (Build.VERSION.SDK_INT >= 34) {
                NotificationManager nm = getContext().getSystemService(NotificationManager.class);
                allowed = nm == null || nm.canUseFullScreenIntent();
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not check full-screen calls", e);
        }
        JSObject out = new JSObject();
        out.put("allowed", allowed);
        call.resolve(out);
    }

    @PluginMethod
    public void openFullScreenCallSettings(PluginCall call) {
        try {
            Intent intent;
            if (Build.VERSION.SDK_INT >= 34) {
                intent = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT);
                intent.setData(Uri.fromParts("package", getContext().getPackageName(), null));
            } else {
                intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                intent.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            // Some phones don't have that screen: fall back to the app's notification settings.
            try {
                Intent fallback = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                fallback.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(fallback);
                call.resolve();
            } catch (Exception e2) {
                call.reject("Could not open settings: " + e2.getMessage());
            }
        }
    }

    // ---------------------------------------------------------------- incoming calls

    /** The ringtone and vibration while the app shows its incoming-call screen. */
    @PluginMethod
    public void startRinging(PluginCall call) {
        CallRinger.startRinging(getContext());
        call.resolve();
    }

    @PluginMethod
    public void stopRinging(PluginCall call) {
        CallRinger.stopRinging();
        call.resolve();
    }

    /** Rings with the system notification (the app went to the background while a call came in). */
    @PluginMethod
    public void showIncoming(PluginCall call) {
        JSObject data = call.getObject("call");
        boolean shown = data != null && CallRinger.showIncoming(getContext(), data);
        JSObject out = new JSObject();
        out.put("shown", shown);
        call.resolve(out);
    }

    @PluginMethod
    public void cancelIncoming(PluginCall call) {
        String huddleId = call.getString("huddleId", "");
        CallRinger.cancelIncoming(getContext(), huddleId);
        call.resolve();
    }

    // ---------------------------------------------------------------- crash reports

    /** { report: text | null }: the last native crash (CrashLog), for a bug report. */
    @PluginMethod
    public void lastCrash(PluginCall call) {
        JSObject out = new JSObject();
        out.put("report", CrashLog.read(getContext()));
        call.resolve(out);
    }

    @PluginMethod
    public void clearLastCrash(PluginCall call) {
        CrashLog.clear(getContext());
        call.resolve();
    }

    /** After a ring: stop showing over the lock screen. */
    @PluginMethod
    public void leaveLockScreen(PluginCall call) {
        if (getActivity() != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            getActivity().runOnUiThread(() -> {
                try {
                    getActivity().setShowWhenLocked(false);
                    getActivity().setTurnScreenOn(false);
                } catch (Exception e) {
                    Log.w(TAG, "Could not leave the lock screen", e);
                }
            });
        }
        call.resolve();
    }

    private void restoreAudio() {
        if (!audioChanged) return;
        audioChanged = false;
        try {
            AudioManager am = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
            if (am == null) return;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) am.clearCommunicationDevice();
            else am.setSpeakerphoneOn(false);
            am.setMode(AudioManager.MODE_NORMAL);
        } catch (Exception e) {
            Log.w(TAG, "Could not restore audio", e);
        }
    }

    private void setScreenOn(boolean on) {
        if (getActivity() == null) return;
        getActivity().runOnUiThread(() -> {
            try {
                if (on) getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            } catch (Exception e) {
                Log.w(TAG, "Could not change keep-screen-on", e);
            }
        });
    }
}
