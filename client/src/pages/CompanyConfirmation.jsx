import React, { useState } from 'react';
import api from '@services/api';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { CheckCircle2, ArrowRight, Shield, MessageSquare, CheckSquare, Layers, Sun, Moon, Users, Loader2 } from 'lucide-react';
import logger from '../utils/logger';
import { Avatar } from '../components/company-dash/DashShell';
import '../styles/gloss.css';
import '../components/company-dash/dash.css';
import './admin/platform/platform.css';

const FEATURES = [
    { icon: MessageSquare, label: 'Channels, DMs and huddles' },
    { icon: CheckSquare, label: 'Tasks, sprints and milestones' },
    { icon: Layers, label: 'Notes, files and a knowledge base' },
    { icon: Users, label: 'Departments, teams and an org chart' },
    { icon: Shield, label: 'End-to-end encrypted messaging' },
];

const TERMS = [
    ['1. Acceptance of terms', 'By using Oruinwan you agree to these terms. Continued use after changes means you accept the revised terms.'],
    ['2. Your responsibilities', 'Keep your account credentials confidential and tell us right away about any unauthorised use.'],
    ['3. Data privacy', 'We collect and use data as described in the Privacy Policy. Messages are encrypted and we do not sell personal data.'],
    ['4. Intellectual property', 'Oruinwan trademarks belong to Oruinwan. You keep ownership of everything your company uploads.'],
];

/** Step between verification and setup: accept the terms, then start setup. */
const CompanyConfirmation = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { resolvedTheme, toggleTheme } = useTheme() || {};
    const [loading, setLoading] = useState(false);
    const [accepted, setAccepted] = useState(false);
    const [error, setError] = useState('');

    const company = user?.company || {};
    const companyId = company.id || company._id || user?.companyId?._id || user?.companyId;
    const companyName = company.name || user?.companyName || 'Your company';
    const companyDomain = company.domain || user?.companyDomain || '';

    const confirm = async () => {
        if (!accepted || !companyId) return;
        setLoading(true);
        setError('');
        try {
            await api.post(`/api/companies/${companyId}/start-setup`, { acceptedTerms: true });
            navigate('/company/setup');
        } catch (err) {
            logger.error('Setup start error:', err);
            setError(err?.response?.data?.message || 'Could not start setup. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (!user) return null;

    return (
        <div className="pf-flow gl-ambient">
            {toggleTheme && (
                <button type="button" className="gl-icon-btn pf-flow-theme" onClick={() => toggleTheme()} aria-label={resolvedTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>
                    {resolvedTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                </button>
            )}
            <div className="gl-card pf-flow-card" data-narrow="true">
                <aside className="pf-flow-aside">
                    <div className="pf-flow-brand"><img src="/icons/oruinwan-128.png" alt="" /> Oruinwan</div>
                    <div className="gl-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div className="cd-cell-user">
                            <Avatar name={companyName} size="lg" />
                            <div>
                                <div className="cd-cell-title" style={{ fontSize: 15 }}>{companyName}</div>
                                {companyDomain && <div className="cd-cell-sub">{companyDomain}</div>}
                            </div>
                        </div>
                        <div>
                            <div className="gl-section-label" style={{ padding: '0 0 6px' }}>Primary admin</div>
                            <div className="cd-cell-user">
                                <Avatar user={user} size="sm" />
                                <div>
                                    <div className="cd-cell-title" style={{ fontSize: 12.5 }}>{user.profile?.name || user.username}</div>
                                    <div className="cd-cell-sub">{user.email}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="pf-flow-hide-sm" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'auto' }}>
                        <div className="gl-section-label" style={{ padding: 0 }}>What your team gets</div>
                        {FEATURES.map((f) => <div className="pf-feature" key={f.label}><f.icon size={14} /> {f.label}</div>)}
                    </div>
                </aside>

                <div className="pf-flow-main">
                    <div className="pf-flow-body">
                        <div>
                            <span className="cd-chip" data-tone="success"><CheckCircle2 size={11} /> Company verified</span>
                            <h1 className="gl-display pf-flow-title">One last step <span className="gl-sheen">before launch</span></h1>
                            <p className="pf-flow-lead">Review and accept the terms to set up your company workspace.</p>
                        </div>
                        <div className="gl-card" style={{ overflow: 'hidden' }}>
                            <div className="cd-panel-head" style={{ padding: '10px 14px', margin: 0, borderBottom: '1px solid var(--border-subtle)' }}>
                                <h2 className="cd-panel-title"><Shield size={14} /> Terms of Service & Privacy Policy</h2>
                            </div>
                            <div className="pf-terms">
                                {TERMS.map(([t, b]) => <div key={t}><strong>{t}</strong>{b}</div>)}
                                <div>Read the full <Link to="/terms" target="_blank" style={{ color: 'var(--accent)' }}>Terms</Link> and <Link to="/privacy" target="_blank" style={{ color: 'var(--accent)' }}>Privacy Policy</Link>.</div>
                            </div>
                            <label className="pf-check">
                                <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
                                I have read and agree to the Terms of Service and Privacy Policy
                            </label>
                        </div>
                        {!companyId && <div className="cd-error-text" role="alert">Your account is not linked to a company. Sign in with the company admin account.</div>}
                        {error && <div className="cd-error-text" role="alert">{error}</div>}
                    </div>
                    <div className="pf-flow-foot">
                        <span className="cd-muted" style={{ fontSize: 11.5 }}>Next: company profile, departments and invites</span>
                        <button type="button" className="gl-btn gl-btn--primary gl-btn--lg" onClick={confirm} disabled={loading || !accepted || !companyId}>
                            {loading ? <Loader2 size={15} className="cd-spin" /> : null}
                            Accept & start setup {!loading && <ArrowRight size={15} />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CompanyConfirmation;
