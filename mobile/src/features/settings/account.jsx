// Account security and data, natively: two-factor authentication (QR + code), a copy of your
// data and message retention. (Devices, including their encryption keys, are under Settings → Devices.)
import { useState } from 'react';
import { Copy, Download, ExternalLink, Fingerprint, Gavel, ShieldCheck } from 'lucide-react';
import { api, useSession } from '../../data/session.js';
import { invalidate, setQueryData, useQuery } from '../../data/query.js';
import { toast } from '../../lib/bus.js';
import { copyText, isNative, openExternal, saveJson } from '../../native/index.js';
import { Body, Header, Screen } from '../../ui/Screen.jsx';
import { Button } from '../../ui/Button.jsx';
import { Field, Segmented } from '../../ui/Controls.jsx';
import { SkeletonRows } from '../../ui/Feedback.jsx';
import { Row, RowGroup, Section } from '../../ui/List.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { exportFileName } from '../admin/adminUi.js';

const codeOk = (c) => /^\d{6}$/.test(c.trim());

export function TwoFactorSettings() {
  const { data, loading } = useQuery('security', () => api().securityStatus());
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const enabled = Boolean(data?.twoFactor);

  const start = async () => {
    setBusy(true);
    try {
      setSetup(await api().twoFactorSetup());
    } catch (err) {
      toast(err.message || "Couldn't start two-factor setup", 'danger');
    } finally {
      setBusy(false);
    }
  };
  const confirm = async () => {
    setBusy(true);
    try {
      if (enabled) await api().twoFactorDisable(code.trim());
      else await api().twoFactorEnable(code.trim());
      setQueryData('security', (s) => ({ ...s, twoFactor: !enabled }));
      invalidate('security');
      toast(enabled ? 'Two-factor authentication is off' : 'Two-factor authentication is on', 'success');
      setSetup(null);
      setCode('');
    } catch (err) {
      toast(err.message || "That code didn't work. Try the newest one.", 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header title="Two-factor authentication" />
      <Body>
        {loading ? (
          <SkeletonRows count={3} />
        ) : enabled ? (
          <div className="px-4">
            <div className="flex items-center gap-3 rounded-card border border-line-soft bg-surface p-4">
              <Icon as={ShieldCheck} className="text-success" />
              <p className="text-[15px]">On. Signing in asks for a code from your authenticator app.</p>
            </div>
            <Field className="mt-5" label="To turn it off, enter a current code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" />
            <Button className="mt-3" variant="danger" block loading={busy} disabled={!codeOk(code)} onClick={confirm}>
              Turn off two-factor
            </Button>
          </div>
        ) : !setup ? (
          <div className="px-4">
            <p className="text-[15px] leading-relaxed text-text-2">
              Add a second step to signing in: a six-digit code from an authenticator app (Google Authenticator, 1Password, Authy…), so a stolen password isn't enough.
            </p>
            <Button className="mt-5" block icon={Fingerprint} loading={busy} onClick={start}>
              Set up two-factor
            </Button>
          </div>
        ) : (
          <div className="px-4">
            <p className="text-[15px] text-text-2">1. Scan this with your authenticator app{isNative ? ', or open it there directly' : ''}.</p>
            {setup.qrDataUrl ? (
              <div className="mt-4 grid place-items-center">
                <img src={setup.qrDataUrl} alt="Two-factor QR code" width={208} height={208} className="rounded-2xl bg-white p-3" />
              </div>
            ) : null}
            <div className="mt-4 flex gap-2.5">
              {isNative && setup.otpauthUrl && (
                <Button variant="secondary" block icon={ExternalLink} onClick={() => openExternal(setup.otpauthUrl)}>
                  Open in app
                </Button>
              )}
              <Button variant="secondary" block icon={Copy} onClick={async () => toast((await copyText(setup.secret)) ? 'Key copied' : "Couldn't copy", 'neutral')}>
                Copy key
              </Button>
            </div>
            <p className="selectable mt-2 break-all text-center font-mono text-[13px] text-text-3">{setup.secret}</p>
            <p className="mt-6 text-[15px] text-text-2">2. Enter the code it shows.</p>
            <Field className="mt-2" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" aria-label="Six-digit code" />
            <Button className="mt-3" block loading={busy} disabled={!codeOk(code)} onClick={confirm}>
              Turn on two-factor
            </Button>
          </div>
        )}
      </Body>
    </Screen>
  );
}

const RETENTION = [
  { value: 0, label: 'Forever' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: 365, label: '1 year' },
];

export function AccountDataSettings() {
  const user = useSession((s) => s.user);
  const retention = useQuery('retention', () => api().retentionPolicy());
  const [busy, setBusy] = useState(false);
  const exportData = async () => {
    setBusy(true);
    try {
      const data = await api().exportMyData();
      const result = await saveJson(exportFileName(`${user?.username || 'my'}-data`), data);
      if (result === 'copied') toast('Your data was copied to the clipboard', 'success');
      else if (result === 'saved') toast('Your data was downloaded', 'success');
    } catch (err) {
      toast(err.message || "Couldn't export your data", 'danger');
    } finally {
      setBusy(false);
    }
  };
  const setRetention = async (days) => {
    setQueryData('retention', (r) => ({ ...r, days: days || null }));
    try {
      await api().setRetentionPolicy(days || null);
    } catch (err) {
      toast(err.message || "Couldn't save that", 'danger');
      invalidate('retention');
    }
  };
  const current = retention.data?.days || 0;
  const options = RETENTION.some((o) => o.value === current) ? RETENTION : [...RETENTION, { value: current, label: `${current} days` }];
  return (
    <Screen>
      <Header title="Your data" />
      <Body>
        <Section title="Download a copy">
          <RowGroup footer="Your profile, settings, workspaces, tasks, notes and recent account activity, as JSON. Messages are encrypted, so their text isn't part of this export.">
            <Row icon={Download} tile="accent" title="Export my data" trailing={busy ? <span className="text-xs text-text-3">Preparing…</span> : null} onClick={exportData} />
          </RowGroup>
        </Section>
        <Section title="Keep my messages">
          {retention.loading ? (
            <SkeletonRows count={1} avatar={false} />
          ) : (
            <>
              <div className="px-4">
                <Segmented size="sm" options={options} value={current} onChange={setRetention} />
              </div>
              <p className="mx-5 mt-2 text-xs leading-relaxed text-text-2">
                {retention.data?.legalHold ? 'Your account is under a legal hold, so nothing is deleted until it is lifted.' : 'Messages you sent that are older than this are deleted from the server.'}
              </p>
            </>
          )}
        </Section>
        {retention.data?.legalHold && (
          <Section>
            <RowGroup>
              <Row icon={Gavel} tile="danger" title="Legal hold" subtitle="Set by your company's admins" chevron={false} />
            </RowGroup>
          </Section>
        )}
      </Body>
    </Screen>
  );
}
