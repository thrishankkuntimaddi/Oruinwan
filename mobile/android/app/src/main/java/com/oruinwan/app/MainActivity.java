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
        registerPlugin(GoogleSignInPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
