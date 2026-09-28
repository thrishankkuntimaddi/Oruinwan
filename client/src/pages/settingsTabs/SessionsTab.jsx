import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Monitor, MonitorSmartphone, RefreshCw, Smartphone, Tablet } from 'lucide-react';
import api from '@services/api';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import {
    Badge, Button, ConfirmDialog, EmptyState, ErrorState, LoadingState, Notice, PageIntro, Row, Section, errorMessage,
} from './settingsUi';
import './account/account.css';

const ICONS = { mobile: Smartphone, tablet: Tablet, desktop: Monitor };

const relativeTime = (value) => {
    if (!value) return null;
    const then = new Date(value).getTime();
    if (Number.isNaN(then)) return null;
    const mins = Math.round((Date.now() - then) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours} h ago`;
    const days = Math.round(hours / 24);
    if (days < 7) return `${days} d ago`;
    return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

const known = (v) => v && !/^unknown$/i.test(String(v).trim());

function SessionRow({ session, busy, onRevoke, onSignOut }) {
    const Icon = ICONS[session.os] || Monitor;
    const title = [session.device, session.browser].filter(known).join(' · ') || 'Unknown device';
    const when = relativeTime(session.lastActive || session.createdAt);
    const meta = [
        known(session.location) ? session.location : null,
        known(session.ip) ? session.ip : null,
        session.current ? 'Active now' : when ? `Last active ${when}` : null,
    ].filter(Boolean).join(' · ');

    return (
        <li className="stg-list-item stg-acc-list-item">
            <div className="stg-acc-device-icon" data-current={session.current ? 'true' : undefined} aria-hidden="true">
                <Icon size={16} />
            </div>
            <div className="stg-acc-item-main">
                <div className="stg-acc-item-title">
                    <span>{title}</span>
                    {session.current && <Badge tone="accent">This device</Badge>}
                </div>
                {meta && <div className="stg-acc-item-meta">{meta}</div>}
            </div>
            <div className="stg-acc-item-actions">
                {session.current ? (
                    <Button size="sm" icon={LogOut} onClick={onSignOut} loading={busy}>Sign out</Button>
                ) : (
                    <Button size="sm" variant="danger-soft" onClick={() => onRevoke(session)} loading={busy}
                        aria-label={`Revoke ${title}`}>
                        Revoke
                    </Button>
                )}
            </div>
        </li>
    );
}

const SessionsTab = () => {
    const { logout } = useAuth();
    const { showToast } = useToast();
    const navigate = useNavigate();

    const [sessions, setSessions] = useState([]);
    const [status, setStatus] = useState('loading'); // loading | ready | error
    const [error, setError] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [busyId, setBusyId] = useState(null);
    const [confirmOthers, setConfirmOthers] = useState(false);
    const [signingOutOthers, setSigningOutOthers] = useState(false);

    const load = useCallback(async ({ quiet = false } = {}) => {
        if (quiet) setRefreshing(true);
        else setStatus('loading');
        try {
            const { data } = await api.get('/api/auth/sessions');
            const list = Array.isArray(data) ? data : Array.isArray(data?.sessions) ? data.sessions : [];
            setSessions(list);
            setStatus('ready');
        } catch (err) {
            if (quiet) showToast(errorMessage(err, 'Could not refresh your devices'), 'error');
            else { setError(errorMessage(err, 'Could not load your devices')); setStatus('error'); }
        } finally {
            setRefreshing(false);
        }
    }, [showToast]);

    useEffect(() => { load(); }, [load]);

    const revoke = async (session) => {
        setBusyId(session.id);
        try {
            await api.delete(`/api/auth/sessions/${session.id}`);
            setSessions((list) => list.filter((s) => s.id !== session.id));
            showToast('Device signed out', 'success');
        } catch (err) {
            showToast(errorMessage(err, 'Could not sign out that device'), 'error');
        } finally {
            setBusyId(null);
        }
    };

    const signOutHere = async (session) => {
        setBusyId(session.id);
        try {
            await logout();
        } finally {
            navigate('/login', { replace: true });
        }
    };

    const signOutOthers = async () => {
        setSigningOutOthers(true);
        try {
            await api.delete('/api/auth/sessions/others');
            setConfirmOthers(false);
            showToast('Signed out of all other devices', 'success');
            await load({ quiet: true });
        } catch (err) {
            setConfirmOthers(false);
            showToast(errorMessage(err, 'Could not sign out your other devices'), 'error');
        } finally {
            setSigningOutOthers(false);
        }
    };

    const others = sessions.filter((s) => !s.current);

    return (
        <>
            <PageIntro title="Devices" description="Where you're signed in right now." />

            <Section
                title="Active sessions"
                description={status === 'ready' ? `${sessions.length} ${sessions.length === 1 ? 'device' : 'devices'}` : undefined}
                action={(
                    <Button size="sm" variant="ghost" icon={RefreshCw} onClick={() => load({ quiet: true })}
                        loading={refreshing} disabled={status === 'loading'}>
                        Refresh
                    </Button>
                )}
            >
                {status === 'loading' && <LoadingState label="Loading your devices…" />}
                {status === 'error' && <ErrorState message={error} onRetry={() => load()} />}
                {status === 'ready' && sessions.length === 0 && (
                    <EmptyState icon={MonitorSmartphone}>No active sessions found.</EmptyState>
                )}
                {status === 'ready' && sessions.length > 0 && (
                    <ul className="stg-list" aria-label="Signed-in devices">
                        {sessions.map((s) => (
                            <SessionRow
                                key={s.id}
                                session={s}
                                busy={busyId === s.id}
                                onRevoke={revoke}
                                onSignOut={() => signOutHere(s)}
                            />
                        ))}
                    </ul>
                )}
            </Section>

            {status === 'ready' && others.length > 0 && (
                <Section>
                    <Row
                        stack
                        label="Sign out all other devices"
                        description={`Ends ${others.length} other ${others.length === 1 ? 'session' : 'sessions'}. This device stays signed in.`}
                    >
                        <Button size="sm" variant="danger-soft" icon={LogOut} onClick={() => setConfirmOthers(true)}>Sign out others</Button>
                    </Row>
                </Section>
            )}

            <Notice tone="warning">
                <strong>Unrecognised device?</strong> Revoke it, then <Link to="/settings?tab=security" className="stg-acc-link">change your password</Link> and turn on two-factor authentication.
            </Notice>

            <ConfirmDialog
                open={confirmOthers}
                title="Sign out all other devices?"
                confirmLabel="Sign out others"
                tone="danger"
                loading={signingOutOthers}
                onConfirm={signOutOthers}
                onCancel={() => setConfirmOthers(false)}
            >
                Every other browser and app signed in to your account will need to sign in again.
            </ConfirmDialog>
        </>
    );
};

export default SessionsTab;
