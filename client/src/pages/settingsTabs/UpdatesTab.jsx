import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Download, ExternalLink, RefreshCw, Tag } from 'lucide-react';
import { PageIntro, Section, Row, Button, Notice, Badge } from './settingsUi';
import { actionLabel, getUpdater, hasUpdate, updateTitle, useUpdateState } from '../../appMode/updates/store';
import { notesExcerpt, RELEASES_URL } from '../../appMode/updates/manifest';
import { updateSubtitle } from '../../appMode/UpdateNotice';

const when = (t) => (t ? new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : null);

function statusLine(s) {
    if (s.kind === 'none') return 'Updates for this app come from its store.';
    switch (s.status) {
        case 'checking': return 'Checking for updates…';
        case 'current': return 'Oruinwan is up to date.';
        case 'error': return s.error || "Couldn't check for updates.";
        case 'idle': return 'Not checked yet.';
        default: return hasUpdate(s) ? updateTitle(s) : '';
    }
}

/**
 * Settings → About & updates: versions, "Check for updates", what's new and the one-click
 * update (desktop: Update and restart; browser: Reload). Also links to plans and the source.
 */
export default function UpdatesTab() {
    const s = useUpdateState();
    const navigate = useNavigate();
    const [checking, setChecking] = useState(false);
    const updater = getUpdater();
    const available = hasUpdate(s);
    const busy = s.status === 'downloading' || s.status === 'applying';
    const notes = notesExcerpt(s.manifest?.notes);
    const desktop = s.kind === 'desktop';

    const check = async () => {
        setChecking(true);
        try { await updater.check(); } finally { setChecking(false); }
    };

    return (
        <>
            <PageIntro title="About & updates" description="Your version of Oruinwan, and getting the newest one." />

            <Section
                title="Version"
                action={(
                    <Button icon={RefreshCw} loading={checking || s.status === 'checking'} onClick={check} disabled={s.kind === 'none' || busy}>
                        Check for updates
                    </Button>
                )}
            >
                <Row
                    label={desktop ? 'App' : 'Oruinwan'}
                    description={desktop ? 'The installed desktop app' : s.kind === 'web' ? 'The web app this server runs' : null}
                >
                    <Badge>{(desktop ? s.shellVersion : s.uiVersion) || '—'}</Badge>
                </Row>
                {desktop && (
                    <Row
                        label="Interface"
                        description={s.source === 'downloaded' ? 'Installed as a quick update, without reinstalling' : 'The version that came with the app'}
                    >
                        <Badge>{s.uiVersion || '—'}</Badge>
                    </Row>
                )}
                <Row label="Status" description={s.checkedAt ? `Last checked ${when(s.checkedAt)}` : 'Checked automatically when the app starts and every few hours'}>
                    {s.status === 'current' ? <CheckCircle2 size={16} style={{ color: 'var(--state-success, var(--accent))' }} aria-label="Up to date" /> : null}
                </Row>
                <div style={{ padding: '0 16px 14px', color: 'var(--text-secondary)', fontSize: 13 }} aria-live="polite">{statusLine(s)}</div>
            </Section>

            {available && (
                <Section title={updateTitle(s)} description={updateSubtitle(s)}>
                    <div style={{ padding: '4px 16px 16px' }}>
                        {notes.lines.length > 0 && (
                            <ul style={{ margin: '0 0 12px', paddingLeft: 18, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>
                                {notes.lines.map((l, i) => <li key={i}>{l.replace(/^[-*]\s*/, '')}</li>)}
                            </ul>
                        )}
                        {s.status === 'downloading' && (
                            <div style={{ height: 4, borderRadius: 4, background: 'var(--border-default)', margin: '0 0 12px', overflow: 'hidden' }}>
                                <div style={{ width: `${Math.max(4, s.percent || 0)}%`, height: '100%', background: 'var(--accent)', transition: 'width 200ms' }} />
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <Button variant="primary" icon={s.plan?.mode === 'installer' ? Download : RefreshCw} loading={busy} onClick={() => updater.install()}>
                                {actionLabel(s)}
                            </Button>
                            {s.kind !== 'web' && (
                                <Button variant="ghost" icon={ExternalLink} onClick={() => window.open(s.manifest?.pageUrl || RELEASES_URL, '_blank', 'noopener')}>
                                    Full release notes
                                </Button>
                            )}
                        </div>
                    </div>
                </Section>
            )}

            {desktop && s.source === 'downloaded' && (
                <Notice
                    tone="info"
                    action={<Button size="sm" onClick={() => updater.revertToBuiltIn()}>Use built-in version</Button>}
                >
                    If something looks wrong after a quick update, go back to the version that came with the app. The app restarts.
                </Notice>
            )}

            <Section title="Oruinwan">
                <Row label="Plans" description="Oruinwan is free. Pro and Enterprise are coming soon.">
                    <Button icon={Tag} onClick={() => navigate('/pricing')}>See plans</Button>
                </Row>
            </Section>
        </>
    );
}
