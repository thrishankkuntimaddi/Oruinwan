package com.oruinwan.app.widgets;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;

/** The Chats home-screen widget (drawn by WidgetRenderer from the app's snapshot). */
public class ChatsWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        WidgetRenderer.update(context, manager, ids, WidgetRenderer.KIND_CHATS);
    }

    /** Resized: redraw with as many rows as now fit. */
    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, Bundle options) {
        WidgetRenderer.update(context, manager, new int[] { id }, WidgetRenderer.KIND_CHATS);
    }
}
