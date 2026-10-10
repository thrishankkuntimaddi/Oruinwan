// Settings. Sections follow the web app (Account, Preferences, Assistant, Workspace)
// plus app-only ones: Updates, Server connection, and Data & storage.
import { useEffect, useState } from 'react';
import {
  User, KeyRound, Laptop, Smartphone, Monitor, Bell, Palette, Lock, Sparkles, Plug, Building2, Download, Server, Database, Info, LogOut,
  ExternalLink, ShieldCheck, Moon, Sun, SunMoon, CircleCheck, RefreshCw, FlaskConical, Trash2, FileCode, ScrollText, Bug, Globe, Eraser, Fingerprint, MessageSquareText,
} from 'lucide-react';
import { nav } from '../../app/nav.js';
import { api, useSession, useWorkspace } from '../../data/session.js';
import { useSessions } from '../../data/hooks.js';
import { clearQueries, invalidate, setQueryData, useQuery } from '../../data/query.js';
import { useAppearance, TEXT_SIZES } from '../../app/theme.js';
import { useUpdate, checkForUpdate } from '../../update/updater.js';
import { useFlags, FLAG_LABELS } from '../../config/flags.js';
import { setAnalyticsEnabled } from '../../config/remote.js';
import { firebaseConfig, RELEASES_PAGE, REPO, BUILD_TIME } from '../../config/env.js';
import { prefs } from '../../native/storage.js';
import { isNative, openExternal, platform } from '../../native/index.js';
import { probeServer } from '../../data/live/server.js';
import { Body, Header, Screen } from '../../ui/Screen.jsx';
import { Button } from '../../ui/Button.jsx';
import { Field, Segmented, Toggle } from '../../ui/Controls.jsx';
import { Row, RowGroup, Section } from '../../ui/List.jsx';
import { ActionSheet, Dialog } from '../../ui/Overlay.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { SkeletonRows } from '../../ui/Feedback.jsx';
import { cx } from '../../ui/cx.js';
import { shortAgo } from '../../lib/time.js';
import { toast } from '../../lib/bus.js';
import { BrandMark } from '../../app/BrandMark.jsx';
import { UpdateButton, UpdateDetails, UpdateProgress } from '../update/UpdatePanel.jsx';

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
  const mode = useSession((s) => s.mode);
  const server = useSession((s) => s.server);
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
      <Header title="Settings" />
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
            <Row icon={Server} tile="accent" title="Server" value={mode === 'demo' ? 'Demo' : server.replace(/^https?:\/\//, '')} onClick={() => nav.push('settings.server')} />
            <Row icon={Database} tile="accent" title="Data & storage" onClick={() => nav.push('settings.data')} />
            {labs && <Row icon={FlaskConical} tile="accent" title="Labs" subtitle="Feature flags on this device" onClick={() => nav.push('settings.updates')} />}
          </RowGroup>
        </Section>

        <Section title="Support">
          <RowGroup>
            <Row icon={Info} tile="accent" title="About Oruinwan" onClick={() => nav.push('settings.about')} />
            <Row icon={Bug} tile="accent" title="Report a problem" trailing={External} onClick={() => openExternal(`https://github.com/${REPO}/issues/new`)} />
          </RowGroup>
        </Section>

        <Section>
          <RowGroup>
            <Row icon={LogOut} danger title={mode === 'demo' ? 'Leave the demo' : 'Sign out'} chevron={false} onClick={() => setSignOut(true)} />
          </RowGroup>
        </Section>
        <p className="mt-6 text-center text-xs text-text-3">
          Oruinwan {current} · {platform === 'web' ? 'Web preview' : 'Android'}
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
        title={mode === 'demo' ? 'Leave the demo?' : 'Sign out?'}
        body={
          mode === 'demo'
            ? 'Your demo changes stay on this phone in case you come back.'
            : 'Messages you can read now will need your password again to unlock on this phone.'
        }
        confirmLabel={mode === 'demo' ? 'Leave' : 'Sign out'}
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
  ready: { label: 'Unlocked on this phone', tone: 'text-success' },
  locked: { label: 'Locked. Sign in again to unlock', tone: 'text-warning' },
  password_required: { label: 'Locked. Sign in again to unlock', tone: 'text-warning' },
  no_identity: { label: 'Not set up yet (set up on the web)', tone: 'text-text-2' },
  unsupported: { label: 'Not available for this account type yet', tone: 'text-text-2' },
  error: { label: "Couldn't check", tone: 'text-danger' },
};

export function SecuritySettings() {
  const web = useWebLink();
  const { data, loading } = useQuery('security', () => api().securityStatus());
  const e2ee = E2EE_TEXT[data?.e2ee] || E2EE_TEXT.error;
  return (
    <Screen>
      <Header title="Password & security" />
      <Body>
        {loading ? (
          <SkeletonRows count={3} />
        ) : (
          <>
            <Section title="End-to-end encryption">
              <RowGroup footer="Messages are encrypted on the sender's device and only decrypted on yours. Your password unlocks your keys; it is never stored on this phone.">
                <Row icon={ShieldCheck} tile="success" title="Encryption keys" subtitle={<span className={e2ee.tone}>{e2ee.label}</span>} />
              </RowGroup>
            </Section>
            <Section title="Sign-in">
              <RowGroup>
                <Row icon={KeyRound} title="Change password" trailing={External} disabled={!web()} onClick={web('/settings?tab=security')} />
                <Row
                  icon={Fingerprint}
                  title="Two-factor authentication"
                  value={data?.twoFactor ? 'On' : 'Off'}
                  trailing={External}
                  disabled={!web()}
                  onClick={web('/settings?tab=security')}
                />
              </RowGroup>
              {!web() && <p className="mx-5 mt-2 text-xs text-text-2">Available when you're signed in to your own server.</p>}
            </Section>
          </>
        )}
      </Body>
    </Screen>
  );
}

const DEVICE_ICON = (s) => (/android|iphone|pixel|phone/i.test(`${s.device} ${s.os}`) ? Smartphone : /mac|windows|linux|pc/i.test(`${s.device} ${s.os}`) ? Laptop : Monitor);

export function DevicesSettings() {
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
                    subtitle={[s.client, s.os, s.location, s.current ? 'This phone' : s.lastActive && `Active ${shortAgo(s.lastActive)}`].filter(Boolean).join(' · ')}
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
        body="That device will need to sign in again. This phone stays signed in."
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
  { key: 'meetings', title: 'Meetings', subtitle: 'Reminders before meetings start' },
  { key: 'email', title: 'Email notifications', subtitle: 'A digest when you have been away' },
];

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
        <div className="mx-4 mt-1 flex gap-3 rounded-card border border-accent/30 bg-accent/10 p-3.5 text-[13px]">
          <Icon as={Info} size="sm" className="mt-0.5 shrink-0 text-accent-ink" />
          <span className="text-text-2">
            <span className="font-medium text-text">Push notifications on Android are coming in the next update.</span> For now, new activity shows in the
            app's badges and Notifications list. These settings already apply to your other devices.
          </span>
        </div>
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
      </Body>
    </Screen>
  );
}

