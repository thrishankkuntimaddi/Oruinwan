import api from '@services/api';

/**
 * Account-level notification preferences (User.preferences.notifications):
 *   GET /api/auth/me/preferences/notifications
 *   PUT /api/auth/me/preferences/notifications   (partial)
 * Saving broadcasts PREFS_EVENT so live listeners (toasts, desktop alerts,
 * sounds) pick up the change without a reload.
 */
export const NOTIFICATION_PREF_DEFAULTS = Object.freeze({
    emailDigest: true,
    marketingEmails: false,
    desktopPush: true,
    sound: true,
    mentionsOnly: false,
    dmNotifications: true,
});

export const PREFS_EVENT = 'oruinwan:notification-prefs';
/** Per-workspace NotificationPreference saved: detail { workspaceId, preferences }. */
export const WORKSPACE_PREFS_EVENT = 'oruinwan:workspace-notification-prefs';
const ENDPOINT = '/api/auth/me/preferences/notifications';

const normalize = (data) => ({ ...NOTIFICATION_PREF_DEFAULTS, ...(data && typeof data === 'object' ? data : {}) });

export async function fetchAccountNotificationPrefs() {
    const { data } = await api.get(ENDPOINT);
    return normalize(data);
}

export async function saveAccountNotificationPrefs(patch) {
    const { data } = await api.put(ENDPOINT, patch);
    const prefs = normalize(data);
    try { window.dispatchEvent(new CustomEvent(PREFS_EVENT, { detail: prefs })); } catch { /* non-browser */ }
    return prefs;
}
