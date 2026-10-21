import React, { useEffect, useId, useState } from 'react';
import { KeyRound, Copy, Server, Trash2, Save, ExternalLink } from 'lucide-react';
import api from '@services/api';
import { useToast } from '../../../../contexts/ToastContext';
import {
    Panel, Grid, Btn, IconBtn, Chip, Field, Confirm, LoadingState, ErrorState, errorMessage, useAsync,
} from '../../../../components/company-dash/dashUi';
import SettingSwitch from '../../../../components/ui/SettingSwitch';
import '../../../OwnerDashboard/owner.css';

const ENDPOINT = '/api/auth/sso/saml/config';

const SAML_ERRORS = {
    invalid_entry_point: 'The IdP sign-in URL must be a valid https:// address.',
    invalid_cert: 'The certificate is not a valid PEM / base64 X.509 certificate.',
    invalid_issuer: 'The IdP entity ID (issuer) is missing or invalid.',
};

/** Client-side checks before PUT; the server validates again. Returns { field: message }. */
export function validateSamlForm({ entryPoint, cert, issuer }, { certRequired }) {
    const errors = {};
    const ep = String(entryPoint || '').trim();
    if (!ep) errors.entryPoint = 'Required';
    else if (!/^https?:\/\/[^\s]+$/i.test(ep)) errors.entryPoint = 'Enter a full URL, like https://idp.example.com/sso';
    if (!String(issuer || '').trim()) errors.issuer = 'Required';
    const c = String(cert || '').trim();
    if (certRequired && !c) errors.cert = 'Paste the IdP signing certificate';
    else if (c && !/BEGIN CERTIFICATE/.test(c) && !/^[A-Za-z0-9+/=\s]{100,}$/.test(c)) errors.cert = 'Paste the PEM certificate (-----BEGIN CERTIFICATE-----…) or its base64 body';
    return errors;
}

/** The PUT body: cert is only sent when the admin pasted a new one (it is never returned). */
export function samlPayload(form) {
    const body = {
        entryPoint: String(form.entryPoint || '').trim(),
        issuer: String(form.issuer || '').trim(),
        enabled: !!form.enabled,
        jitProvisioning: !!form.jitProvisioning,
    };
    const cert = String(form.cert || '').trim();
    if (cert) body.cert = cert;
    return body;
}

function CopyRow({ label, value, onCopy }) {
    return (
        <div className="od-kv-row" style={{ alignItems: 'center', gap: 8 }}>
            <span>{label}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                <code className="od-mono" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }} title={value}>{value || '—'}</code>
                {value && <IconBtn label={`Copy ${label}`} onClick={() => onCopy(value)}><Copy size={13} /></IconBtn>}
            </span>
        </div>
    );
}

/**
 * Company SAML 2.0 single sign-on (owner/admin): register Oruinwan at the IdP with the
 * metadata URL / ACS shown here, then paste the IdP's sign-in URL, entity ID and
 * signing certificate. Uses GET/PUT/DELETE /api/auth/sso/saml/config.
 */