function ThemeCard({ value, label, icon, selected, onSelect }) {
  const swatch = value === 'light' ? ['#f5f4f2', '#ffffff', '#1a1916'] : value === 'dark' ? ['#0c0c0c', '#161616', '#e4e4e4'] : ['#0c0c0c', '#f5f4f2', '#b8956a'];
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
          <p className="mx-5 mt-2 text-xs text-text-2">Saved on this phone only, so each device can look the way you like.</p>
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
        <Section title="On this phone">
          <RowGroup footer="Past AI conversations are stored on this phone only.">
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
        body="This removes past AI conversations for this workspace from this phone."
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
  const { status, manifest, currentVersion, checkedAt, error } = useUpdate();
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
        <div className="mt-3 flex gap-2.5 px-4">
          <Button variant="secondary" block icon={RefreshCw} loading={checking || status === 'checking'} onClick={check}>
            Check now
          </Button>
          <Button variant="secondary" block icon={ScrollText} onClick={() => openExternal(RELEASES_PAGE)}>
            Release notes
          </Button>
        </div>
        <p className="mx-5 mt-3 text-xs leading-relaxed text-text-2">
          The app checks for updates when it opens, at most every few hours. Updates install over this version and keep your data.
          {isNative ? ' Android asks you to confirm each install.' : ''}
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
        {mode === 'demo' ? (
          <>
            <Section title="Connection">
              <RowGroup footer="The demo runs entirely on this phone. Nothing is sent to a server.">
                <Row icon={FlaskConical} tile="accent" title="Demo workspace" subtitle="Sample data on this device" chevron={false} />
              </RowGroup>
            </Section>
            <div className="mt-4 px-4">
              <Button block onClick={() => useSession.getState().signOut()}>
                Sign in to your server
              </Button>
            </div>
          </>
        ) : (
          <>
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
          </>
        )}
      </Body>
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Switch server?"
        body="You'll be signed out of this server on this phone."
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
  const mode = useSession((s) => s.mode);
  const web = useWebLink();
  const [confirm, setConfirm] = useState(null); // 'cache' | 'device' | 'demo'
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      if (confirm === 'cache') {
        clearQueries();
        invalidate('');
        toast('Cached data cleared. It reloads as you use the app.');
      } else if (confirm === 'demo') {
        await api().resetDemo();
        clearQueries();
        await useSession.getState().loadWorkspaces();
        toast('Demo data reset', 'success');
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
    demo: { title: 'Reset the demo?', body: 'All changes you made in the demo are replaced with the original sample data.', label: 'Reset demo' },
    device: {
      title: 'Clear this device?',
      body: 'Signs you out and removes everything Oruinwan stored on this phone: settings, cached messages and AI conversations. Your account and server data are not touched.',
      label: 'Clear device',
    },
  }[confirm || 'cache'];
  return (
    <Screen>
      <Header title="Data & storage" />
      <Body>
        <Section title="On this phone">
          <RowGroup>
            <Row icon={RefreshCw} title="Clear cached data" subtitle="Keeps you signed in" chevron={false} onClick={() => setConfirm('cache')} />
            {mode === 'demo' && <Row icon={FlaskConical} title="Reset demo data" subtitle="Back to the original sample workspace" chevron={false} onClick={() => setConfirm('demo')} />}
            <Row icon={Trash2} danger title="Clear this device" subtitle="Sign out and remove all local data" chevron={false} onClick={() => setConfirm('device')} />
          </RowGroup>
        </Section>
        <Section title="Your account">
          <RowGroup footer={web() ? 'These open the web app, where you can confirm with your password.' : 'Available when you are signed in to your own server.'}>
            <Row icon={Download} title="Download your data" trailing={External} disabled={!web()} onClick={web('/settings?tab=data')} />
            <Row icon={Trash2} danger title="Delete account" trailing={External} disabled={!web()} onClick={web('/settings?tab=data')} />
          </RowGroup>
        </Section>
      </Body>
      <Dialog open={Boolean(confirm)} onClose={() => setConfirm(null)} title={copy.title} body={copy.body} confirmLabel={copy.label} danger={confirm !== 'cache'} busy={busy} onConfirm={run} />
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
