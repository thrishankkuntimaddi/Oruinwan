import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserX } from 'lucide-react';
import api from '@services/api';
import { useToast } from '../../contexts/ToastContext';
import { PRIVACY_DEFAULTS, useApplyPreferences } from '../../hooks/useUserPreferences';
import UserAvatarImage from '../../shared/components/ui/UserAvatarImage';
import {
    PageIntro, Section, SwitchRow, Button, Notice, LoadingState, ErrorState, EmptyState, SaveBar, ConfirmDialog,
    errorMessage, useSettingsForm,
} from './settingsUi';
import './preferences.css';

const ENDPOINT = '/api/auth/me/preferences/privacy';
const KEYS = ['readReceipts', 'typingIndicators', 'allowDiscovery'];

const pick = (data) => {
    const src = data && typeof data === 'object' ? data : {};
    return Object.fromEntries(KEYS.map((k) => [k, typeof src[k] === 'boolean' ? src[k] : PRIVACY_DEFAULTS[k]]));
};

/** Accepts [{_id, username…}] and the older [{ userId: {…}, blockedAt }] shape. */
const normalizeBlocked = (list) => (Array.isArray(list) ? list : [])
    .map((entry) => {
        const u = entry?.userId && typeof entry.userId === 'object' ? entry.userId : entry;
        const id = u?._id || u?.id || (typeof entry?.userId === 'string' ? entry.userId : null);
        return id ? { id: String(id), username: u?.username || 'Unknown user', email: u?.email || '', profilePicture: u?.profilePicture || null } : null;
    })
    .filter(Boolean);

function BlockedPeople() {
    const { showToast } = useToast();
    const [people, setPeople] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [confirm, setConfirm] = useState(null);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data } = await api.get('/api/auth/me/blocked-users');
            setPeople(normalizeBlocked(Array.isArray(data) ? data : data?.blockedUsers || data?.users));
        } catch (err) {
            setError(errorMessage(err, 'Could not load blocked people'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const unblock = async () => {
        if (!confirm) return;
        setBusy(true);
        try {
            await api.delete(`/api/auth/me/blocked-users/${encodeURIComponent(confirm.id)}`);
            setPeople((list) => list.filter((p) => p.id !== confirm.id));
            showToast(`${confirm.username} is unblocked`, 'success');
            setConfirm(null);
        } catch (err) {
            showToast(errorMessage(err, 'Could not unblock'), 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Section title="Blocked people" description="People you've blocked. Unblock someone to let them contact you again.">
            {loading ? <LoadingState inline label="Loading…" />
                : error ? <ErrorState message={error} onRetry={load} />
                    : people.length === 0 ? <EmptyState icon={UserX}>You haven't blocked anyone.</EmptyState>
                        : (
                            <ul className="stg-list" data-testid="blocked-users">
                                {people.map((p) => (
                                    <li key={p.id} className="stg-list-item">
                                        <div className="stg-pref-person">
                                            <UserAvatarImage userId={p.id} name={p.username} src={p.profilePicture} size={30} initialStyle={{ background: 'var(--bg-active)', color: 'var(--text-secondary)' }} />
                                            <div className="stg-pref-person-text">
                                                <div className="stg-pref-person-name">{p.username}</div>
                                                {p.email && <div className="stg-pref-person-mail">{p.email}</div>}
                                            </div>
                                        </div>
                                        <Button size="sm" onClick={() => setConfirm(p)}>Unblock</Button>
                                    </li>
                                ))}
                            </ul>
                        )}
            <ConfirmDialog
                open={!!confirm}
                title={`Unblock ${confirm?.username || ''}?`}
                confirmLabel="Unblock"
                loading={busy}
                onConfirm={unblock}
                onCancel={() => setConfirm(null)}
            >
                They'll be able to message you again.
            </ConfirmDialog>
        </Section>
    );
}

/**
 * Settings → Privacy: what others see about you in conversations, whether you
 * can be found by email, and who you have blocked.
 */
const PrivacyTab = () => {
    const { showToast } = useToast();
    const applyPreferences = useApplyPreferences();

    const form = useSettingsForm({
        initial: { ...PRIVACY_DEFAULTS },
        load: async () => pick((await api.get(ENDPOINT)).data),
        save: async (values) => {
            // Send every field: older servers replace the whole object on PUT.
            const { data } = await api.put(ENDPOINT, pick(values));
            const hasFields = data && typeof data === 'object' && KEYS.some((k) => typeof data[k] === 'boolean');
            return hasFields ? pick({ ...values, ...data }) : pick(values);
        },
        onSaved: (next) => {
            applyPreferences({ privacy: next });
            showToast('Privacy settings saved', 'success');
        },
        onError: (msg) => showToast(msg, 'error'),
    });

    const intro = <PageIntro title="Privacy" description="Control what other people see about your activity and how they can find you." />;
    if (form.loading) return <>{intro}<LoadingState label="Loading your privacy settings…" /></>;
    if (form.loadError) return <>{intro}<ErrorState message={form.loadError} onRetry={form.reload} /></>;

    const { values, set } = form;

    return (
        <>
            {intro}

            <Section title="Conversations" description="What others see while you chat.">
                <SwitchRow
                    label="Read receipts"
                    description="Let others see when you've read their messages. Your own unread badges clear either way."
                    checked={values.readReceipts}
                    onChange={(v) => set('readReceipts', v)}
                />
                <SwitchRow
                    label="Typing indicator"
                    description="Show “typing…” to others while you write a message."
                    checked={values.typingIndicators}
                    onChange={(v) => set('typingIndicators', v)}
                />
            </Section>

            <Section title="Discovery">
                <SwitchRow
                    label="Discoverable by email"
                    description="People outside your workspaces can find you by your email address, for example to start a direct message with you. Turn this off to stay hidden from them."
                    checked={values.allowDiscovery}
                    onChange={(v) => set('allowDiscovery', v)}
                />
            </Section>

            <BlockedPeople />

            <Notice tone="info">
                Oruinwan never sells your personal data. Read the{' '}
                <Link to="/privacy" className="stg-pref-link">Privacy Policy</Link>.
            </Notice>

            <SaveBar visible={form.dirty} saving={form.saving} onSave={form.save} onDiscard={form.discard} />
        </>
    );
};

export default PrivacyTab;
