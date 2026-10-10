package com.oruinwan.app;

import android.graphics.Color;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Keeps the window behind the system bars in the app's theme colour. On WebView versions
 * older than 140 Capacitor pads the web view instead of drawing it edge to edge, so the
 * status and navigation bar areas show this colour rather than the page.
 */
@CapacitorPlugin(name = "AppWindow")
public class AppWindowPlugin extends Plugin {

    @PluginMethod
    public void setBackgroundColor(PluginCall call) {
        String value = call.getString("color", "");
        final int color;
        try {
            color = Color.parseColor(value);
        } catch (IllegalArgumentException e) {
            call.reject("Not a colour: " + value);
            return;
        }
        getActivity().runOnUiThread(() -> {
            getActivity().getWindow().getDecorView().setBackgroundColor(color);
            if (getBridge().getWebView() != null) {
                getBridge().getWebView().setBackgroundColor(color);
            }
            call.resolve();
        });
    }
}
