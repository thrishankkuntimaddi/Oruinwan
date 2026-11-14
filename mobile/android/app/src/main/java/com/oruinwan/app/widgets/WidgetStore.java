package com.oruinwan.app.widgets;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONObject;

/** The widgets' snapshot, in the app's private storage (MODE_PRIVATE: other apps can't read it). */
final class WidgetStore {
    private static final String PREFS = "oruinwan_widgets";
    private static final String KEY = "snapshot";

    private WidgetStore() {}

    static void save(Context context, String json) {
        prefs(context).edit().putString(KEY, json == null ? "" : json).apply();
    }

    /** The snapshot, or an empty object when the app hasn't written one yet. */
    static JSONObject load(Context context) {
        String json = prefs(context).getString(KEY, "");
        if (json == null || json.isEmpty()) return new JSONObject();
        try {
            return new JSONObject(json);
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
