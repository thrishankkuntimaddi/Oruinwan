// Settings. Sections follow the web app (Account, Preferences, Assistant, Workspace)
// plus app-only ones: Updates, Server connection, and Data & storage.
import { useEffect, useState } from 'react';
import {
  User, KeyRound, Laptop, Smartphone, Monitor, Bell, Pencil, Palette, Lock, Sparkles, Plug, Building2, Download, Server, Database, Info, LogOut,
  ExternalLink, Compass, ShieldCheck, Gauge, ScanQrCode, Moon, Sun, SunMoon, CircleCheck, RefreshCw, FlaskConical, Trash2, FileCode, ScrollText, Bug, Globe, Eraser, Fingerprint, MessageSquareText, BellRing, BellOff, CloudUpload,
} from 'lucide-react';
import { nav } from '../../app/nav.js';
import { api, useSession, useWorkspace } from '../../data/session.js';
import { useSessions } from '../../data/hooks.js';
import { clearQueries, invalidate, setQueryData, useQuery } from '../../data/query.js';
import { useAppearance, TEXT_SIZES } from '../../app/theme.js';
import { useUpdate, checkForUpdate, revertToBuiltInUi } from '../../update/updater.js';
import { useFlags, FLAG_LABELS } from '../../config/flags.js';
import { setAnalyticsEnabled } from '../../config/remote.js';
import { firebaseConfig, RELEASES_PAGE, REPO, BUILD_TIME } from '../../config/env.js';
import { prefs } from '../../native/storage.js';
import { deviceNoun, isAndroid, isDesktop, isIOS, isPlayStore, isWeb, onAppState, openExternal, platformLabel } from '../../native/index.js';
import { usePushState } from '../push/usePushState.js';
import { probeServer } from '../../data/live/server.js';
import { Body, Header, Screen } from '../../ui/Screen.jsx';
import { Button, IconButton } from '../../ui/Button.jsx';
import { openScanToSignIn } from '../auth/ApprovalHost.jsx';
import { Field, Segmented, Toggle } from '../../ui/Controls.jsx';
import { Row, RowGroup, Section } from '../../ui/List.jsx';
import { ActionSheet, Dialog, Sheet } from '../../ui/Overlay.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { SkeletonRows } from '../../ui/Feedback.jsx';
import { cx } from '../../ui/cx.js';
import { shortAgo } from '../../lib/time.js';
import { toast } from '../../lib/bus.js';
import { BrandMark } from '../../app/BrandMark.jsx';
import { UpdateButton, UpdateDetails, UpdateProgress } from '../update/UpdatePanel.jsx';
import { UnlockSheet } from '../chats/E2eeBanner.jsx';
import { useE2ee } from '../../data/e2ee.js';
import { startTour } from '../tour/tourState.js';
export { AccountDataSettings, TwoFactorSettings } from './account.jsx';
export { BackupSettings } from './backup.jsx';

const STATUS = [
  { value: 'active', label: 'Active', color: 'bg-success' },
  { value: 'away', label: 'Away', color: 'bg-warning' },
  { value: 'dnd', label: 'Do not disturb', color: 'bg-danger' },
];

function useWebLink() {
  const mode = useSession((s) => s.mode);
  const server = useSession((s) => s.server);
  return (path = '') => (mode === 'live' && server ? () => openExternal(`${server}${path}`) : null);
}

const External = <Icon as={ExternalLink} size="sm" className="text-text-3" />;

// ---------------------------------------------------------------- Main

