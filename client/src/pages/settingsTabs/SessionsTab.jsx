import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Laptop, LogOut, Monitor, MonitorSmartphone, Pencil, QrCode, RefreshCw, Smartphone, X } from 'lucide-react';
import api from '@services/api';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { getDeviceId } from '../../utils/deviceId';
import {
    Badge, Button, ConfirmDialog, EmptyState, ErrorState, IconButton, Input, LoadingState, Notice, PageIntro, Row, Section, errorMessage,
} from './settingsUi';
import './account/account.css';
import SignInPhoneDialog from '../../components/security/SignInPhoneDialog';

const ICONS = { ios: Smartphone, android: Smartphone, web: Monitor, desktop: Laptop };
const PLATFORM_LABEL = { ios: 'iOS', android: 'Android', web: 'Web', desktop: 'Desktop app', unknown: null };
const SIGN_IN_LABEL = { qr: 'QR code', password: 'password', google: 'Google', oauth: 'Google', passkey: 'a passkey' };

/** "Signed in with a QR code · approved by iPhone" from device.signIn. */
export function signInText(device) {
    const s = device?.signIn;
    if (!s?.method) return null;
    const how = SIGN_IN_LABEL[s.method] || (String(s.method).startsWith('sso') ? 'single sign-on' : null);
    const by = s.approvedBy?.deviceName ? `approved by ${s.approvedBy.deviceName}` : null;
    return [how ? `Signed in with ${how}` : null, by].filter(Boolean).join(' · ') || null;
}
export const DEVICE_NAME_MAX = 64;

/** The X-Device-Id header so the server can tell which device is this one. */
function deviceHeaders() {
    try {
        const id = getDeviceId();
        return id ? { 'X-Device-Id': id } : {};
    } catch { return {}; }
}

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

const known = (v) => v && !/^unknown( device)?$/i.test(String(v).trim());

/** Title for a device row: the custom name, else the name the device reported. */
export const deviceTitle = (device) => [device?.customName, device?.deviceName, device?.reportedName].find(known) || 'Unknown device';

/** Kept for older callers: title of a legacy session row. */
export const sessionTitle = (session) => [session.device, session.browser].filter(known).join(' · ') || 'Unknown device';

const signedInSince = (value) => {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

/** One line of details under a device's title. */
export function deviceMeta(device) {
    const title = deviceTitle(device);
    const when = relativeTime(device.lastActiveAt || device.createdAt);
    const since = signedInSince(device.createdAt);
    return [
        PLATFORM_LABEL[device.platform] || null,
        known(device.reportedName) && device.customName && !title.includes(device.reportedName) ? device.reportedName : null,
        device.location || null,
        known(device.ipAddress) ? device.ipAddress : null,
        device.isCurrent ? 'Active now' : when ? `Last active ${when}` : null,
        since ? `First seen ${since}` : null,
        device.sessionCount > 1 ? `${device.sessionCount} sessions` : null,
    ].filter(Boolean).join(' · ');
}

function DeviceRow({ device, busy, onRevoke, onSignOut, onRename }) {
    const Icon = ICONS[device.platform] || Monitor;
    const title = deviceTitle(device);
    const meta = deviceMeta(device);
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState('');
    const [saving, setSaving] = useState(false);

    const startEdit = () => { setName(device.customName || ''); setEditing(true); };
    const submit = async (e) => {
        e.preventDefault();
        setSaving(true);
        const ok = await onRename(device, name.trim());
        setSaving(false);
        if (ok) setEditing(false);
    };

    return (
        <li className="stg-list-item stg-acc-list-item">
            <div className="stg-acc-device-icon" data-current={device.isCurrent ? 'true' : undefined} aria-hidden="true">
                <Icon size={16} />
            </div>
            <div className="stg-acc-item-main">
                {editing ? (
                    <form className="stg-acc-inline" onSubmit={submit}>
                        <Input
                            aria-label={`Name for ${title}`}
                            value={name}
                            maxLength={DEVICE_NAME_MAX}
                            placeholder={device.reportedName || 'Device name'}
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false); }}
                            autoFocus
                        />
                        <IconButton label="Save name" type="submit" disabled={saving}><Check size={14} /></IconButton>
                        <IconButton label="Cancel rename" onClick={() => setEditing(false)} disabled={saving}><X size={14} /></IconButton>
                    </form>
                ) : (
                    <div className="stg-acc-item-title">
                        <span>{title}</span>
                        {device.isCurrent && <Badge tone="accent">This device</Badge>}
                        {device.revoked && <Badge tone="danger">Revoked</Badge>}
                    </div>
                )}
                {meta && <div className="stg-acc-item-meta">{meta}</div>}
                {signInText(device) && <div className="stg-acc-item-meta">{signInText(device)}</div>}
            </div>
            <div className="stg-acc-item-actions">
                {!editing && !device.revoked && (
                    <Button size="sm" variant="ghost" icon={Pencil} onClick={startEdit} aria-label={`Rename ${title}`}>Rename</Button>
                )}
                {device.isCurrent ? (
                    <Button size="sm" icon={LogOut} onClick={onSignOut} loading={busy}>Sign out</Button>
                ) : !device.revoked && (
                    <Button size="sm" variant="danger-soft" onClick={() => onRevoke(device)} loading={busy}
                        aria-label={`Sign out ${title}`}>
                        Sign out
                    </Button>
                )}
            </div>
        </li>
    );
}

