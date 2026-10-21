package com.oruinwan.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
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
        // Huddles: background calls, speaker/earpiece, microphone and camera permissions.
        registerPlugin(CallSessionPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
