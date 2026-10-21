// Settings → Backup: an encrypted copy of your Oruinwan data in your own Google Drive (a hidden
// app folder; one file that every backup replaces). Connect / change account, automatic on/off,
// back up now, preview + restore, disconnect. Contract: docs/api/backup.md.
import { useEffect, useState } from 'react';
import { Check, CloudUpload, HardDriveDownload, LogOut, RefreshCcw, UserRoundCog } from 'lucide-react';
import { api, useSession } from '../../data/session.js';
import { setQueryData, useQuery } from '../../data/query.js';
import { isNative, onAppState, openExternal } from '../../native/index.js';
import { prefs } from '../../native/storage.js';
import { on, toast } from '../../lib/bus.js';
import { Body, Header, Screen } from '../../ui/Screen.jsx';
import { Button } from '../../ui/Button.jsx';
import { Toggle } from '../../ui/Controls.jsx';
import { Row, RowGroup, Section } from '../../ui/List.jsx';
import { Dialog, Sheet } from '../../ui/Overlay.jsx';
import { SkeletonRows } from '../../ui/Feedback.jsx';
import { cx } from '../../ui/cx.js';
import { INCLUDED, NOT_INCLUDED, RESTORE_RULES, formatBytes, restoreRows, restoreSummary, shouldOfferRestore, statusSummary } from './backupInfo.js';

const KEY = 'backup.status';
const when = (d) => (d ? new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Not yet');
const TONE = {
  info: 'border-line-soft bg-surface text-text-2',
  warning: 'border-warning/30 bg-warning/10 text-text',
  danger: 'border-danger/30 bg-danger/10 text-text',
};

function Notice({ tone = 'info', children }) {
  return <p className={cx('mx-4 mt-3 rounded-card border p-3 text-[13px] leading-relaxed', TONE[tone] || TONE.info)}>{children}</p>;
}

/** The restore preview + confirm, shared by Settings and the after-sign-in offer. */
export function RestoreSheet({ open, onClose, onDone }) {
  const [state, setState] = useState({ loading: true });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    setState({ loading: true });
    api()
      .backupPreview()
      .then((plan) => alive && setState({ plan }))
      .catch((err) => alive && setState({ error: err.message || 'Could not read the backup from Google Drive.' }));
    return () => {
      alive = false;
    };
  }, [open]);

  const apply = async () => {
    setBusy(true);
    try {
      const out = await api().backupRestore();
      toast(out.total ? `Restored ${out.total} item${out.total === 1 ? '' : 's'} from Google Drive` : 'Nothing needed restoring', 'success');
      onDone?.(out);
      onClose();
    } catch (err) {
      toast(err.message || 'The restore failed. Nothing was changed.', 'danger');
    } finally {
      setBusy(false);
    }
  };

  const plan = state.plan;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Restore from Google Drive"
      footer={
        <div className="flex gap-2.5 px-4 pt-3">
          <Button variant="secondary" block onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button block icon={HardDriveDownload} loading={busy} disabled={!plan?.total} onClick={apply}>
            {plan?.total ? `Restore ${plan.total}` : 'Nothing to restore'}
          </Button>
        </div>
      }
    >
      {state.loading ? (
        <SkeletonRows count={4} avatar={false} />
      ) : state.error ? (
        <Notice tone="danger">{state.error}</Notice>
      ) : (
        <>
          <p className="px-4 text-[15px] leading-relaxed">
            Backup from <strong>{when(plan.backup?.createdAt)}</strong> · {formatBytes(plan.backup?.size)}. {restoreSummary(plan)}
          </p>
          <div className="mt-3">
            <RowGroup footer={RESTORE_RULES}>
              {restoreRows(plan).map((r) => (
                <Row
                  key={r.key}
                  title={r.label}
                  subtitle={[r.present ? `${r.present} already here` : null, r.skipped ? `${r.skipped} not restored` : null].filter(Boolean).join(' · ') || null}
                  trailing={r.restore ? <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent-ink">{r.restore} to restore</span> : null}
                />
              ))}
            </RowGroup>
          </div>
        </>
      )}
    </Sheet>
  );
}

