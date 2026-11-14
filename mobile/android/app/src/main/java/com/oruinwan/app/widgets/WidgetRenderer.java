package com.oruinwan.app.widgets;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;

import com.oruinwan.app.MainActivity;
import com.oruinwan.app.R;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Draws the four home-screen widgets from the snapshot (WidgetStore). Taps open the app with an
 * oruinwan:// link (a conversation, a task, a meeting, or a widget action); the app routes it
 * (features/widgets/widgetLinks.js and features/home/openTarget.js).
 */
public final class WidgetRenderer {
    static final String KIND_CHATS = "chats";
    static final String KIND_TASKS = "tasks";
    static final String KIND_HUDDLES = "huddles";
    static final String KIND_QUICK = "quick";

    private static final int[] CHAT_ROWS = {R.id.chat_row_0, R.id.chat_row_1, R.id.chat_row_2, R.id.chat_row_3};
    private static final int[] CHAT_AV = {R.id.chat_av_0, R.id.chat_av_1, R.id.chat_av_2, R.id.chat_av_3};
    private static final int[] CHAT_TITLE = {R.id.chat_title_0, R.id.chat_title_1, R.id.chat_title_2, R.id.chat_title_3};
    private static final int[] CHAT_PREV = {R.id.chat_prev_0, R.id.chat_prev_1, R.id.chat_prev_2, R.id.chat_prev_3};
    private static final int[] CHAT_TIME = {R.id.chat_time_0, R.id.chat_time_1, R.id.chat_time_2, R.id.chat_time_3};
    private static final int[] CHAT_BADGE = {R.id.chat_badge_0, R.id.chat_badge_1, R.id.chat_badge_2, R.id.chat_badge_3};

    private static final int[] TASK_ROWS = {R.id.task_row_0, R.id.task_row_1, R.id.task_row_2, R.id.task_row_3};
    private static final int[] TASK_DOT = {R.id.task_dot_0, R.id.task_dot_1, R.id.task_dot_2, R.id.task_dot_3};
    private static final int[] TASK_TITLE = {R.id.task_title_0, R.id.task_title_1, R.id.task_title_2, R.id.task_title_3};
    private static final int[] TASK_DUE = {R.id.task_due_0, R.id.task_due_1, R.id.task_due_2, R.id.task_due_3};

    private static final int[] HUD_LIVE = {R.id.hud_live_0, R.id.hud_live_1, R.id.hud_live_2};
    private static final int[] HUD_LIVE_TITLE = {R.id.hud_live_title_0, R.id.hud_live_title_1, R.id.hud_live_title_2};
    private static final int[] HUD_LIVE_PEOPLE = {R.id.hud_live_people_0, R.id.hud_live_people_1, R.id.hud_live_people_2};

    private static final int[] QUICK_C = {R.id.quick_c_0, R.id.quick_c_1, R.id.quick_c_2, R.id.quick_c_3};
    private static final int[] QUICK_AV = {R.id.quick_c_av_0, R.id.quick_c_av_1, R.id.quick_c_av_2, R.id.quick_c_av_3};
    private static final int[] QUICK_NAME = {R.id.quick_c_name_0, R.id.quick_c_name_1, R.id.quick_c_name_2, R.id.quick_c_name_3};
    private static final int[] QUICK_BADGE = {R.id.quick_c_badge_0, R.id.quick_c_badge_1, R.id.quick_c_badge_2, R.id.quick_c_badge_3};
    private static final int[] QUICK_ACT = {R.id.quick_a_0, R.id.quick_a_1, R.id.quick_a_2, R.id.quick_a_3};

    private WidgetRenderer() {}

