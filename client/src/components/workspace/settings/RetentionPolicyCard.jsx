import React, { useEffect, useId, useState } from 'react';
import { Timer, AlertTriangle, CheckCircle2, Save } from 'lucide-react';
import api from '@services/api';
import { Btn } from '../../ui/page';
import '../../../pages/toolkit/toolkit.css';

export const RETENTION_PRESETS = [
    { value: '', label: 'Keep messages forever' },
    { value: '30', label: '30 days' },
    { value: '90', label: '90 days' },
    { value: '180', label: '6 months' },
    { value: '365', label: '1 year' },
    { value: '730', label: '2 years' },
    { value: 'custom', label: 'Custom…' },
];

/** Select value for stored retentionDays (null = forever). */
export function presetFor(days) {
    if (days == null) return '';
    const hit = RETENTION_PRESETS.find(p => p.value === String(days));
    return hit ? hit.value : 'custom';
}

/** retentionDays to send: null, or an integer 1..3650; throws a readable Error otherwise. */
export function parseRetentionDays(preset, custom) {
    if (preset === '') return null;
    const raw = preset === 'custom' ? custom : preset;
    const n = Number(String(raw).trim());
    if (!Number.isInteger(n) || n < 1 || n > 3650) throw new Error('Enter a whole number of days from 1 to 3650.');
    return n;
}

/**
 * Workspace admin → Data: workspace-wide message retention
 * (GET/PATCH /api/compliance/workspaces/:id/retention-policy). Older messages are
 * removed by the daily job; legal hold always wins.
 */
export default function RetentionPolicyCard({ workspaceId }) {
    const uid = useId();
    const [policy, setPolicy] = useState(null);
    const [preset, setPreset] = useState('');
    const [custom, setCustom] = useState('');
    const [status, setStatus] = useState({ state: 'loading', message: '' }); // loading | idle | busy | done | error

    useEffect(() => {
        if (!workspaceId) return undefined;
        let live = true;
        api.get(`/api/compliance/workspaces/${workspaceId}/retention-policy`)
            .then(({ data }) => {
                if (!live) return;
                setPolicy(data);
                setPreset(presetFor(data?.retentionDays));
                setCustom(data?.retentionDays != null ? String(data.retentionDays) : '');
                setStatus({ state: 'idle', message: '' });
            })
            .catch((err) => { if (live) setStatus({ state: 'error', message: err?.response?.data?.message || 'Could not load the retention policy.' }); });
        return () => { live = false; };
    }, [workspaceId]);

    const save = async () => {
        let retentionDays;
        try { retentionDays = parseRetentionDays(preset, custom); } catch (e) { setStatus({ state: 'error', message: e.message }); return; }
        setStatus({ state: 'busy', message: '' });
        try {
            const { data } = await api.patch(`/api/compliance/workspaces/${workspaceId}/retention-policy`, { retentionDays });
            setPolicy(data);
            setStatus({ state: 'done', message: retentionDays == null ? 'Messages in this workspace are kept forever.' : `Messages older than ${retentionDays} days will be removed by the nightly job.` });
        } catch (err) {
            const fallback = err?.response?.status === 403 ? 'Only workspace owners and admins can change retention.' : 'Could not save the retention policy.';
            setStatus({ state: 'error', message: err?.response?.data?.message || fallback });
        }
    };

    const current = policy?.retentionDays;
    const dirty = (() => { try { return parseRetentionDays(preset, custom) !== (current ?? null); } catch { return true; } })();

    return (
        <div className="gl-card tk-card" data-testid="retention-policy">
            <div className="tk-card-head">
                <span className="tk-mark"><Timer size={17} /></span>
                <div style={{ minWidth: 0 }}>
                    <h3 className="tk-card-title">Message retention</h3>
                    <p className="tk-card-text" style={{ marginTop: 3 }}>
                        Remove chat messages in this workspace after a set time, for everyone. Messages from or with people on
                        legal hold are never removed. Each person’s own retention setting still applies on top of this.
                    </p>
                </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <label htmlFor={`${uid}-preset`} className="tk-card-text" style={{ fontWeight: 600 }}>Keep messages for</label>
                <select id={`${uid}-preset`} className="gl-input" value={preset} disabled={status.state === 'loading'}
                    onChange={e => { setPreset(e.target.value); setStatus(s => (s.state === 'error' || s.state === 'done' ? { state: 'idle', message: '' } : s)); }}
                    style={{ width: 'auto', minWidth: 180 }}>
                    {RETENTION_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
                {preset === 'custom' && (
                    <>
                        <input aria-label="Days" className="gl-input" type="number" min={1} max={3650} value={custom}
                            onChange={e => setCustom(e.target.value)} style={{ width: 100 }} />
                        <span className="tk-card-text">days</span>
                    </>
                )}
            </div>
            {policy?.setAt && (
                <p className="tk-card-text" style={{ fontSize: 11.5 }}>
                    Current: {current == null ? 'keep forever' : `${current} days`} · changed {new Date(policy.setAt).toLocaleDateString()}
                </p>
            )}
            {status.state === 'error' && <div className="tk-notice" data-tone="danger" role="alert"><AlertTriangle size={14} />{status.message}</div>}
            {status.state === 'done' && <div className="tk-notice" data-tone="success" role="status"><CheckCircle2 size={14} />{status.message}</div>}
            <div className="tk-card-foot">
                <Btn icon={Save} loading={status.state === 'busy'} onClick={save} disabled={!workspaceId || status.state === 'busy' || status.state === 'loading' || !dirty}>
                    Save retention
                </Btn>
            </div>
        </div>
    );
}