export default function SamlSSO() {
    const { showToast } = useToast();
    const uid = useId();
    const { data, loading, error, reload, setData } = useAsync(() => api.get(ENDPOINT).then(r => r.data).catch((err) => {
        if (err?.response?.status === 404) return { disabled: true };
        throw err;
    }), []);
    const [form, setForm] = useState({ entryPoint: '', issuer: '', cert: '', enabled: true, jitProvisioning: false });
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [confirmRemove, setConfirmRemove] = useState(false);
    const [removing, setRemoving] = useState(false);

    useEffect(() => {
        if (!data) return;
        setForm({
            entryPoint: data.entryPoint || '',
            issuer: data.issuer || '',
            cert: '',
            enabled: data.configured ? !!data.enabled : true,
            jitProvisioning: !!data.jitProvisioning,
        });
    }, [data]);

    const copy = async (text) => {
        try { await navigator.clipboard.writeText(text); showToast('Copied', 'success'); } catch { showToast('Could not copy', 'error'); }
    };
    const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: undefined })); };

    const save = async (e) => {
        e?.preventDefault?.();
        const errs = validateSamlForm(form, { certRequired: !data?.configured });
        setErrors(errs);
        if (Object.keys(errs).length) return;
        setSaving(true);
        try {
            const { data: next } = await api.put(ENDPOINT, samlPayload(form));
            setData(next);
            showToast('SAML single sign-on saved', 'success');
        } catch (err) {
            const code = err?.response?.data?.code;
            if (code && SAML_ERRORS[code]) {
                const field = code === 'invalid_entry_point' ? 'entryPoint' : code === 'invalid_cert' ? 'cert' : 'issuer';
                setErrors({ [field]: SAML_ERRORS[code] });
            } else {
                showToast(err?.response?.status === 404 ? 'Single sign-on is not enabled on this server.' : errorMessage(err, 'Could not save SAML settings'), 'error');
            }
        } finally { setSaving(false); }
    };

    const remove = async () => {
        setRemoving(true);
        try {
            const { data: next } = await api.delete(ENDPOINT);
            setData(next);
            setConfirmRemove(false);
            showToast('SAML single sign-on removed', 'success');
        } catch (err) {
            showToast(errorMessage(err, 'Could not remove SAML settings'), 'error');
        } finally { setRemoving(false); }
    };

    if (loading && !data) return <LoadingState label="Loading single sign-on…" />;
    if (error && !data) return <ErrorState title="Could not load single sign-on" message={error} onRetry={reload} />;
    if (data?.disabled) {
        return <ErrorState title="Single sign-on is off on this server" message="The server administrator has to turn on the sso feature before SAML can be configured." onRetry={reload} />;
    }

    const configured = !!data?.configured;

    return (
        <Grid cols="2">
            <Panel title="Oruinwan (service provider)" icon={Server}>
                <div className="od-form">
                    <p className="cd-muted" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55 }}>
                        Register Oruinwan as a SAML application in your identity provider (Okta, Entra ID, Google Workspace, OneLogin…) with these values.
                        Use the email address as the NameID.
                    </p>
                    <div className="od-kv">
                        <CopyRow label="Metadata URL" value={data?.metadataUrl} onCopy={copy} />
                        <CopyRow label="Entity ID" value={data?.entityId} onCopy={copy} />
                        <CopyRow label="ACS URL (POST)" value={data?.acsUrl} onCopy={copy} />
                        <CopyRow label="NameID format" value="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress" onCopy={copy} />
                    </div>
                    {data?.metadataUrl && (
                        <a className="gl-btn gl-btn--sm" href={data.metadataUrl} target="_blank" rel="noreferrer" style={{ alignSelf: 'flex-start' }}>
                            <ExternalLink size={13} /> Open metadata XML
                        </a>
                    )}
                </div>
            </Panel>

            <Panel
                title="Identity provider"
                icon={KeyRound}
                action={<Chip tone={configured ? (data.enabled ? 'success' : 'warning') : undefined}>{configured ? (data.enabled ? 'On' : 'Off') : 'Not set up'}</Chip>}
            >
                <form className="od-form" onSubmit={save} noValidate>
                    <Field label="IdP sign-in URL (SSO URL)" htmlFor={`${uid}-ep`} error={errors.entryPoint} hint="HTTP-Redirect binding">
                        <input id={`${uid}-ep`} className="gl-input" value={form.entryPoint} onChange={e => set('entryPoint', e.target.value)} placeholder="https://idp.example.com/sso/saml" />
                    </Field>
                    <Field label="IdP entity ID (issuer)" htmlFor={`${uid}-iss`} error={errors.issuer}>
                        <input id={`${uid}-iss`} className="gl-input" value={form.issuer} onChange={e => set('issuer', e.target.value)} placeholder="https://idp.example.com/entity" />
                    </Field>
                    <Field
                        label="IdP signing certificate"
                        htmlFor={`${uid}-cert`}
                        error={errors.cert}
                        hint={configured && data.certFingerprint ? `Current: SHA-256 ${data.certFingerprint}. Leave empty to keep it.` : 'PEM, as downloaded from your identity provider'}
                    >
                        <textarea id={`${uid}-cert`} className="gl-input od-mono" rows={5} value={form.cert} onChange={e => set('cert', e.target.value)}
                            placeholder="-----BEGIN CERTIFICATE-----" style={{ resize: 'vertical', fontSize: 11.5 }} />
                    </Field>
                    <div className="od-switch">
                        <div>
                            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Enable SAML sign-in</p>
                            <p className="cd-muted" style={{ fontSize: 12, marginTop: 2 }}>People with your company email use “Sign in with your company SSO”.</p>
                        </div>
                        <SettingSwitch checked={form.enabled} onChange={(v) => set('enabled', typeof v === 'boolean' ? v : !form.enabled)} label="Enable SAML sign-in" />
                    </div>
                    <div className="od-switch">
                        <div>
                            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Create accounts on first sign-in</p>
                            <p className="cd-muted" style={{ fontSize: 12, marginTop: 2 }}>Only for emails on your verified domain.</p>
                        </div>
                        <SettingSwitch checked={form.jitProvisioning} onChange={(v) => set('jitProvisioning', typeof v === 'boolean' ? v : !form.jitProvisioning)} label="Just-in-time provisioning" />
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {configured && <Btn variant="ghost" icon={Trash2} onClick={() => setConfirmRemove(true)}>Remove</Btn>}
                        <Btn type="submit" variant="primary" icon={Save} loading={saving}>Save</Btn>
                    </div>
                    {data?.updatedAt && <span className="cd-hint">Last changed {new Date(data.updatedAt).toLocaleString()}</span>}
                </form>
            </Panel>

            <Confirm open={confirmRemove} title="Remove SAML single sign-on?" confirmLabel="Remove" tone="danger" busy={removing}
                onConfirm={remove} onClose={() => setConfirmRemove(false)}>
                People who sign in with SAML will need another way to sign in (password, Google or a passkey).
            </Confirm>
        </Grid>
    );
}
