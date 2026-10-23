package com.oruinwan.app;

import android.app.KeyguardManager;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;

import org.json.JSONObject;

public class MainActivity extends BridgeActivity {

    private static volatile boolean foreground = false;

    /** True while the app is on screen: incoming calls then use the app's own screen. */
    static boolean isInForeground() {
        return foreground;
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Keep the details of a native crash for "Oruinwan closed unexpectedly" next launch.
        CrashLog.install(this);
        // App-specific plugins must be registered before the bridge starts.
        // Google Play builds update through Play; the web code checks
        // Capacitor.isPluginAvailable('AppUpdater') to tell the two apart.
        if (BuildConfig.IN_APP_UPDATES) registerPlugin(AppUpdaterPlugin.class);
        registerPlugin(AppWindowPlugin.class);
        // Over-the-air UI updates (both flavors: the UI is JavaScript in the WebView). The
        // boot guard rolls back a downloaded UI that failed to start, before the WebView loads.
        OtaBundleStore.beforeBridge(this);
        registerPlugin(OtaBundlePlugin.class);
        registerPlugin(GoogleSignInPlugin.class);
        // Huddles: background calls, ringing, speaker/earpiece, microphone and camera permissions.
        registerPlugin(CallSessionPlugin.class);
        super.onCreate(savedInstanceState);
        handleCallIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleCallIntent(intent);
    }

    @Override
    public void onResume() {
        super.onResume();
        foreground = true;
    }

    @Override
    public void onPause() {
        foreground = false;
        super.onPause();
    }

    /** A tap on an incoming call's notification (Answer, or the full-screen ring). */
    private void handleCallIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getStringExtra(CallRinger.EXTRA_CALL_ACTION);
        String raw = intent.getStringExtra(CallRinger.EXTRA_CALL);
        if (action == null || raw == null) return;
        try {
            JSONObject call = new JSONObject(raw);
            showOverLockScreen("answer".equals(action));
            if ("answer".equals(action)) CallRinger.cancelIncoming(this, call.optString("huddleId", ""));
            CallSessionPlugin.dispatchCallAction(action, call);
        } catch (Exception e) {
            Log.w("MainActivity", "Could not open the call", e);
        }
        // Handled once: a later recreation must not answer again.
        intent.removeExtra(CallRinger.EXTRA_CALL_ACTION);
        intent.removeExtra(CallRinger.EXTRA_CALL);
    }

    /** The ring shows over the lock screen; answering also asks to unlock. */
    private void showOverLockScreen(boolean unlock) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                setShowWhenLocked(true);
                setTurnScreenOn(true);
                KeyguardManager km = getSystemService(KeyguardManager.class);
                if (unlock && km != null) km.requestDismissKeyguard(this, null);
            } else {
                getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
            }
        } catch (Exception e) {
            Log.w("MainActivity", "Could not show over the lock screen", e);
        }
    }
}
