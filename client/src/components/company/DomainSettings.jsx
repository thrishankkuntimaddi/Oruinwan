import React, { useState } from 'react';
import { Shield, CheckCircle2, RefreshCw, Trash2, Copy } from 'lucide-react';
import api from '@services/api';
import { useToast } from '../../contexts/ToastContext';
import { Panel, Btn, Chip, Confirm, errorMessage } from '../company-dash/dashUi';

/** Domain verification via a DNS TXT record (generate → verify → clear). */
const DomainSettings = ({ companyId, verified: initiallyVerified = false }) => {
    const { showToast } = useToast();
    const [status, setStatus] = useState(initiallyVerified ? 'verified' : null);
    const [tokenData, setTokenData] = useState(null);
    const [busy, setBusy] = useState(null);
    const [confirmClear, setConfirmClear] = useState(false);

    const call = async (name, fn) => {
        setBusy(name);
        try { return await fn(); } catch (err) { showToast(errorMessage(err), 'error'); return null; } finally { setBusy(null); }
    };

    const generate = () => call('gen', async () => {
        const { data } = await api.post(`/api/companies/${companyId}/domain/generate`);
        setTokenData(data);
        setStatus('generated');
    });
    const verify = () => call('verify', async () => {
        const { data } = await api.post(`/api/companies/${companyId}/domain/verify`);
        if (data.domainVerified) { setStatus('verified'); showToast('Domain verified', 'success'); } else showToast('Record not found yet — DNS changes can take a while.', 'info');
    });
    const clear = () => call('clear', async () => {
        await api.post(`/api/companies/${companyId}/domain/clear`);
        setStatus(null); setTokenData(null); setConfirmClear(false);
        showToast('Verification cleared', 'success');
    });

    const record = tokenData?.instructions?.[0] || tokenData?.token || '';

    return (
        <Panel title="Domain verification" icon={Shield} action={status === 'verified' ? <Chip tone="success"><CheckCircle2 size={11} /> Verified</Chip> : null}>
            {status === 'verified' ? (
                <p className="cd-hint" style={{ margin: 0, fontSize: 13 }}>People with this email domain can join the company automatically (if auto-join is on).</p>
            ) : status === 'generated' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <p className="cd-hint" style={{ margin: 0, fontSize: 13 }}>Add this TXT record to your DNS, then check.</p>
                    <button type="button" className="gl-input" style={{ height: 'auto', padding: 10, textAlign: 'left', fontFamily: 'ui-monospace, monospace', fontSize: 12, wordBreak: 'break-all', cursor: 'copy' }}
                        onClick={() => { navigator.clipboard?.writeText(record); showToast('Copied', 'success'); }}>
                        <Copy size={12} style={{ verticalAlign: '-2px', marginRight: 6 }} />{record}
                    </button>
                    <div className="cd-head-actions">
                        <Btn variant="primary" icon={RefreshCw} loading={busy === 'verify'} onClick={verify}>Check status</Btn>
                        <Btn variant="danger" icon={Trash2} onClick={() => setConfirmClear(true)}>Clear</Btn>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <p className="cd-hint" style={{ margin: 0, fontSize: 13, flex: 1 }}>Verify your company domain to enable auto-join for people with your email domain.</p>
                    <Btn loading={busy === 'gen'} onClick={generate}>Verify domain</Btn>
                </div>
            )}
            <Confirm open={confirmClear} title="Clear verification?" tone="danger" confirmLabel="Clear" busy={busy === 'clear'} onClose={() => setConfirmClear(false)} onConfirm={clear}>
                This removes the verification token. You will need to verify the domain again.
            </Confirm>
        </Panel>
    );
};

export default DomainSettings;