export function SettingsScreen() {
  const user = useSession((s) => s.user);
  const workspace = useWorkspace();
  const update = useUpdate((s) => s.status);
  const current = useUpdate((s) => s.currentVersion);
  const labs = useFlags((s) => s.flags.labs);
  const [statusSheet, setStatusSheet] = useState(false);
  const [signOut, setSignOut] = useState(false);

  const setPresence = async (presence) => {
    useSession.getState().setUser({ presence });
    try {
      await api().setPresence(presence);
    } catch (err) {
      toast(err.message || 'Could not update your status', 'danger');
    }
  };

  const presence = STATUS.find((s) => s.value === user?.presence) || STATUS[0];

  return (
    <Screen>
      <Header title="Settings" actions={<IconButton icon={ScanQrCode} label="Scan to sign in" onClick={openScanToSignIn} />} />
      <Body>
        <div className="mx-4 mt-1 flex items-center gap-4 rounded-card border border-line-soft bg-surface p-4" style={{ backgroundImage: 'var(--glass)' }}>
          <Avatar name={user?.name} src={user?.avatarUrl} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[17px] font-semibold">{user?.name}</p>
            <p className="truncate text-[13px] text-text-2">{user?.email}</p>
            <button
              type="button"
              onClick={() => setStatusSheet(true)}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-xs font-medium"
            >
              <span className={cx('h-2 w-2 rounded-full', presence.color)} />
              {presence.label}
            </button>
          </div>
        </div>

        <Section title="Account">
          <RowGroup>
            <Row icon={User} tile="accent" title="Profile" onClick={() => nav.push('settings.profile')} />
            <Row icon={KeyRound} tile="accent" title="Password & security" onClick={() => nav.push('settings.security')} />
            <Row icon={Laptop} tile="accent" title="Devices" onClick={() => nav.push('settings.devices')} />
            <Row icon={ScanQrCode} tile="accent" title="Scan to sign in" subtitle="Sign in on a computer with a QR code" onClick={openScanToSignIn} />
            <Row icon={Download} tile="accent" title="Your data" subtitle="Export a copy, message retention" onClick={() => nav.push('settings.account-data')} />
            <Row icon={CloudUpload} tile="accent" title="Backup" subtitle="Google Drive backup and restore" onClick={() => nav.push('settings.backup')} />
            <Row icon={Gauge} tile="accent" title="Plan & usage" subtitle="Your plan, its limits and what you've used" onClick={() => nav.push('settings.plan')} />
          </RowGroup>
        </Section>

        <Section title="Preferences">
          <RowGroup>
            <Row icon={Bell} tile="accent" title="Notifications" onClick={() => nav.push('settings.notifications')} />
            <Row icon={Palette} tile="accent" title="Appearance" onClick={() => nav.push('settings.appearance')} />
            <Row icon={Lock} tile="accent" title="Privacy" onClick={() => nav.push('settings.privacy')} />
          </RowGroup>
        </Section>

        <Section title="Assistant">
          <RowGroup>
            <Row icon={Sparkles} tile="accent" title="Oruinwan AI" onClick={() => nav.push('settings.ai')} />
          </RowGroup>
        </Section>

        <Section title="Workspace">
          <RowGroup>
            <Row icon={Building2} tile="accent" title={workspace?.name || 'Workspace'} subtitle="Members and workspace settings" onClick={() => nav.push('workspace')} />
            <Row icon={Plug} tile="accent" title="Integrations" onClick={() => nav.push('integrations')} />
            {['owner', 'admin'].includes(workspace?.role) && (
              <Row icon={ShieldCheck} tile="accent" title="Admin" subtitle="Features, permissions, people and compliance" onClick={() => nav.push('admin')} />
            )}
          </RowGroup>
        </Section>

        <Section title="App">
          <RowGroup>
            <Row
              icon={Download}
              tile="accent"
              title="Updates"
              value={update === 'available' || update === 'required' ? null : `v${current}`}
              trailing={
                update === 'available' || update === 'required' ? (
                  <span className="rounded-full bg-gold px-2 py-0.5 text-[11px] font-semibold text-on-accent">New version</span>
                ) : null
              }
              onClick={() => nav.push('settings.updates')}
            />
            <Row icon={Database} tile="accent" title="Data & storage" onClick={() => nav.push('settings.data')} />
            {labs && <Row icon={FlaskConical} tile="accent" title="Labs" subtitle="Feature flags on this device" onClick={() => nav.push('settings.updates')} />}
          </RowGroup>
        </Section>

        <Section title="Support">
          <RowGroup>
            <Row icon={Compass} tile="accent" title="Take the tour again" subtitle="A quick look around the app" onClick={startTour} />
            <Row icon={Info} tile="accent" title="About Oruinwan" onClick={() => nav.push('settings.about')} />
            <Row icon={Bug} tile="accent" title="Report a problem" trailing={External} onClick={() => openExternal(`https://github.com/${REPO}/issues/new`)} />
          </RowGroup>
        </Section>

        <Section>
          <RowGroup>
            <Row icon={LogOut} danger title="Sign out" chevron={false} onClick={() => setSignOut(true)} />
          </RowGroup>
        </Section>
        <p className="mt-6 text-center text-xs text-text-3">
          Oruinwan {current} · {platformLabel}
        </p>
      </Body>

      <ActionSheet
        open={statusSheet}
        onClose={() => setStatusSheet(false)}
        title="Your status"
        actions={STATUS.map((s) => ({ label: `${s.label}${s.value === presence.value ? '  ✓' : ''}`, onSelect: () => setPresence(s.value) }))}
      />
      <Dialog
        open={signOut}
        onClose={() => setSignOut(false)}
        title="Sign out?"
        body={`Messages you can read now will need your password again to unlock on this ${deviceNoun}.`}
        confirmLabel="Sign out"
        danger
        onConfirm={() => {
          setSignOut(false);
          useSession.getState().signOut();
        }}
      />
    </Screen>
  );
}

// ---------------------------------------------------------------- Account