/**
 * Settings → Devices: every device signed in to this account (GET /api/v2/devices),
 * with rename (PATCH), revoke (DELETE — ends its sessions and push tokens) and
 * "revoke all others".
 */
const SessionsTab = () => {
    const { logout } = useAuth();
    const { showToast } = useToast();
    const navigate = useNavigate();

    const [devices, setDevices] = useState([]);
    const [status, setStatus] = useState('loading'); // loading | ready | error
    const [error, setError] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [busyId, setBusyId] = useState(null);
    const [confirmOthers, setConfirmOthers] = useState(false);
    const [pendingRevoke, setPendingRevoke] = useState(null);
    const [signingOutOthers, setSigningOutOthers] = useState(false);
    const [phoneQr, setPhoneQr] = useState(false);

    const load = useCallback(async ({ quiet = false } = {}) => {
        if (quiet) setRefreshing(true);
        else setStatus('loading');
        try {
            const { data } = await api.get('/api/v2/devices', { headers: deviceHeaders() });
            const list = Array.isArray(data?.devices) ? data.devices : [];
            // This device first, then most recently active.
            list.sort((a, b) => (b.isCurrent - a.isCurrent) || (new Date(b.lastActiveAt || 0) - new Date(a.lastActiveAt || 0)));
            setDevices(list);
            setStatus('ready');
        } catch (err) {
            if (quiet) showToast(errorMessage(err, 'Could not refresh your devices'), 'error');
            else { setError(errorMessage(err, 'Could not load your devices')); setStatus('error'); }
        } finally {
            setRefreshing(false);
        }
    }, [showToast]);

    useEffect(() => { load(); }, [load]);

    const signOutHere = async () => {
        try {
            await logout();
        } finally {
            navigate('/login', { replace: true });
        }
    };

    const rename = async (device, name) => {
        try {
            const { data } = await api.patch(`/api/v2/devices/${encodeURIComponent(device.deviceId)}`, { name: name || null }, { headers: deviceHeaders() });
            const next = data?.device || { ...device, customName: name || null, deviceName: name || device.reportedName };
            setDevices((list) => list.map((d) => (d.deviceId === device.deviceId ? { ...d, ...next, isCurrent: d.isCurrent } : d)));
            showToast(name ? 'Device renamed' : 'Device name reset', 'success');
            return true;
        } catch (err) {
            showToast(errorMessage(err, 'Could not rename that device'), 'error');
            return false;
        }
    };

    const revoke = async (device) => {
        setBusyId(device.deviceId);
        try {
            const { data } = await api.delete(`/api/v2/devices/${encodeURIComponent(device.deviceId)}`, { headers: deviceHeaders() });
            if (data?.isCurrentDevice) { await signOutHere(); return; }
            setDevices((list) => list.filter((d) => d.deviceId !== device.deviceId));
            showToast('Device signed out', 'success');
        } catch (err) {
            showToast(errorMessage(err, 'Could not sign out that device'), 'error');
        } finally {
            setBusyId(null);
            setPendingRevoke(null);
        }
    };

    const signOutOthers = async () => {
        setSigningOutOthers(true);
        try {
            const { data } = await api.post('/api/v2/devices/revoke-others', {}, { headers: deviceHeaders() });
            setConfirmOthers(false);
            const n = data?.revokedCount ?? data?.devicesRevoked;
            showToast(typeof n === 'number' ? `Signed out of ${n} other ${n === 1 ? 'device' : 'devices'}` : 'Signed out of all other devices', 'success');
            await load({ quiet: true });
        } catch (err) {
            setConfirmOthers(false);
            showToast(errorMessage(err, 'Could not sign out your other devices'), 'error');
        } finally {
            setSigningOutOthers(false);
        }
    };

    const active = devices.filter((d) => !d.revoked);
    const others = active.filter((d) => !d.isCurrent);

    return (
        <>
            <PageIntro
                title="Devices"
                description="Phones, computers and browsers signed in to your account."
                action={<Button size="sm" variant="primary" icon={QrCode} onClick={() => setPhoneQr(true)}>Sign in a phone</Button>}
            />

            <Section
                title="Your devices"
                description={status === 'ready' ? `${active.length} ${active.length === 1 ? 'device' : 'devices'}` : undefined}
                action={(
                    <Button size="sm" variant="ghost" icon={RefreshCw} onClick={() => load({ quiet: true })}
                        loading={refreshing} disabled={status === 'loading'}>
                        Refresh
                    </Button>
                )}
            >
                {status === 'loading' && <LoadingState label="Loading your devices…" />}
                {status === 'error' && <ErrorState message={error} onRetry={() => load()} />}
                {status === 'ready' && active.length === 0 && (
                    <EmptyState icon={MonitorSmartphone}>No signed-in devices found.</EmptyState>
                )}
                {status === 'ready' && active.length > 0 && (
                    <ul className="stg-list" aria-label="Signed-in devices">
                        {active.map((d) => (
                            <DeviceRow
                                key={d.deviceId}
                                device={d}
                                busy={busyId === d.deviceId}
                                onRevoke={setPendingRevoke}
                                onSignOut={signOutHere}
                                onRename={rename}
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
                        description={`Signs out ${others.length} other ${others.length === 1 ? 'device' : 'devices'} and removes their push notifications. This device stays signed in.`}
                    >
                        <Button size="sm" variant="danger-soft" icon={LogOut} onClick={() => setConfirmOthers(true)}>Sign out others</Button>
                    </Row>
                </Section>
            )}

            <Notice tone="warning">
                <strong>Unrecognised device?</strong> Sign it out, then <Link to="/settings?tab=security" className="stg-acc-link">change your password</Link> and turn on two-factor authentication.
            </Notice>

            <SignInPhoneDialog open={phoneQr} onClose={() => { setPhoneQr(false); load({ quiet: true }); }} />

            <ConfirmDialog
                open={!!pendingRevoke}
                title="Sign out this device?"
                confirmLabel="Sign out device"
                tone="danger"
                loading={!!pendingRevoke && busyId === pendingRevoke.deviceId}
                onConfirm={() => revoke(pendingRevoke)}
                onCancel={() => setPendingRevoke(null)}
            >
                {pendingRevoke ? `${deviceTitle(pendingRevoke)} will need to sign in again and stops getting notifications.` : null}
            </ConfirmDialog>

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
