package com.oruinwan.app.widgets;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The app hands the home-screen widgets what they show (features/widgets/WidgetSync.jsx): a JSON
 * snapshot kept in the app's private storage. Every widget is redrawn from it.
 */
@CapacitorPlugin(name = "Widgets")
public class WidgetsPlugin extends Plugin {

    @PluginMethod
    public void update(PluginCall call) {
        String snapshot = call.getString("snapshot", "");
        WidgetStore.save(getContext(), snapshot);
        WidgetRenderer.updateAll(getContext());
        call.resolve();
    }
}