    /** Redraws every placed widget (after the app wrote a new snapshot). */
    public static void updateAll(Context context) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(context);
        update(context, mgr, mgr.getAppWidgetIds(new ComponentName(context, ChatsWidget.class)), KIND_CHATS);
        update(context, mgr, mgr.getAppWidgetIds(new ComponentName(context, TasksWidget.class)), KIND_TASKS);
        update(context, mgr, mgr.getAppWidgetIds(new ComponentName(context, HuddlesWidget.class)), KIND_HUDDLES);
        update(context, mgr, mgr.getAppWidgetIds(new ComponentName(context, QuickWidget.class)), KIND_QUICK);
    }

    static void update(Context context, AppWidgetManager mgr, int[] ids, String kind) {
        if (ids == null || ids.length == 0) return;
        JSONObject snap = WidgetStore.load(context);
        for (int id : ids) {
            RemoteViews views;
            int height = heightDp(mgr, id);
            try {
                views = render(context, snap, kind, id, height);
            } catch (Exception e) {
                // A malformed snapshot must never leave "Can't load widget" on the home screen.
                views = render(context, new JSONObject(), kind, id, height);
            }
            mgr.updateAppWidget(id, views);
        }
    }

    /** The widget's current height in dp (portrait), or the 2-row default when unknown. */
    private static int heightDp(AppWidgetManager mgr, int id) {
        try {
            Bundle o = mgr.getAppWidgetOptions(id);
            int h = o == null ? 0 : o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0);
            return h > 0 ? h : 110;
        } catch (Exception e) {
            return 110;
        }
    }

    /** How many rows of `rowDp` fit under the header in a widget `heightDp` tall (1..max). */
    private static int fit(int heightDp, int reservedDp, int rowDp, int max) {
        int n = (heightDp - 24 - 30 - reservedDp) / rowDp;
        return Math.max(1, Math.min(max, n));
    }

    private static RemoteViews render(Context context, JSONObject snap, String kind, int widgetId, int heightDp) {
        boolean dark = "dark".equals(snap.optString("theme", "light"));
        int t1 = dark ? Color.parseColor("#F5F5F7") : Color.parseColor("#0A0A0C");
        int t2 = dark ? Color.parseColor("#AAAAB0") : Color.parseColor("#5A5A60");
        int chip = dark ? R.drawable.widget_chip_dark : R.drawable.widget_chip_light;
        boolean signedIn = snap.optBoolean("signedIn", false);

        switch (kind) {
            case KIND_TASKS: {
                RemoteViews v = base(context, R.layout.widget_tasks, dark);
                v.setTextColor(R.id.tasks_title, t1);
                v.setTextColor(R.id.tasks_sub, t2);
                v.setTextColor(R.id.tasks_new, t1);
                v.setInt(R.id.tasks_new, "setBackgroundResource", chip);
                JSONObject tasks = snap.optJSONObject("tasks");
                if (!signedIn || tasks == null) return signedOut(context, v, R.id.tasks_empty, t2, widgetId);
                int overdue = tasks.optInt("overdue"), today = tasks.optInt("today");
                v.setTextViewText(R.id.tasks_sub, overdue > 0 ? overdue + " overdue" : today > 0 ? today + " due today" : snap.optString("workspace"));
                v.setTextColor(R.id.tasks_sub, overdue > 0 ? Color.parseColor("#FF3B30") : t2);
                tap(context, v, R.id.tasks_title, tasks.optString("all"), widgetId, 1);
                tap(context, v, R.id.tasks_new, tasks.optString("create"), widgetId, 2);
                JSONArray items = tasks.optJSONArray("items");
                int n = items == null ? 0 : Math.min(items.length(), fit(heightDp, 0, 28, TASK_ROWS.length));
                for (int i = 0; i < TASK_ROWS.length; i++) {
                    if (i >= n) { v.setViewVisibility(TASK_ROWS[i], View.GONE); continue; }
                    JSONObject t = items.optJSONObject(i);
                    v.setViewVisibility(TASK_ROWS[i], View.VISIBLE);
                    v.setInt(TASK_DOT[i], "setBackgroundResource", chip);
                    v.setTextViewText(TASK_TITLE[i], t.optString("title"));
                    v.setTextColor(TASK_TITLE[i], t1);
                    String tone = t.optString("tone");
                    v.setTextViewText(TASK_DUE[i], t.optString("due"));
                    v.setTextColor(TASK_DUE[i], "overdue".equals(tone) ? Color.parseColor("#FF3B30") : "today".equals(tone) ? Color.parseColor("#D97A00") : t2);
                    tap(context, v, TASK_ROWS[i], t.optString("link"), widgetId, 10 + i);
                }
                empty(v, R.id.tasks_empty, n == 0, "Nothing due. Nice.", t2);
                return v;
            }
            case KIND_HUDDLES: {
                RemoteViews v = base(context, R.layout.widget_huddles, dark);
                v.setTextColor(R.id.hud_title, t1);
                v.setTextColor(R.id.hud_sub, t2);
                v.setTextColor(R.id.hud_start, t1);
                v.setInt(R.id.hud_start, "setBackgroundResource", chip);
                v.setInt(R.id.hud_next, "setBackgroundResource", chip);
                JSONObject hud = snap.optJSONObject("huddles");
                if (!signedIn || hud == null) {
                    v.setViewVisibility(R.id.hud_start, View.GONE);
                    return signedOut(context, v, R.id.hud_empty, t2, widgetId);
                }
                v.setViewVisibility(R.id.hud_start, View.VISIBLE);
                tap(context, v, R.id.hud_title, hud.optString("all"), widgetId, 1);
                tap(context, v, R.id.hud_start, hud.optString("start"), widgetId, 2);
                JSONArray live = hud.optJSONArray("live");
                int n = live == null ? 0 : Math.min(live.length(), fit(heightDp, hud.optJSONObject("next") != null ? 106 : 40, 28, HUD_LIVE.length));
                v.setTextViewText(R.id.hud_sub, n > 0 ? n + " live now" : snap.optString("workspace"));
                for (int i = 0; i < HUD_LIVE.length; i++) {
                    if (i >= n) { v.setViewVisibility(HUD_LIVE[i], View.GONE); continue; }
                    JSONObject h = live.optJSONObject(i);
                    v.setViewVisibility(HUD_LIVE[i], View.VISIBLE);
                    v.setTextViewText(HUD_LIVE_TITLE[i], h.optString("title"));
                    v.setTextColor(HUD_LIVE_TITLE[i], t1);
                    int people = h.optInt("people");
                    v.setTextViewText(HUD_LIVE_PEOPLE[i], people > 0 ? people + (people == 1 ? " person" : " people") : "Join");
                    v.setTextColor(HUD_LIVE_PEOPLE[i], t2);
                    tap(context, v, HUD_LIVE[i], h.optString("link"), widgetId, 10 + i);
                }
                JSONObject next = hud.optJSONObject("next");
                if (next != null) {
                    v.setViewVisibility(R.id.hud_next, View.VISIBLE);
                    v.setTextColor(R.id.hud_next_label, t2);
                    v.setTextViewText(R.id.hud_next_title, next.optString("title"));
                    v.setTextColor(R.id.hud_next_title, t1);
                    v.setTextViewText(R.id.hud_next_when, next.optString("when"));
                    v.setTextColor(R.id.hud_next_when, t2);
                    tap(context, v, R.id.hud_next, next.optString("link"), widgetId, 20);
                } else {
                    v.setViewVisibility(R.id.hud_next, View.GONE);
                }
                empty(v, R.id.hud_empty, n == 0 && next == null, "No live huddles, nothing scheduled.", t2);
                return v;
            }
            case KIND_QUICK: {
                RemoteViews v = base(context, R.layout.widget_quick, dark);
                v.setTextColor(R.id.quick_title, t1);
                v.setTextColor(R.id.quick_sub, t2);
                for (int id : QUICK_ACT) {
                    v.setTextColor(id, t1);
                    v.setInt(id, "setBackgroundResource", chip);
                }
                JSONObject quick = snap.optJSONObject("quick");
                v.setTextViewText(R.id.quick_sub, signedIn ? snap.optString("workspace") : "Open to sign in");
                JSONArray actions = quick == null ? null : quick.optJSONArray("actions");
                for (int i = 0; i < QUICK_ACT.length; i++) {
                    JSONObject a = actions == null ? null : actions.optJSONObject(i);
                    tap(context, v, QUICK_ACT[i], a == null ? "" : a.optString("link"), widgetId, 30 + i);
                }
                JSONArray contacts = quick == null ? null : quick.optJSONArray("contacts");
                int n = contacts == null || !signedIn ? 0 : Math.min(contacts.length(), QUICK_C.length);
                for (int i = 0; i < QUICK_C.length; i++) {
                    if (i >= n) { v.setViewVisibility(QUICK_C[i], View.INVISIBLE); continue; }
                    JSONObject c = contacts.optJSONObject(i);
                    v.setViewVisibility(QUICK_C[i], View.VISIBLE);
                    v.setInt(QUICK_AV[i], "setBackgroundResource", chip);
                    v.setTextViewText(QUICK_AV[i], c.optString("initial"));
                    v.setTextColor(QUICK_AV[i], t1);
                    v.setTextViewText(QUICK_NAME[i], c.optString("title"));
                    v.setTextColor(QUICK_NAME[i], t1);
                    badge(v, QUICK_BADGE[i], c.optInt("unread"));
                    tap(context, v, QUICK_C[i], c.optString("link"), widgetId, 10 + i);
                }
                if (!signedIn) tap(context, v, R.id.widget_root, "", widgetId, 0);
                return v;
            }
            default: {
                RemoteViews v = base(context, R.layout.widget_chats, dark);
                v.setTextColor(R.id.chats_title, t1);
                v.setTextColor(R.id.chats_sub, t2);
                JSONObject chats = snap.optJSONObject("chats");
                if (!signedIn || chats == null) return signedOut(context, v, R.id.chats_empty, t2, widgetId);
                v.setTextViewText(R.id.chats_sub, snap.optString("workspace"));
                badge(v, R.id.chats_count, chats.optInt("unread"));
                tap(context, v, R.id.chats_title, chats.optString("open"), widgetId, 1);
                JSONArray items = chats.optJSONArray("items");
                int n = items == null ? 0 : Math.min(items.length(), fit(heightDp, 0, 42, CHAT_ROWS.length));
                for (int i = 0; i < CHAT_ROWS.length; i++) {
                    if (i >= n) { v.setViewVisibility(CHAT_ROWS[i], View.GONE); continue; }
                    JSONObject c = items.optJSONObject(i);
                    v.setViewVisibility(CHAT_ROWS[i], View.VISIBLE);
                    v.setInt(CHAT_AV[i], "setBackgroundResource", chip);
                    v.setTextViewText(CHAT_AV[i], c.optString("initial"));
                    v.setTextColor(CHAT_AV[i], t1);
                    v.setTextViewText(CHAT_TITLE[i], c.optString("title"));
                    v.setTextColor(CHAT_TITLE[i], t1);
                    v.setTextViewText(CHAT_PREV[i], c.optString("preview"));
                    v.setTextColor(CHAT_PREV[i], c.optInt("unread") > 0 ? t1 : t2);
                    v.setTextViewText(CHAT_TIME[i], c.optString("time"));
                    v.setTextColor(CHAT_TIME[i], t2);
                    badge(v, CHAT_BADGE[i], c.optInt("unread"));
                    tap(context, v, CHAT_ROWS[i], c.optString("link"), widgetId, 10 + i);
                }
                empty(v, R.id.chats_empty, n == 0, "No conversations yet.", t2);
                return v;
            }
        }
    }

    private static RemoteViews base(Context context, int layout, boolean dark) {
        RemoteViews v = new RemoteViews(context.getPackageName(), layout);
        v.setInt(R.id.widget_root, "setBackgroundResource", dark ? R.drawable.widget_glass_dark : R.drawable.widget_glass_light);
        return v;
    }

    /** Before sign-in (or after sign-out): a prompt; a tap opens the app. */
    private static RemoteViews signedOut(Context context, RemoteViews v, int emptyId, int color, int widgetId) {
        empty(v, emptyId, true, "Open Oruinwan to sign in.", color);
        tap(context, v, R.id.widget_root, "", widgetId, 0);
        return v;
    }

    private static void empty(RemoteViews v, int id, boolean show, String text, int color) {
        v.setViewVisibility(id, show ? View.VISIBLE : View.GONE);
        if (show) {
            v.setTextViewText(id, text);
            v.setTextColor(id, color);
        }
    }

    private static void badge(RemoteViews v, int id, int count) {
        if (count <= 0) {
            v.setViewVisibility(id, View.GONE);
            return;
        }
        v.setViewVisibility(id, View.VISIBLE);
        v.setTextViewText(id, count > 99 ? "99+" : String.valueOf(count));
    }

    /** Tapping `viewId` opens the app at `link` (or just opens the app when it's empty). */
    private static void tap(Context context, RemoteViews v, int viewId, String link, int widgetId, int slot) {
        Intent intent = new Intent(context, MainActivity.class);
        if (link != null && !link.isEmpty()) {
            intent.setAction(Intent.ACTION_VIEW);
            intent.setData(Uri.parse(link));
        } else {
            intent.setAction(Intent.ACTION_MAIN);
            intent.addCategory(Intent.CATEGORY_LAUNCHER);
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int requestCode = widgetId * 100 + slot;
        PendingIntent pi = PendingIntent.getActivity(context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(viewId, pi);
    }
}
