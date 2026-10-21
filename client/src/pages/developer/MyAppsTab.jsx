import React, { useState } from 'react';
import { Boxes, Plus, Send, Undo2, Pencil, Trash2, RefreshCw, Eye, EyeOff, Copy, Check, Bot, Download } from 'lucide-react';
import api from '@services/api';
import { useToast } from '../../contexts/ToastContext';
import {
  Panel, Btn, IconBtn, Chip, Dialog, Field, Confirm, EmptyState, ErrorState, LoadingState, useAsync, errorMessage,
} from '../../components/ui/page';

/**
 * Developer portal → My apps: apps you build for the marketplace. Create a draft,
 * submit it for review by the Oruinwan team, and once approved it is listed for
 * every workspace. Installing grants the app a workspace token with its scopes.
 */

const STATUS = {
  draft: { label: 'Draft', tone: undefined },
  submitted: { label: 'In review', tone: 'warning' },
  approved: { label: 'Listed', tone: 'success' },
  rejected: { label: 'Changes needed', tone: 'danger' },
};
const SCOPE_TEXT = {
  'messages:read': 'Message metadata in public channels (never content)',
  'tasks:read': 'Read tasks',
  'tasks:write': 'Create tasks',
  'files:read': 'List files',
  'users:read': 'List members',
  'channels:read': 'List public channels',
};
const CATEGORIES = ['productivity', 'communication', 'developer', 'automation', 'analytics'];

const EMPTY = {
  name: '', description: '', category: 'productivity', iconUrl: '', homepageUrl: '', webhookUrl: '', redirectUrl: '',
  version: '1.0.0', scopes: [], botEnabled: false, botName: '',
};

function toForm(app) {
  if (!app) return { ...EMPTY };
  return {
    name: app.name || '', description: app.description || '', category: app.category || 'productivity',
    iconUrl: app.iconUrl || '', homepageUrl: app.homepageUrl || '', webhookUrl: app.webhookUrl || '', redirectUrl: app.redirectUrl || '',
    version: app.version || '1.0.0', scopes: app.scopes || [], botEnabled: !!app.botUser?.enabled, botName: app.botUser?.name || '',
  };
}

export function toPayload(form) {
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    category: form.category,
    iconUrl: form.iconUrl.trim() || null,
    homepageUrl: form.homepageUrl.trim() || null,
    webhookUrl: form.webhookUrl.trim() || null,
    redirectUrl: form.redirectUrl.trim() || null,
    version: form.version.trim() || '1.0.0',
    scopes: form.scopes,
    botUser: { enabled: form.botEnabled, name: form.botName.trim() || null },
  };
}

