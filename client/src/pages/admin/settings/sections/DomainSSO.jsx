import React, { useState } from 'react';
import { Globe, Copy, ShieldCheck, RefreshCw, UserPlus } from 'lucide-react';
import api from '@services/api';
import { useCompany } from '../../../../contexts/CompanyContext';
import { useToast } from '../../../../contexts/ToastContext';
import { Panel, Grid, Btn, IconBtn, Chip, errorMessage } from '../../../../components/company-dash/dashUi';
import SettingSwitch from '../../../../components/ui/SettingSwitch';
import '../../../OwnerDashboard/owner.css';

/**
 * Email domain: prove ownership with a DNS TXT record, then optionally let
 * people with that domain join automatically. Uses /api/companies/:id/domain/*.
 */
const DomainSSO = () => {
    const { company, refreshCompanyData, isCompanyAdmin } = useCompany();
    const { showToast } = useToast();
    const [record, setRecord] = useState(null);
    const [busy, setBusy] = useState('');
    const id = company?._id;
    const canEdit = isCompanyAdmin();

    const run = async (key, fn) => {
        setBusy(key);
        try { await fn(); } catch (err) { showToast(errorMessage(err, 'Something went wrong'), 'error'); } finally { setBusy(''); }
    };

    const generate = () => run('gen', async () => {
        const { data } = await api.post(`/api/companies/${id}/domain/generate`);
        setRecord(data);
        showToast('Verification record created', 'success');
    });
    const verify = () => run('verify', async () => {
        await api.post(`/api/companies/${id}/domain/verify`);
        setRecord(null);
        await refreshCompanyData?.();
        showToast('Domain verified', 'success');
    });
    const setAutoJoin = (enabled) => run('auto', async () => {
        await api.put(`/api/companies/${id}/domain/auto-join`, { autoJoinByDomain: enabled });
        await refreshCompanyData?.();
        showToast(enabled ? 'Auto-join turned on' : 'Auto-join turned off', 'success');
    });
    const copy = async (text) => {
        try { await navigator.clipboard.writeText(text); showToast('Copied', 'success'); } catch { showToast('Could not copy', 'error'); }
    };

    if (!company) return null;
    const verified = !!company.domainVerified;

    return (
        <Grid cols="2">
            <Panel title="Email domain" icon={Globe} action={<Chip tone={verified ? 'success' : company.domain ? 'warning' : undefined}>{verified ? 'Verified' : company.domain ? 'Not verified' : 'Not set'}</Chip>}>
                {!company.domain ? (
                    <p className="cd-muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.55 }}>
                        No email domain is on record for your company. It is set when the company is registered; contact Oruinwan support to add one.
                    </p>
                ) : (
                    <div className="od-form">
                        <div className="od-kv">
                            <div className="od-kv-row"><span>Domain</span><span className="od-mono">{company.domain}</span></div>
                        </div>
                        {!verified && (
                            <>
                                <p className="cd-muted" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55 }}>
                                    Add a TXT record to your DNS to prove you own <strong>{company.domain}</strong>, then check it here. DNS changes can take a while to appear.
                                </p>
                                {record?.txtRecord && (
                                    <div className="od-code">
                                        <code className="od-mono">{record.txtRecord}</code>
                                        <IconBtn label="Copy record" onClick={() => copy(record.txtRecord)}><Copy size={14} /></IconBtn>
                                    </div>
                                )}
                                {record?.expiresAt && <span className="cd-hint">Valid until {new Date(record.expiresAt).toLocaleString()}</span>}
                                {canEdit && (
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                        <Btn icon={RefreshCw} loading={busy === 'gen'} onClick={generate}>{record ? 'New record' : 'Create TXT record'}</Btn>
                                        <Btn variant="primary" icon={ShieldCheck} loading={busy === 'verify'} onClick={verify}>Check DNS</Btn>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </Panel>
            <Panel title="Join by domain" icon={UserPlus}>
                <div className="od-switch">
                    <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Auto-join</p>
                        <p className="cd-muted" style={{ fontSize: 12, marginTop: 2, lineHeight: 1.5 }}>
                            People who sign up with an @{company.domain || 'your-domain'} address join the company without an invite.
                            {!verified && ' Verify the domain first.'}
                        </p>
                    </div>
                    <SettingSwitch
                        checked={!!company.autoJoinByDomain}
                        disabled={!canEdit || !verified || busy === 'auto'}
                        onChange={(v) => setAutoJoin(typeof v === 'boolean' ? v : !company.autoJoinByDomain)}
                        label="Auto-join by domain"
                    />
                </div>
            </Panel>
        </Grid>
    );
};

export default DomainSSO;
