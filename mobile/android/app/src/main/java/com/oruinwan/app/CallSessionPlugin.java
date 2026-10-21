package com.oruinwan.app;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.view.WindowManager;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

/**
 * Calls on Android (src/native/callSession.js): keeps a huddle running while the app is in
 * the background (CallService, an ongoing "In call" notification with Mute and Leave),
 * switches between the speaker and the earpiece, keeps the screen on during video, and asks
 * for the microphone and camera. checkPermissions / requestPermissions come from Plugin.
 */
@CapacitorPlugin(
    name = "CallSession",
    permissions = {
        @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO }),
        @Permission(alias = "camera", strings = { Manifest.permission.CAMERA })
    }
)
public class CallSessionPlugin extends Plugin {

    private static CallSessionPlugin instance;
    private boolean audioChanged = false;

    @Override
    public void load() {
        instance = this;
    }

    @Override
    protected void handleOnDestroy() {
        if (instance == this) instance = null;
    }

    /** A tap on the notification's Mute or Leave button, passed on to the call. */
    static void dispatchAction(String action) {
        CallSessionPlugin plugin = instance;
        if (plugin == null) return;
        JSObject data = new JSObject();
        data.put("action", action);
        plugin.notifyListeners("action", data);
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
        try {
            ContextCompat.startForegroundService(getContext(), serviceIntent(CallService.ACTION_START, call));
            call.resolve();
        } catch (Exception e) {
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
        getContext().stopService(new Intent(getContext(), CallService.class));
        restoreAudio();
        setScreenOn(false);
        call.resolve();
    }

    /** on: true for the loudspeaker, false for the earpiece (or a connected headset). */
    @PluginMethod
    public void setSpeaker(PluginCall call) {
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
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
        intent.setData(Uri.fromParts("package", getContext().getPackageName(), null));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    private void restoreAudio() {
        if (!audioChanged) return;
        audioChanged = false;
        AudioManager am = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        if (am == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) am.clearCommunicationDevice();
        else am.setSpeakerphoneOn(false);
        am.setMode(AudioManager.MODE_NORMAL);
    }

    private void setScreenOn(boolean on) {
        if (getActivity() == null) return;
        getActivity().runOnUiThread(() -> {
            if (on) getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        });
    }
}