function AppForm({ app, onClose, onSaved }) {
  const [form, setForm] = useState(() => toForm(app));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e && e.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e }));
  const toggleScope = (s) => setForm((f) => ({ ...f, scopes: f.scopes.includes(s) ? f.scopes.filter((x) => x !== s) : [...f.scopes, s] }));

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const res = app
        ? await api.patch(`/api/developer/my-apps/${app._id}`, toPayload(form))
        : await api.post('/api/developer/my-apps', toPayload(form));
      onSaved(res.data.app, res.data.message);
    } catch (err) {
      setError(errorMessage(err, 'Could not save the app'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open title={app ? `Edit ${app.name}` : 'New app'} onClose={onClose} busy={saving}
      lead={app?.status === 'approved' ? 'Saving changes sends a listed app back to review. Existing installs keep working.' : 'Saved as a draft. Submit it for review when it is ready.'}
      footer={(
        <>
          <Btn variant="ghost" onClick={onClose} disabled={saving}>Cancel</Btn>
          <Btn variant="primary" onClick={save} loading={saving} disabled={!form.name.trim() || form.description.trim().length < 10}>Save</Btn>
        </>
      )}>
      {error && <div className="cd-error-text" role="alert">{error}</div>}
      <Field label="Name" htmlFor="app-name"><input id="app-name" className="gl-input" value={form.name} onChange={set('name')} maxLength={60} /></Field>
      <Field label="Description" hint="10–1000 characters. Shown in the marketplace." htmlFor="app-desc">
        <textarea id="app-desc" className="gl-input" rows={3} value={form.description} onChange={set('description')} maxLength={1000} />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
        <Field label="Category" htmlFor="app-cat">
          <select id="app-cat" className="gl-input" value={form.category} onChange={set('category')}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}
          </select>
        </Field>
        <Field label="Version" htmlFor="app-ver"><input id="app-ver" className="gl-input" value={form.version} onChange={set('version')} /></Field>
      </div>
      <Field label="Icon URL" hint="Optional, https" htmlFor="app-icon"><input id="app-icon" className="gl-input" value={form.iconUrl} onChange={set('iconUrl')} placeholder="https://…/icon.png" /></Field>
      <Field label="Webhook URL" hint="Receives signed app.installed / app.uninstalled events with the workspace token." htmlFor="app-hook">
        <input id="app-hook" className="gl-input" value={form.webhookUrl} onChange={set('webhookUrl')} placeholder="https://your-app.example.com/oruinwan/events" />
      </Field>
      <Field label="Redirect URL" hint="Optional. Where admins finish setup after installing." htmlFor="app-redirect">
        <input id="app-redirect" className="gl-input" value={form.redirectUrl} onChange={set('redirectUrl')} placeholder="https://your-app.example.com/setup" />
      </Field>
      <Field label="Homepage" hint="Optional" htmlFor="app-home"><input id="app-home" className="gl-input" value={form.homepageUrl} onChange={set('homepageUrl')} /></Field>
      <Field label="Scopes" hint="The app token gets exactly these permissions in each workspace that installs it.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {Object.entries(SCOPE_TEXT).map(([s, text]) => (
            <label key={s} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
              <input type="checkbox" checked={form.scopes.includes(s)} onChange={() => toggleScope(s)} />
              <code>{s}</code><span style={{ color: 'var(--text-muted)' }}>{text}</span>
            </label>
          ))}
        </div>
      </Field>
      <Field label="Bot user">
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
          <input type="checkbox" checked={form.botEnabled} onChange={set('botEnabled')} />
          Add a bot user to workspaces that install the app
        </label>
        {form.botEnabled && <input aria-label="Bot name" className="gl-input" style={{ marginTop: 6 }} value={form.botName} onChange={set('botName')} placeholder={form.name || 'Bot name'} maxLength={80} />}
      </Field>
    </Dialog>
  );
}

function SecretCell({ app, onRotated }) {
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();
  if (!app.signingSecret) return null;
  const rotate = async () => {
    setBusy(true);
    try {
      const res = await api.post(`/api/developer/my-apps/${app._id}/rotate-secret`);
      onRotated(res.data.signingSecret);
      showToast('Signing secret rotated', 'success');
    } catch (err) {
      showToast(errorMessage(err, 'Could not rotate the secret'), 'error');
    } finally { setBusy(false); }
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 12 }}>
      <span style={{ color: 'var(--text-muted)' }}>Signing secret</span>
      <code>{shown ? app.signingSecret : `${app.signingSecret.slice(0, 10)}••••••`}</code>
      <IconBtn label={shown ? 'Hide secret' : 'Show secret'} onClick={() => setShown((s) => !s)}>{shown ? <EyeOff size={13} /> : <Eye size={13} />}</IconBtn>
      <IconBtn label="Copy secret" onClick={() => navigator.clipboard?.writeText(app.signingSecret).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {})}>
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </IconBtn>
      <IconBtn label="Rotate secret" onClick={rotate} disabled={busy}><RefreshCw size={13} /></IconBtn>
    </div>
  );
}

