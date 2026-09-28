import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import {
    NOTIFICATION_PREF_DEFAULTS,
    fetchAccountNotificationPrefs,
    saveAccountNotificationPrefs,
} from '../../features/notifications/accountNotificationPrefs';
import {
    PageIntro, Section, Row, SwitchRow, Button, Notice, LoadingState, ErrorState, SaveBar, useSettingsForm,
} from './settingsUi';
import './preferences.css';

const supported = () => typeof window !== 'undefined' && 'Notification' in window;
const currentPermission = () => (supported() ? window.Notification.permission : 'unsupported');

/** Browser notification permission, kept fresh when the user returns to the tab. */
function useNotificationPermission() {
    const [permission, setPermission] = useState(currentPermission);
    useEffect(() => {
        const refresh = () => setPermission(currentPermission());
        window.addEventListener('focus', refresh);
        document.addEventListener('visibilitychange', refresh);
        let status;
        // Some browsers report changes made in site settings live.
        navigator.permissions?.query?.({ name: 'notifications' }).then((s) => {
            status = s;
            status.onchange = refresh;
        }).catch(() => { /* not supported */ });
        return () => {
            window.removeEventListener('focus', refresh);
            document.removeEventListener('visibilitychange', refresh);
            if (status) status.onchange = null;
        };
    }, []);
    const request = async () => {
        if (!supported()) return 'unsupported';
        try {
            const result = await window.Notification.requestPermission();
            setPermission(result);
            return result;
        } catch {
            setPermission(currentPermission());
            return currentPermission();
        }
    };
    return [permission, request];
}

function lastWorkspaceId() {
    try { return localStorage.getItem('lastWorkspaceId') || ''; } catch { return ''; }
}

/**
 * Settings → Notifications (account level). Loads and saves
 * /api/auth/me/preferences/notifications; per-workspace preferences live on
 * the workspace Notifications page.
 */
const NotificationsTab = () => {
    const { showToast } = useToast();
    const [permission, requestPermission] = useNotificationPermission();
    const workspaceId = lastWorkspaceId();

    const form = useSettingsForm({
        initial: { ...NOTIFICATION_PREF_DEFAULTS },
        load: fetchAccountNotificationPrefs,
        save: (_values, changed) => saveAccountNotificationPrefs(changed),
        onSaved: () => showToast('Notification preferences saved', 'success'),
        onError: (msg) => showToast(msg, 'error'),
    });

    const intro = (
        <PageIntro
            title="Notifications"
            description="How Oruinwan gets your attention. These apply to every workspace; each workspace can fine-tune them."
        />
    );
    if (form.loading) return <>{intro}<LoadingState label="Loading notification preferences…" /></>;
    if (form.loadError) return <>{intro}<ErrorState message={form.loadError} onRetry={form.reload} /></>;

    const { values, set } = form;

    const allow = async () => {
        const result = await requestPermission();
        if (result === 'granted') showToast('Desktop notifications are allowed', 'success');
        else if (result === 'denied') showToast('Your browser blocked notifications for Oruinwan', 'error');
    };

    const sendTest = () => {
        if (permission !== 'granted') return;
        try {
            const n = new window.Notification('Oruinwan', {
                body: 'Test notification — desktop alerts are working.',
                icon: '/icons/oruinwan-128.png',
                silent: !values.sound,
                tag: 'oruinwan-test',
            });
            n.onclick = () => { window.focus(); n.close(); };
            setTimeout(() => n.close(), 5000);
        } catch {
            // Some mobile browsers only allow notifications from a service worker.
            showToast('This browser can’t show a test notification here.', 'error');
        }
    };

    let permissionNotice = null;
    if (values.desktopPush) {
        if (permission === 'unsupported') {
            permissionNotice = <Notice tone="info">This browser doesn’t support desktop notifications. You’ll still see alerts inside Oruinwan.</Notice>;
        } else if (permission === 'default') {
            permissionNotice = (
                <Notice tone="warning" action={<Button size="sm" variant="primary" onClick={allow}>Allow in browser</Button>}>
                    Your browser hasn’t allowed Oruinwan to show notifications yet.
                </Notice>
            );
        } else if (permission === 'denied') {
            permissionNotice = (
                <Notice tone="warning">
                    Notifications are <strong>blocked</strong> by your browser. Click the icon to the left of the address bar,
                    set <strong>Notifications</strong> to <strong>Allow</strong>, then reload the page.
                </Notice>
            );
        }
    }

    return (
        <>
            {intro}

            <Section
                title="Alerts"
                description="Pop-ups inside Oruinwan and on your desktop."
                action={values.desktopPush && permission === 'granted'
                    ? <Button size="sm" icon={BellRing} onClick={sendTest}>Send a test</Button>
                    : null}
            >
                <SwitchRow
                    label="Desktop notifications"
                    description="Show a system notification when Oruinwan is in the background."
                    checked={values.desktopPush}
                    onChange={(v) => set('desktopPush', v)}
                />
                {permissionNotice && <div className="stg-pref-row-notice">{permissionNotice}</div>}
                <SwitchRow
                    label="Direct messages"
                    description="Alert me when someone sends me a direct message."
                    checked={values.dmNotifications}
                    onChange={(v) => set('dmNotifications', v)}
                />
                <SwitchRow
                    label="Only mentions and direct messages"
                    description="Mute pop-ups for everything else (tasks, meetings, reactions…). They still appear in the bell."
                    checked={values.mentionsOnly}
                    onChange={(v) => set('mentionsOnly', v)}
                />
                <SwitchRow
                    label="Sound"
                    description="Play the system sound with desktop notifications."
                    checked={values.sound}
                    onChange={(v) => set('sound', v)}
                />
            </Section>

            <Section title="Email" description="Delivered to your inbox.">
                <SwitchRow
                    label="Activity digest"
                    description="A summary of what you missed."
                    checked={values.emailDigest}
                    onChange={(v) => set('emailDigest', v)}
                />
                <SwitchRow
                    label="Product news"
                    description="Tips, offers, and Oruinwan news."
                    checked={values.marketingEmails}
                    onChange={(v) => set('marketingEmails', v)}
                />
            </Section>

            {workspaceId && (
                <Section>
                    <Row
                        label="Workspace notifications"
                        description="Choose which activity notifies you in your current workspace — messages, thread replies, tasks, meetings (Settings tab on the Notifications page)."
                    >
                        <Link to={`/workspace/${workspaceId}/notifications`} className="stg-btn stg-pref-linkbtn" data-size="sm">Open</Link>
                    </Row>
                </Section>
            )}

            <SaveBar visible={form.dirty} saving={form.saving} onSave={form.save} onDiscard={form.discard} />
        </>
    );
};

export default NotificationsTab;