export function BackupSettings() {
  const { data: s, loading, error, refetch } = useQuery(KEY, () => api().backupStatus(), { staleMs: 5_000 });
  const [busy, setBusy] = useState(null);
  const [waiting, setWaiting] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [deleteFromDrive, setDeleteFromDrive] = useState(false);

  // Back from Google: the app link (phone), or returning to the app (desktop/web browser window).
  useEffect(() => on('backup:returned', () => { setWaiting(false); refetch(); }), [refetch]);
  useEffect(() => {
    if (!waiting) return undefined;
    let off = () => {};
    onAppState((active) => active && refetch()).then((f) => (off = f));
    const onFocus = () => refetch();
    window.addEventListener('focus', onFocus);
    const t = setInterval(refetch, 4000);
    const stop = setTimeout(() => setWaiting(false), 5 * 60_000);
    return () => {
      off();
      window.removeEventListener('focus', onFocus);
      clearInterval(t);
      clearTimeout(stop);
    };
  }, [waiting, refetch]);
  useEffect(() => {
    if (waiting && s?.connected && s.connectedAt && Date.now() - s.connectedAt.getTime() < 10 * 60_000) setWaiting(false);
  }, [waiting, s]);
  useEffect(() => {
    if (s?.status !== 'running') return undefined;
    const t = setTimeout(refetch, 4000);
    return () => clearTimeout(t);
  }, [s, refetch]);

  const run = (name, fn, okMessage) => async () => {
    setBusy(name);
    try {
      const out = await fn();
      if (out && typeof out.connected === 'boolean') setQueryData(KEY, out);
      if (okMessage) toast(typeof okMessage === 'function' ? okMessage(out) : okMessage, 'success');
      return out;
    } catch (err) {
      toast(err.message || 'Something went wrong. Try again.', 'danger');
      refetch();
      return null;
    } finally {
      setBusy(null);
    }
  };

  const connect = run('connect', async () => {
    const { url } = await api().backupConnect(isNative ? 'app' : 'desktop');
    await openExternal(url);
    setWaiting(true);
  });
  const backUp = run('run', () => api().backupRun(), 'Backed up to Google Drive');
  const setAuto = (on) => {
    setQueryData(KEY, (cur) => ({ ...cur, autoBackup: on }));
    run('auto', () => api().backupSetAuto(on))();
  };
  const disconnect = async () => {
    const out = await run('disconnect', () => api().backupDisconnect({ deleteBackup: deleteFromDrive }), (o) =>
      o.deleted ? 'Disconnected, and the backup was deleted from Google Drive' : 'Google Drive disconnected',
    )();
    if (out) setDisconnectOpen(false);
  };

  const summary = statusSummary(s);

  return (
    <Screen>
      <Header title="Backup" />
      <Body>
        <p className="mx-4 mt-1 text-[15px] leading-relaxed text-text-2">
          Keep an encrypted copy of your Oruinwan data in your own Google Drive. It lives in a hidden app folder, so it never clutters your Drive.
        </p>

        {loading ? (
          <SkeletonRows count={4} avatar={false} />
        ) : !s ? (
          <div className="px-4 pt-4">
            <Notice tone="danger">{error?.message || 'Could not load your backup settings.'}</Notice>
            <Button className="mt-3" variant="secondary" block onClick={refetch}>
              Try again
            </Button>
          </div>
        ) : !s.configured ? (
          <Notice>Backup isn't configured on this server. Ask whoever runs your Oruinwan server to set up Google Drive backup.</Notice>
        ) : !s.connected ? (
          <Section title="Google Drive">
            <RowGroup footer="Oruinwan can only see its own backup file, nothing else in your Drive. Your first backup starts as soon as you connect.">
              <Row icon={CloudUpload} tile="accent" title={waiting ? 'Finish in the browser, then come back' : 'Connect Google Drive'} onClick={connect} disabled={busy === 'connect'} />
            </RowGroup>
          </Section>
        ) : (
          <>
            <Section title="Google Drive">
              <RowGroup footer={`One encrypted file, ${s.fileName}, that each backup replaces.`}>
                <Row icon={UserRoundCog} tile="accent" title="Google account" subtitle={s.googleEmail || 'Connected'} value="Change" onClick={connect} disabled={busy === 'connect'} />
                <Row
                  icon={Check}
                  tile={s.status === 'error' || s.status === 'reauth' ? 'danger' : 'success'}
                  title="Last backup"
                  subtitle={s.lastBackupAt ? `${when(s.lastBackupAt)} · ${formatBytes(s.lastBackupSize)}` : 'Not yet'}
                  value={s.status === 'running' ? 'Backing up…' : null}
                />
                <Row
                  title="Back up automatically"
                  subtitle="Every day, and about an hour after you change notes, tasks, pages or meetings"
                  multiline
                  trailing={<Toggle checked={s.autoBackup} onChange={setAuto} label="Back up automatically" disabled={busy === 'auto'} />}
                />
              </RowGroup>
            </Section>
            {summary && <Notice tone={summary.tone}>{summary.text}</Notice>}
            <div className="mx-4 mt-4 flex gap-2.5">
              <Button block icon={RefreshCcw} loading={busy === 'run' || s.status === 'running'} onClick={s.status === 'reauth' ? connect : backUp}>
                {s.status === 'reauth' ? 'Connect again' : 'Back up now'}
              </Button>
              <Button block variant="secondary" icon={HardDriveDownload} onClick={() => setRestoreOpen(true)}>
                Restore
              </Button>
            </div>
          </>
        )}

        {s?.configured && (
          <Section title="What's in the backup">
            <RowGroup footer={`Not included: ${NOT_INCLUDED}`}>
              {INCLUDED.map(([label, detail]) => (
                <Row key={label} title={label} subtitle={detail} multiline />
              ))}
            </RowGroup>
          </Section>
        )}

        {s?.connected && (
          <Section>
            <RowGroup>
              <Row icon={LogOut} danger title="Disconnect Google Drive" chevron={false} onClick={() => { setDeleteFromDrive(false); setDisconnectOpen(true); }} />
            </RowGroup>
          </Section>
        )}
      </Body>

      <RestoreSheet open={restoreOpen} onClose={() => setRestoreOpen(false)} onDone={() => refetch()} />
      <Dialog
        open={disconnectOpen}
        onClose={() => setDisconnectOpen(false)}
        title="Disconnect Google Drive?"
        body={`Automatic backups stop and Oruinwan loses access to ${s?.googleEmail || 'this Google account'}.`}
        confirmLabel={deleteFromDrive ? 'Disconnect and delete' : 'Disconnect'}
        danger
        busy={busy === 'disconnect'}
        onConfirm={disconnect}
      >
        <label className="mt-4 flex items-center gap-3 text-sm">
          <Toggle checked={deleteFromDrive} onChange={setDeleteFromDrive} label="Also delete the backup from Google Drive" />
          Also delete the backup from Google Drive
        </label>
      </Dialog>
    </Screen>
  );
}