export default function MyAppsTab() {
  const { showToast } = useToast();
  const { data, loading, error, reload, setData } = useAsync(() => api.get('/api/developer/my-apps').then((r) => r.data.apps || []), []);
  const [editing, setEditing] = useState(null); // app | 'new' | null
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [busy, setBusy] = useState({});

  const replace = (app) => setData((list) => {
    const rest = (list || []).filter((a) => a._id !== app._id);
    return [app, ...rest];
  });

  const act = async (app, action) => {
    setBusy((b) => ({ ...b, [app._id]: action }));
    try {
      if (action === 'delete') {
        await api.delete(`/api/developer/my-apps/${app._id}`);
        setData((list) => (list || []).filter((a) => a._id !== app._id));
        showToast(`${app.name} deleted`, 'success');
      } else {
        const res = await api.post(`/api/developer/my-apps/${app._id}/${action}`);
        replace({ ...app, ...res.data.app, signingSecret: app.signingSecret });
        showToast(res.data.message, 'success');
      }
    } catch (err) {
      showToast(errorMessage(err, 'Something went wrong'), 'error');
    } finally {
      setBusy((b) => ({ ...b, [app._id]: null }));
    }
  };

  return (
    <div className="dp-tab-content" data-testid="my-apps">
      <div className="dp-section-header">
        <div>
          <h2>My apps</h2>
          <p>Build an app for every Oruinwan workspace. The Oruinwan team reviews each app before it is listed in the marketplace.</p>
        </div>
        <Btn variant="primary" icon={Plus} onClick={() => setEditing('new')}>New app</Btn>
      </div>

      {loading ? <LoadingState label="Loading your apps…" />
        : error ? <Panel><ErrorState title="Couldn’t load your apps" message={error} onRetry={reload} /></Panel>
          : !data?.length ? (
            <Panel>
              <EmptyState icon={Boxes} title="No apps yet"
                text="Describe your app, choose the scopes it needs and where it receives its token. Submit it for review when it’s ready."
                action={<Btn variant="primary" icon={Plus} onClick={() => setEditing('new')}>New app</Btn>} />
            </Panel>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {data.map((app) => {
                const st = STATUS[app.status] || STATUS.draft;
                const b = busy[app._id];
                return (
                  <Panel key={app._id}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }} data-testid="my-app-row">
                      <div style={{ flex: 1, minWidth: 220 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: 14 }}>{app.name}</strong>
                          <Chip tone={st.tone}>{st.label}</Chip>
                          <span className="cd-hint">v{app.version} · {app.category}</span>
                          {app.installCount > 0 && <Chip title="Workspaces with this app installed"><Download size={10} />{app.installCount}</Chip>}
                          {app.botUser?.enabled && <Chip><Bot size={10} />Bot user</Chip>}
                        </div>
                        <p style={{ margin: '6px 0', fontSize: 13, color: 'var(--text-secondary)' }}>{app.description}</p>
                        <p className="cd-hint" style={{ margin: 0 }}>Scopes: {app.scopes?.length ? app.scopes.join(', ') : 'none'}</p>
                        {app.review?.note && (app.status === 'rejected' || app.status === 'approved') && (
                          <p style={{ margin: '6px 0 0', fontSize: 12.5, color: app.status === 'rejected' ? 'var(--state-danger)' : 'var(--text-secondary)' }}>
                            Reviewer: {app.review.note}
                          </p>
                        )}
                        <div style={{ marginTop: 8 }}>
                          <SecretCell app={app} onRotated={(secret) => replace({ ...app, signingSecret: secret })} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {(app.status === 'draft' || app.status === 'rejected') && (
                          <Btn size="sm" variant="primary" icon={Send} loading={b === 'submit'} onClick={() => act(app, 'submit')}>Submit for review</Btn>
                        )}
                        {app.status === 'submitted' && (
                          <Btn size="sm" variant="ghost" icon={Undo2} loading={b === 'withdraw'} onClick={() => act(app, 'withdraw')}>Withdraw</Btn>
                        )}
                        {app.status !== 'submitted' && <Btn size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing(app)}>Edit</Btn>}
                        <IconBtn label={`Delete ${app.name}`} onClick={() => setConfirmDelete(app)}><Trash2 size={14} /></IconBtn>
                      </div>
                    </div>
                  </Panel>
                );
              })}
            </div>
          )}

      <Panel title="How installs work">
        <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
          <li>A workspace admin installs your listed app from the marketplace.</li>
          <li>Oruinwan issues an app token (used as <code>X-Api-Key</code> on <code>/api/public/v1</code>) with your scopes, plus a bot token if you asked for a bot user.</li>
          <li>Your webhook URL gets <code>POST {'{ event: "app.installed", appId, data: { workspaceId, token, botToken, scopes } }'}</code>, signed with <code>X-Oruinwan-Signature: sha256=HMAC(secret, body)</code>. The admin also sees the token once.</li>
          <li>Uninstalling revokes the tokens and sends <code>app.uninstalled</code>.</li>
        </ol>
      </Panel>

      {editing && (
        <AppForm app={editing === 'new' ? null : editing} onClose={() => setEditing(null)}
          onSaved={(app, message) => {
            const prev = editing === 'new' ? null : editing;
            replace({ ...app, signingSecret: app.signingSecret || prev?.signingSecret });
            setEditing(null);
            showToast(message || 'App saved', 'success');
          }} />
      )}
      <Confirm open={Boolean(confirmDelete)} title={`Delete ${confirmDelete?.name}?`} confirmLabel="Delete app" tone="danger"
        onConfirm={() => { const a = confirmDelete; setConfirmDelete(null); act(a, 'delete'); }}
        onClose={() => setConfirmDelete(null)}>
        The app is removed from the marketplace and uninstalled from every workspace; all its tokens stop working.
      </Confirm>
    </div>
  );
}