export function ProfileSettings() {
  const user = useSession((s) => s.user);
  const web = useWebLink();
  const [name, setName] = useState(user?.name || '');
  const [about, setAbout] = useState(user?.about || '');
  const [busy, setBusy] = useState(false);
  const dirty = name.trim() !== (user?.name || '') || about.trim() !== (user?.about || '');
  const save = async () => {
    if (!name.trim()) return toast('Your name cannot be empty', 'danger');
    setBusy(true);
    try {
      const saved = await api().updateMe({ name: name.trim(), about: about.trim() });
      useSession.getState().setUser(saved);
      toast('Profile saved', 'success');
    } catch (err) {
      toast(err.message || 'Could not save your profile', 'danger');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen>
      <Header title="Profile" />
      <Body>
        <div className="flex flex-col items-center pt-2 pb-4">
          <Avatar name={name || user?.name} src={user?.avatarUrl} size="xl" />
          {web('/settings?tab=profile') ? (
            <button type="button" className="mt-3 text-[13px] font-medium text-accent-ink" onClick={web('/settings?tab=profile')}>
              Change photo in the web app
            </button>
          ) : (
            <p className="mt-3 text-xs text-text-3">Photos can be changed in the web app.</p>
          )}
        </div>
        <div className="space-y-4 px-4">
          <Field label="Display name" value={name} onChange={(e) => setName(e.target.value)} />
          <Field label="About" multiline value={about} onChange={(e) => setAbout(e.target.value)} placeholder="A line about you" />
          <Field label="Email" value={user?.email || ''} readOnly hint="Email addresses are managed in the web app." />
          <Button block loading={busy} disabled={!dirty} onClick={save}>
            Save changes
          </Button>
        </div>
      </Body>
    </Screen>
  );
}

const E2EE_TEXT = {
  ready: { label: `Unlocked on this ${deviceNoun}`, tone: 'text-success' },
  password_required: { label: `Locked on this ${deviceNoun}. Unlock once (password or another device)`, tone: 'text-warning' },
  no_identity: { label: 'Not set up yet (set up on the web)', tone: 'text-text-2' },
  unsupported: { label: 'Not available for this account type yet', tone: 'text-text-2' },
  error: { label: "Couldn't check", tone: 'text-danger' },
};

export function SecuritySettings() {
  const web = useWebLink();
  const { data, loading } = useQuery('security', () => api().securityStatus());
  const status = useE2ee((s) => s.status);
  const e2ee = E2EE_TEXT[status] || E2EE_TEXT.error;
  const [unlock, setUnlock] = useState(false);
  return (
    <Screen>
      <Header title="Password & security" />
      <Body>
        {loading ? (
          <SkeletonRows count={3} />
        ) : (
          <>
            <Section title="Message encryption">
              <RowGroup footer="Messages are encrypted in transit and at rest. Oruinwan's server keeps a sealed copy of your key so your devices unlock automatically.">
                <Row
                  icon={ShieldCheck}
                  tile="success"
                  title="Encryption keys"
                  subtitle={<span className={e2ee.tone}>{e2ee.label}</span>}
                  trailing={
                    status === 'password_required' || status === 'error' ? (
                      <Button size="sm" onClick={() => setUnlock(true)}>
                        Unlock
                      </Button>
                    ) : null
                  }
                />
              </RowGroup>
            </Section>
            <Section title="Sign-in">
              <RowGroup>
                <Row icon={KeyRound} title="Change password" trailing={External} disabled={!web()} onClick={web('/settings?tab=security')} />
                <Row icon={Fingerprint} title="Two-factor authentication" value={data?.twoFactor ? 'On' : 'Off'} onClick={() => nav.push('settings.twofactor')} />
                {/* Passkeys are tied to the web origin (WebAuthn relying party); the app's WebView can't use them yet. */}
                <Row icon={KeyRound} title="Passkeys" subtitle="Set up on the web" trailing={External} disabled={!web()} onClick={web('/settings?tab=security')} />
              </RowGroup>
              {!web() && <p className="mx-5 mt-2 text-xs text-text-2">Available when you're signed in to your own server.</p>}
            </Section>
          </>
        )}
      </Body>
      <UnlockSheet open={unlock} onClose={() => setUnlock(false)} />
    </Screen>
  );
}

const DEVICE_ICON = (s) => (/android|iphone|pixel|phone/i.test(`${s.device} ${s.os}`) ? Smartphone : /mac|windows|linux|pc/i.test(`${s.device} ${s.os}`) ? Laptop : Monitor);
const PLATFORM_ICON = { ios: Smartphone, android: Smartphone, desktop: Laptop, web: Globe };
const PLATFORM_LABEL = { ios: 'iPhone / iPad app', android: 'Android app', desktop: 'Desktop app', web: 'Browser' };

/**
 * Devices: every device signed in to your account (/api/v2/devices). Each one also holds the
 * keys that decrypt your messages and the push token notifications go to, so signing one out
 * removes all of that at once. Older servers without the device API show sign-in sessions.
 */
export function DevicesSettings() {
  const { data: devices, loading } = useQuery('devices', () => api().deviceList?.() ?? null);
  if (loading) {
    return (
      <Screen>
        <Header title="Devices" />
        <Body>
          <SkeletonRows count={3} />
        </Body>
      </Screen>
    );
  }
  return devices ? <DeviceList devices={devices} /> : <SessionList />;
}

function DeviceList({ devices }) {
  const [menu, setMenu] = useState(null);
  const [rename, setRename] = useState(null);
  const [name, setName] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const others = devices.filter((d) => !d.current);

  const saveName = async () => {
    setBusy(true);
    try {
      await api().renameDevice(rename.id, name);
      invalidate('devices');
      setRename(null);
      toast('Device renamed', 'success');
    } catch (err) {
      toast(err.message || "Couldn't rename the device", 'danger');
    } finally {
      setBusy(false);
    }
  };
  const signOut = async () => {
    setBusy(true);
    try {
      if (confirm === 'others') await api().signOutOtherDevices();
      else await api().signOutDevice(confirm.id);
      invalidate('devices', 'sessions');
      toast('Signed out', 'success');
      setConfirm(null);
    } catch (err) {
      toast(err.message || 'Could not sign that device out', 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header title="Devices" subtitle={`${devices.length} signed in`} />
      <Body onRefresh={() => invalidate('devices')}>
        <Section title="Where you're signed in">
          <RowGroup footer="Each device holds the keys that unlock your messages and gets your push notifications. Signing one out removes both, and frees its place: you can be signed in on a limited number of devices at once.">
            {devices.map((d) => (
              <Row
                key={d.id}
                icon={PLATFORM_ICON[d.platform] || Monitor}
                tile={d.current ? 'success' : 'neutral'}
                title={d.name}
                subtitle={[
                  PLATFORM_LABEL[d.platform],
                  d.current ? `This ${deviceNoun}` : d.lastActive && `Active ${shortAgo(d.lastActive)}`,
                  d.location,
                  d.approvedBy ? `Approved by ${d.approvedBy}` : d.signInMethod === 'qr' ? 'Signed in with QR' : null,
                  d.pushTokens ? 'Push on' : null,
                ].filter(Boolean).join(' · ')}
                onClick={() => setMenu(d)}
              />
            ))}
          </RowGroup>
        </Section>
        <Section>
          <RowGroup footer="Scan the QR code on a computer's login screen to sign it in.">
            <Row icon={ScanQrCode} title="Scan to sign in" onClick={openScanToSignIn} />
          </RowGroup>
        </Section>
        {others.length > 0 && (
          <Section>
            <RowGroup>
              <Row icon={LogOut} danger title="Sign out all other devices" chevron={false} onClick={() => setConfirm('others')} />
            </RowGroup>
          </Section>
        )}
      </Body>
      <ActionSheet
        open={Boolean(menu)}
        onClose={() => setMenu(null)}
        title={menu?.name}
        actions={[
          {
            label: 'Rename',
            icon: Pencil,
            hint: menu?.reportedName && menu.reportedName !== menu.name ? `Reported as ${menu.reportedName}` : null,
            onSelect: () => {
              setName(menu.customName || menu.name);
              setRename(menu);
            },
          },
          menu && !menu.current && { label: 'Sign out', icon: LogOut, danger: true, onSelect: () => setConfirm(menu) },
          menu?.current && { label: `Sign out of this ${deviceNoun}`, icon: LogOut, danger: true, onSelect: () => useSession.getState().signOut() },
        ]}
      />
      <Sheet
        open={Boolean(rename)}
        onClose={() => setRename(null)}
        title="Rename device"
        footer={<Button block loading={busy} onClick={saveName}>Save</Button>}
      >
        <div className="px-5 pb-4">
          <Field label="Name" value={name} maxLength={64} onChange={(e) => setName(e.target.value)} placeholder={rename?.reportedName || 'Work phone'} autoFocus />
          <p className="mt-2 text-xs text-text-2">Leave it empty to use the name the device reports.</p>
        </div>
      </Sheet>
      <Dialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={confirm === 'others' ? 'Sign out everywhere else?' : `Sign out ${confirm?.name || 'this device'}?`}
        body={`It loses access to your messages and stops getting notifications until it signs in again. This ${deviceNoun} stays signed in.`}
        confirmLabel="Sign out"
        danger
        busy={busy}
        onConfirm={signOut}
      />
    </Screen>
  );
}

/** Sign-in sessions, for servers without the device API. */
function SessionList() {
  const { data, loading } = useSessions();
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const others = (data || []).filter((s) => !s.current);
  const run = async () => {
    setBusy(true);
    try {
      if (confirm === 'others') await api().revokeOtherSessions();
      else await api().revokeSession(confirm.id);
      invalidate('sessions');
      toast('Signed out', 'success');
      setConfirm(null);
    } catch (err) {
      toast(err.message || 'Could not sign that device out', 'danger');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen>
      <Header title="Devices" />
      <Body onRefresh={() => invalidate('sessions')}>
        {loading ? (
          <SkeletonRows count={3} />
        ) : (
          <>
            <Section title="Where you're signed in">
              <RowGroup>
                {(data || []).map((s) => (
                  <Row
                    key={s.id}
                    icon={DEVICE_ICON(s)}
                    tile={s.current ? 'success' : 'neutral'}
                    title={s.device || s.client || 'Unknown device'}
                    subtitle={[s.client, s.os, s.location, s.current ? `This ${deviceNoun}` : s.lastActive && `Active ${shortAgo(s.lastActive)}`].filter(Boolean).join(' · ')}
                    chevron={false}
                    trailing={
                      !s.current && (
                        <Button size="sm" variant="ghost" className="text-danger" onClick={() => setConfirm(s)}>
                          Sign out
                        </Button>
                      )
                    }
                  />
                ))}
              </RowGroup>
            </Section>
            {others.length > 0 && (
              <Section>
                <RowGroup>
                  <Row icon={LogOut} danger title="Sign out all other devices" chevron={false} onClick={() => setConfirm('others')} />
                </RowGroup>
              </Section>
            )}
          </>
        )}
      </Body>
      <Dialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={confirm === 'others' ? 'Sign out everywhere else?' : `Sign out ${confirm?.device || 'this device'}?`}
        body={`That device will need to sign in again. This ${deviceNoun} stays signed in.`}
        confirmLabel="Sign out"
        danger
        busy={busy}
        onConfirm={run}
      />
    </Screen>
  );
}

// ---------------------------------------------------------------- Preferences

const NOTIF_ROWS = [
  { key: 'messages', title: 'Messages & mentions', subtitle: 'Direct messages and @mentions' },
  { key: 'threads', title: 'Thread replies', subtitle: 'Replies in threads you follow' },
  { key: 'tasks', title: 'Tasks', subtitle: 'Assigned to you, status changes, due soon' },
  { key: 'meetings', title: 'Meetings', subtitle: 'Invitations and reminders before meetings start' },
  { key: 'aiSuggestions', title: 'Suggestions', subtitle: 'Nudges about overdue tasks and meeting action items' },
  { key: 'email', title: 'Email notifications', subtitle: 'Mentions and messages while you are away' },
];

const DIGEST_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'off', label: 'Off' },
];

/** The activity digest email: an account setting, the same in every workspace. */
function DigestSection() {
  const { data, loading } = useQuery('accountnotifprefs', () => api().accountNotificationPrefs?.() ?? null);
  if (loading || !data) return null;
  const set = async (value) => {
    setQueryData('accountnotifprefs', (d) => ({ ...d, digestFrequency: value }));
    try {
      await api().saveDigestFrequency(value);
    } catch (err) {
      toast(err.message || 'Could not save', 'danger');
      invalidate('accountnotifprefs');
    }
  };
  return (
    <Section title="Email digest">
      <RowGroup footer="A summary of what happened in your workspaces. Weekly digests arrive on Mondays. Applies to all workspaces.">
        <div className="px-4 py-3">
          <Segmented size="sm" options={DIGEST_OPTIONS} value={data.digestFrequency} onChange={set} />
        </div>
      </RowGroup>
    </Section>
  );
}

const PUSH_TEXT = {
  loading: ['Checking…', null],
  on: ['On', 'Messages, mentions and replies arrive even when the app is closed.'],
  prompt: ['Off', 'Turn them on to know when someone messages or mentions you.'],
  denied: ['Off in system settings', `Allow notifications for Oruinwan in your ${isIOS ? 'iPhone' : 'phone'}'s Settings → Notifications, then come back.`],
  'no-server': ['Not set up on this server', 'Your server admin can turn on push notifications. Until then, activity shows in badges and the Notifications list.'],
  unavailable: ['Not available here', 'Push notifications work in the Android and iPhone apps. Activity shows in badges and the Notifications list.'],
};

/** Push notifications on this phone: their state, and a way to turn them on. */
function ThisDevicePush() {
  const { state, turnOn, refresh } = usePushState();
  const [busy, setBusy] = useState(false);
  // Back from the system Settings app: show the new state.
  useEffect(() => {
    let off = () => {};
    onAppState((active) => active && refresh()).then((f) => (off = f));
    return () => off();
  }, [refresh]);
  const [label, help] = PUSH_TEXT[state] || PUSH_TEXT.unavailable;
  return (
    <Section title={`This ${deviceNoun}`}>
      <RowGroup footer={help}>
        <Row
          icon={state === 'on' ? BellRing : BellOff}
          tile="accent"
          title="Push notifications"
          subtitle={label}
          trailing={
            state === 'prompt' ? (
              <Button
                size="sm"
                loading={busy}
                onClick={async () => {
                  setBusy(true);
                  await turnOn();
                  setBusy(false);
                }}
              >
                Turn on
              </Button>
            ) : null
          }
        />
      </RowGroup>
    </Section>
  );
}

export function NotificationSettings() {
  const ws = useSession((s) => s.workspaceId);
  const workspace = useWorkspace();
  const { data, loading } = useQuery(ws && `notifprefs:${ws}`, () => api().notificationPrefs(ws));
  const set = async (key, value) => {
    setQueryData(`notifprefs:${ws}`, (d) => ({ ...d, [key]: value }));
    try {
      await api().saveNotificationPrefs(ws, { [key]: value });
    } catch (err) {
      toast(err.message || 'Could not save', 'danger');
      invalidate(`notifprefs:${ws}`);
    }
  };
  return (
    <Screen>
      <Header title="Notifications" subtitle={workspace?.name} />
      <Body>
        <ThisDevicePush />
        {loading ? (
          <SkeletonRows count={5} avatar={false} />
        ) : (
          <Section title="Notify me about">
            <RowGroup footer="Settings apply to this workspace only.">
              {NOTIF_ROWS.map((r) => (
                <Row
                  key={r.key}
                  title={r.title}
                  subtitle={r.subtitle}
                  trailing={<Toggle checked={Boolean(data?.[r.key])} onChange={(v) => set(r.key, v)} label={r.title} />}
                />
              ))}
            </RowGroup>
          </Section>
        )}
        <DigestSection />
      </Body>
    </Screen>
  );
}

function ThemeCard({ value, label, icon, selected, onSelect }) {
  const swatch = value === 'light' ? ['#f6f3ee', '#ffffff', '#1a1916'] : value === 'dark' ? ['#0c0c0c', '#161616', '#e4e4e4'] : ['#0c0c0c', '#f6f3ee', '#b8956a'];
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cx('pressable flex flex-1 flex-col items-center gap-2 rounded-card border p-3', selected ? 'border-accent bg-accent/10' : 'border-line bg-surface')}
    >
      <span className="flex h-16 w-full overflow-hidden rounded-lg border border-line">
        {value === 'system' ? (
          <>
            <span className="flex-1" style={{ background: swatch[0] }} />
            <span className="flex-1" style={{ background: swatch[1] }} />
          </>
        ) : (
          <span className="flex flex-1 flex-col gap-1.5 p-2" style={{ background: swatch[0] }}>
            <span className="h-2 w-3/4 rounded" style={{ background: swatch[2], opacity: 0.85 }} />
            <span className="h-2 w-1/2 rounded" style={{ background: swatch[2], opacity: 0.4 }} />
            <span className="mt-auto h-3 w-6 rounded" style={{ background: '#b8956a' }} />
          </span>
        )}
      </span>
      <span className="flex items-center gap-1.5 text-[13px] font-medium">
        <Icon as={icon} size={14} />
        {label}
      </span>
    </button>
  );
}

export function AppearanceSettings() {
  const { theme, textSize, reduceMotion, setTheme, setTextSize, setReduceMotion } = useAppearance();
  return (
    <Screen>
      <Header title="Appearance" />
      <Body>
        <Section title="Theme">
          <div className="flex gap-2.5 px-4">
            <ThemeCard value="system" label="System" icon={SunMoon} selected={theme === 'system'} onSelect={() => setTheme('system')} />
            <ThemeCard value="light" label="Light" icon={Sun} selected={theme === 'light'} onSelect={() => setTheme('light')} />
            <ThemeCard value="dark" label="Dark" icon={Moon} selected={theme === 'dark'} onSelect={() => setTheme('dark')} />
          </div>
          <p className="mx-5 mt-2 text-xs text-text-2">Saved on this {deviceNoun} only, so each device can look the way you like.</p>
        </Section>
        <Section title="Message text size">
          <div className="px-4">
            <Segmented value={textSize} onChange={setTextSize} options={TEXT_SIZES.map((t) => ({ value: t.value, label: t.label }))} />
            <div className="mt-3 rounded-card border border-line-soft bg-surface p-4">
              <p style={{ fontSize: 'var(--msg-size)' }}>The quick brown fox ships the release on Friday.</p>
            </div>
          </div>
        </Section>
        <Section title="Motion">
          <RowGroup>
            <Row title="Reduce motion" subtitle="Fewer animations and transitions" trailing={<Toggle checked={reduceMotion} onChange={setReduceMotion} label="Reduce motion" />} />
          </RowGroup>
        </Section>
      </Body>
    </Screen>
  );
}

export function PrivacySettings() {
  const { data, loading } = useQuery('privacy', () => api().privacyPrefs());
  const [analytics, setAnalytics] = useState(() => prefs.get('privacy.analytics', true));
  const set = async (key, value) => {
    setQueryData('privacy', (d) => ({ ...d, [key]: value }));
    try {
      await api().savePrivacyPrefs({ [key]: value });
    } catch (err) {
      toast(err.message || 'Could not save', 'danger');
      invalidate('privacy');
    }
  };
  return (
    <Screen>
      <Header title="Privacy" />
      <Body>
        {loading ? (
          <SkeletonRows count={3} avatar={false} />
        ) : (
          <Section title="Your account">
            <RowGroup>
              <Row title="Read receipts" subtitle="Let people see when you've read their messages" trailing={<Toggle checked={Boolean(data?.readReceipts)} onChange={(v) => set('readReceipts', v)} label="Read receipts" />} />
              <Row title="Typing indicator" subtitle="Show when you're typing" trailing={<Toggle checked={Boolean(data?.typingIndicator)} onChange={(v) => set('typingIndicator', v)} label="Typing indicator" />} />
              <Row title="Discoverable by email" subtitle="People in your company can find you by email" trailing={<Toggle checked={Boolean(data?.discoverable)} onChange={(v) => set('discoverable', v)} label="Discoverable by email" />} />
            </RowGroup>
          </Section>
        )}
        {firebaseConfig?.measurementId && (
          <Section title="This app">
            <RowGroup footer="Counts like app opens and which screens are used. Never message content, names or emails.">
              <Row
                title="Share anonymous usage stats"
                trailing={
                  <Toggle
                    checked={analytics}
                    onChange={(v) => {
                      setAnalytics(v);
                      setAnalyticsEnabled(v);
                    }}
                    label="Share anonymous usage stats"
                  />
                }
              />
            </RowGroup>
          </Section>
        )}
      </Body>
    </Screen>
  );
}

// ---------------------------------------------------------------- Assistant

export function AiSettings() {
  const ws = useSession((s) => s.workspaceId);
  const web = useWebLink();
  const [confirm, setConfirm] = useState(false);
  const count = prefs.get(`ai.threads.${ws}`, []).length;
  return (
    <Screen>
      <Header title="Oruinwan AI" />
      <Body>
        <Section title="What it can do">
          <div className="mx-4 rounded-card border border-line-soft bg-surface p-4 text-sm leading-relaxed text-text-2">
            Summarise conversations, find what's on your plate, draft messages, and create or update tasks and notes when you ask. It only acts on your
            behalf when you ask it to.
          </div>
        </Section>
        <Section title={`On this ${deviceNoun}`}>
          <RowGroup footer={`Past AI conversations are stored on this ${deviceNoun} only.`}>
            <Row icon={MessageSquareText} title="Saved conversations" value={String(count)} chevron={false} />
            <Row icon={Eraser} danger title="Clear AI conversations" chevron={false} disabled={!count} onClick={() => setConfirm(true)} />
          </RowGroup>
        </Section>
        <Section title="Workspace">
          <RowGroup footer={web() ? null : 'Available when you are signed in to your own server.'}>
            <Row icon={Sparkles} title="Memory, model and smart replies" trailing={External} disabled={!web()} onClick={web('/settings?tab=ai')} />
          </RowGroup>
        </Section>
      </Body>
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Clear AI conversations?"
        body={`This removes past AI conversations for this workspace from this ${deviceNoun}.`}
        confirmLabel="Clear"
        danger
        onConfirm={() => {
          prefs.set(`ai.threads.${ws}`, null);
          setConfirm(false);
          toast('AI conversations cleared');
        }}
      />
    </Screen>
  );
}

// ---------------------------------------------------------------- App

export function UpdateSettings() {
  const { status, manifest, currentVersion, shellVersion, uiSource, checkedAt, error } = useUpdate();
  const flags = useFlags((s) => s.flags);
  const source = useFlags((s) => s.source);
  const [checking, setChecking] = useState(false);
  const check = async () => {
    setChecking(true);
    const result = await checkForUpdate();
    setChecking(false);
    if (result.status === 'current') toast("You're on the latest version", 'success');
  };
  const hasUpdate = status === 'available' || status === 'required';
  return (
    <Screen>
      <Header title="Updates" />
      <Body>
        <div className="mx-4 mt-1 rounded-card border border-line-soft bg-surface p-5" style={{ backgroundImage: 'var(--glass)' }}>
          <div className="flex items-center gap-3.5">
            <BrandMark size={48} />
            <div className="min-w-0 flex-1">
              <p className="text-[17px] font-semibold">
                {hasUpdate ? `Version ${manifest.version} is available` : status === 'current' ? 'Oruinwan is up to date' : status === 'checking' ? 'Checking for updates…' : status === 'unknown' ? "Couldn't check for updates" : `Oruinwan ${currentVersion}`}
              </p>
              <p className="text-[13px] text-text-2">
                You have {currentVersion}
                {shellVersion && shellVersion !== currentVersion ? ` (app ${shellVersion})` : ''}
                {checkedAt ? ` · checked ${shortAgo(checkedAt)}` : ''}
              </p>
            </div>
            {!hasUpdate && status === 'current' && <Icon as={CircleCheck} className="text-success" />}
          </div>
          {hasUpdate && (
            <div className="mt-4">
              <UpdateDetails manifest={manifest} />
              <UpdateProgress />
              <div className="mt-4">
                <UpdateButton />
              </div>
            </div>
          )}
          {status === 'unknown' && error && <p className="mt-3 text-[13px] text-text-2">{error}</p>}
        </div>
        {uiSource === 'downloaded' && (
          <p className="mx-5 mt-3 text-xs leading-relaxed text-text-2">
            Running a quick update.{' '}
            <button
              type="button"
              className="font-medium text-accent"
              onClick={() => {
                if (window.confirm('Go back to the version that came with the app? The app restarts.')) revertToBuiltInUi();
              }}
            >
              Use the version that came with the app
            </button>
          </p>
        )}
        <div className="mt-3 flex gap-2.5 px-4">
          <Button variant="secondary" block icon={RefreshCw} loading={checking || status === 'checking'} onClick={check}>
            Check now
          </Button>
          <Button variant="secondary" block icon={ScrollText} onClick={() => openExternal(RELEASES_PAGE)}>
            Release notes
          </Button>
        </div>
        <p className="mx-5 mt-3 text-xs leading-relaxed text-text-2">
          {isWeb
            ? 'The web app always runs the latest version. Reload the page to pick up a new release.'
            : isIOS
              ? 'Updates come from the App Store (or TestFlight while Oruinwan is in testing) and keep your data.'
              : isPlayStore
                ? 'Small updates install in the app and restart it; bigger ones come from Google Play. Your data is kept.'
              : isDesktop
                ? 'The app checks for updates when it opens, at most every few hours. Install the new version over this one: your data is kept.'
                : 'The app checks for updates when it opens and every few hours. Most updates install in the app and restart it, with no reinstall; updates to the app itself install over this version. Your data is kept.'}
          {isAndroid && !isPlayStore ? ' Android asks you to confirm each full install.' : ''}
        </p>
        <Section title="Features in this version">
          <RowGroup footer={`Source: ${source === 'remote' ? 'remote configuration' : source === 'cached' ? 'last remote configuration' : 'built into this version'}. New features can be switched on remotely without reinstalling.`}>
            {Object.entries(flags).map(([key, on]) => (
              <Row
                key={key}
                title={FLAG_LABELS[key] || key}
                chevron={false}
                trailing={<span className={cx('text-xs font-medium', on ? 'text-success' : 'text-text-3')}>{on ? 'On' : 'Off'}</span>}
              />
            ))}
          </RowGroup>
        </Section>
      </Body>
    </Screen>
  );
}

export function ServerSettings() {
  const mode = useSession((s) => s.mode);
  const server = useSession((s) => s.server);
  const [probe, setProbe] = useState(null);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (mode !== 'live' || !server) return;
    let alive = true;
    probeServer(server).then((p) => alive && setProbe(p));
    return () => {
      alive = false;
    };
  }, [mode, server]);
  return (
    <Screen>
      <Header title="Server" />
      <Body>
        <Section title="Connection">
          <RowGroup>
            <Row icon={Globe} tile="accent" title="Address" subtitle={server} chevron={false} multiline />
            <Row
              icon={probe?.state === 'ok' ? CircleCheck : Server}
              tile={probe?.state === 'ok' ? 'success' : probe ? 'danger' : 'neutral'}
              title="Status"
              subtitle={!probe ? 'Checking…' : probe.state === 'ok' ? `Healthy${probe.insecure ? ' · not HTTPS' : ''}` : probe.message}
              chevron={false}
            />
            <Row icon={ExternalLink} title="Open the web app" onClick={() => openExternal(server)} trailing={External} />
          </RowGroup>
        </Section>
        <Section>
          <RowGroup>
            <Row icon={LogOut} danger title="Sign out and switch server" chevron={false} onClick={() => setConfirm(true)} />
          </RowGroup>
        </Section>
      </Body>
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Switch server?"
        body={`You'll be signed out of this server on this ${deviceNoun}.`}
        confirmLabel="Sign out"
        danger
        onConfirm={() => {
          setConfirm(false);
          useSession.getState().signOut();
        }}
      />
    </Screen>
  );
}