/**
 * After sign-in: if Google Drive backup is connected, a backup exists and the account looks
 * empty (new install on a fresh or wiped account), offer the restore once.
 */
export function BackupRestoreOffer() {
  const status = useSession((st) => st.status);
  const userId = useSession((st) => st.user?.id);
  const [offer, setOffer] = useState(null);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const key = `backup.offer.${userId}`;

  useEffect(() => {
    if (status !== 'signed-in' || !userId || prefs.get(key)) return undefined;
    let alive = true;
    const t = setTimeout(() => {
      api()
        .backupStatus?.({ offer: true })
        .then((s) => alive && shouldOfferRestore(s) && setOffer(s))
        .catch(() => {});
    }, 2500);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [status, userId, key]);

  const dismiss = () => {
    prefs.set(key, Date.now());
    setOffer(null);
  };

  return (
    <>
      <Dialog
        open={Boolean(offer)}
        onClose={dismiss}
        title="Restore from Google Drive?"
        body={offer ? `There's a backup of your Oruinwan data in ${offer.googleEmail || 'your Google Drive'} from ${when(offer.lastBackupAt)}. You'll see exactly what comes back before anything changes.` : ''}
        confirmLabel="Review"
        onConfirm={() => {
          dismiss();
          setRestoreOpen(true);
        }}
      />
      <RestoreSheet open={restoreOpen} onClose={() => setRestoreOpen(false)} />
    </>
  );
}
