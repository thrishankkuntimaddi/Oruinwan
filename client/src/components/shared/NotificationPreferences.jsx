/**
 * NotificationPreferences.jsx
 *
 * Settings panel for per-workspace notification preferences.
 * Fetches from GET /api/notifications/preferences and updates via PATCH.
 *
 * Usage: <NotificationPreferences workspaceId={id} />
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Bell, MessageCircle, GitBranch, CheckSquare, Calendar, Mail, Monitor, Save, Loader2 } from 'lucide-react';
import api from '@services/api';

const PREF_ITEMS = [
    {
        key: 'message',
        label: 'Messages & Mentions',
        description: 'New messages, @mentions, and DMs',
        Icon: MessageCircle,
        color: 'text-sky-500',
    },
    {
        key: 'threadReply',
        label: 'Thread Replies',
        description: 'Replies in threads you follow',
        Icon: GitBranch,
        color: 'text-violet-500',
    },
    {
        key: 'task',
        label: 'Tasks',
        description: 'Task assignments, updates, and due date reminders',
        Icon: CheckSquare,
        color: 'text-emerald-500',
    },
    {
        key: 'meeting',
        label: 'Meetings',
        description: 'Scheduled meetings and reminders',
        Icon: Calendar,
        color: 'text-orange-500',
    },
    {
        key: 'email',
        label: 'Email Notifications',
        description: 'Receive email for important events (task assigned, meeting)',
        Icon: Mail,
        color: 'text-indigo-500',
    },
    {
        key: 'push',
        label: 'Desktop Push',
        description: 'Browser OS notifications when app is in background',
        Icon: Monitor,
        color: 'text-pink-500',
    },
];

export default function NotificationPreferences({ workspaceId }) {
    const [prefs, setPrefs] = useState({
        message: true,
        threadReply: true,
        task: true,
        meeting: true,
        email: false,
        push: true,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState(null);

    const fetchPrefs = useCallback(async () => {
        if (!workspaceId) return;
        setLoading(true);
        try {
            const { data } = await api.get('/api/notifications/preferences', {
                params: { workspaceId },
            });
            if (data.preferences) {
                setPrefs(p => ({ ...p, ...data.preferences }));
            }
        } catch (err) {
            setError('Failed to load preferences');
            console.error('[NotificationPreferences] fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [workspaceId]);

    useEffect(() => {
        fetchPrefs();
    }, [fetchPrefs]);

    const handleToggle = (key) => {
        setPrefs(p => ({ ...p, [key]: !p[key] }));
        setSaved(false);
    };

    const handleSave = async () => {
        if (!workspaceId) return;
        setSaving(true);
        setError(null);
        try {
            const { data } = await api.patch('/api/notifications/preferences', prefs, {
                params: { workspaceId },
            });
            if (data.preferences) setPrefs(p => ({ ...p, ...data.preferences }));
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } catch (err) {
            setError('Failed to save preferences');
            console.error('[NotificationPreferences] save error:', err);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12 text-gray-400">
                <Loader2 size={20} className="animate-spin mr-2" />
                <span className="text-sm">Loading preferences...</span>
            </div>
        );
    }

    return (
        <div className="max-w-lg mx-auto">
            {/* Header */}
            <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                    <Bell size={16} className="text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Notification Preferences</h3>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">Choose what alerts you receive</p>
                </div>
            </div>

            {/* Preference rows */}
            <div className="space-y-1">
                {PREF_ITEMS.map(({ key, label, description, Icon, color }) => (
                    <div
                        key={key}
                        className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
                    >
                        <div className={`flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center bg-gray-100 dark:bg-gray-800 ${color}`}>
                            <Icon size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{label}</p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">{description}</p>
                        </div>
                        {/* Toggle */}
                        <button
                            onClick={() => handleToggle(key)}
                            className={`flex-shrink-0 relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                                prefs[key]
                                    ? 'bg-indigo-500'
                                    : 'bg-gray-300 dark:bg-gray-600'
                            }`}
                            aria-label={`Toggle ${label}`}
                        >
                            <span
                                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                                    prefs[key] ? 'translate-x-4' : 'translate-x-0.5'
                                }`}
                            />
                        </button>
                    </div>
                ))}
            </div>

            {/* Error */}
            {error && (
                <p className="text-xs text-red-500 mt-3 text-center">{error}</p>
            )}

            {/* Save button */}
            <div className="mt-4 flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        saved
                            ? 'bg-emerald-500 text-white'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    } disabled:opacity-60`}
                >
                    {saving ? (
                        <><Loader2 size={12} className="animate-spin" /> Saving...</>
                    ) : saved ? (
                        <><Save size={12} /> Saved!</>
                    ) : (
                        <><Save size={12} /> Save Preferences</>
                    )}
                </button>
            </div>
        </div>
    );
}