export function DataSettings() {
  const web = useWebLink();
  const [confirm, setConfirm] = useState(null); // 'cache' | 'device' | 'account'
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState('');
  const [mismatch, setMismatch] = useState(false);
  const ask = (kind) => {
    setTyped('');
    setMismatch(false);
    setConfirm(kind);
  };
  const run = async () => {
    if (confirm === 'account' && typed.trim().toUpperCase() !== 'DELETE') {
      setMismatch(true);
      return;
    }
    setBusy(true);
    try {
      if (confirm === 'account') {
        // Erase the account on the server, then sign out and wipe everything stored here.
        try {
          await api().deleteAccount();
        } catch (err) {
          toast(err.message || 'Your account could not be deleted. Try again.', 'danger');
          return;
        }
        setConfirm(null);
        await useSession.getState().signOut({ wipe: true });
        toast('Your account was deleted.', 'success');
        return;
      }
      if (confirm === 'cache') {
        clearQueries();
        invalidate('');
        toast('Cached data cleared. It reloads as you use the app.');
      } else if (confirm === 'device') {
        // Sign out first so nothing syncs back, then wipe everything this app stored.
        await useSession.getState().signOut({ wipe: true });
      }
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  };
  const copy = {
    cache: { title: 'Clear cached data?', body: 'Lists and messages are fetched again from the server. You stay signed in.', label: 'Clear cache' },
    device: {
      title: 'Clear this device?',
      body: `Signs you out and removes everything Oruinwan stored on this ${deviceNoun}: settings, cached messages and AI conversations. Your account and server data are not touched.`,
      label: 'Clear device',
    },
    account: {
      title: 'Delete your account?',
      body: 'This permanently deletes your account and personal data on this server: your profile, private notes, AI memory and encryption keys. Messages you sent stay in their conversations, shown from a deleted user. This cannot be undone.',
      label: 'Delete account',
    },
  }[confirm || 'cache'];
  return (
    <Screen>
      <Header title="Data & storage" />
      <Body>
        <Section title={`On this ${deviceNoun}`}>
          <RowGroup>
            <Row icon={RefreshCw} title="Clear cached data" subtitle="Keeps you signed in" chevron={false} onClick={() => ask('cache')} />
            <Row icon={Trash2} danger title="Clear this device" subtitle="Sign out and remove all local data" chevron={false} onClick={() => ask('device')} />
          </RowGroup>
        </Section>
        <Section title="Your account">
          <RowGroup footer="Downloading your data opens the web app.">
            <Row icon={Download} title="Download your data" trailing={External} disabled={!web()} onClick={web('/settings?tab=data')} />
            <Row icon={Trash2} danger title="Delete account" subtitle="Permanently erase your account" chevron={false} onClick={() => ask('account')} />
          </RowGroup>
        </Section>
      </Body>
      <Dialog open={Boolean(confirm)} onClose={() => setConfirm(null)} title={copy.title} body={copy.body} confirmLabel={copy.label} danger={confirm !== 'cache'} busy={busy} onConfirm={run}>
        {confirm === 'account' && (
          <Field
            className="mt-4"
            label="Type DELETE to confirm"
            value={typed}
            onChange={(e) => {
              setTyped(e.target.value);
              setMismatch(false);
            }}
            error={mismatch ? 'Type DELETE to delete your account.' : null}
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        )}
      </Dialog>
    </Screen>
  );
}

export function AboutSettings() {
  const current = useUpdate((s) => s.currentVersion);
  return (
    <Screen>
      <Header title="About" />
      <Body>
        <div className="flex flex-col items-center px-6 pt-4 pb-2 text-center">
          <BrandMark size={80} glow />
          <h1 className="mt-4 text-2xl font-bold">Oruinwan</h1>
          <p className="mt-1 text-sm text-text-2">The collaboration platform for teams that ship.</p>
          <p className="mt-3 text-xs text-text-3">
            Version {current} · built {new Date(BUILD_TIME).toLocaleDateString()}
          </p>
        </div>
        <Section title="Open source">
          <RowGroup footer="Oruinwan is released under the MIT licence. The Inter typeface is used under the SIL Open Font License 1.1.">
            <Row icon={FileCode} title="Source code" trailing={External} onClick={() => openExternal(`https://github.com/${REPO}`)} />
            <Row icon={Download} title="All releases" trailing={External} onClick={() => openExternal(RELEASES_PAGE)} />
            <Row icon={Bug} title="Report a problem" trailing={External} onClick={() => openExternal(`https://github.com/${REPO}/issues/new`)} />
          </RowGroup>
        </Section>
      </Body>
    </Screen>
  );
}
