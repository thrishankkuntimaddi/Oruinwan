import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Key, Shield, CheckCircle2, Check, Laptop, Smartphone, Monitor, LogOut, AlertCircle, Trash2, ArrowUpRight, Info } from 'lucide-react';
import PasswordInput from '../shared/PasswordInput';
import { Btn, Chip } from '../../ui/page';
import '../profileMenu.css';

const RULES = [
    { label: '8+ characters', test: (v) => v.length >= 8 },
    { label: 'Uppercase letter', test: (v) => /[A-Z]/.test(v) },
    { label: 'Number', test: (v) => /\d/.test(v) },
    { label: 'Special character', test: (v) => /[!@#$%^&*(),.?":{}|<>]/.test(v) },
];

const providerName = (p) => (p ? p.charAt(0).toUpperCase() + p.slice(1) : '');

const SecurityView = ({
    user,
    passData,
    setPassData,
    showPasswords,
    setShowPasswords,
    sessions,
    onBack,
    onSavePassword,
    onLogoutSession,
    onLogoutAllSessions,
    onDeleteAccount
}) => {
    const navigate = useNavigate();
    const isOAuth = !!user?.authProvider && user.authProvider !== 'local';

    return (
        <div className="pm" data-wide="true" role="dialog" aria-label="Security">
            <div className="pm-head">
                <button type="button" className="pm-back" onClick={onBack}><ChevronLeft size={14} /> Back</button>
                <h2>Security</h2>
                <span />
            </div>

            <div className="pm-body">
                <section className="pm-group">
                    <div className="pm-group-title"><Key size={14} /><span className="pm-cap">Password</span></div>

                    {isOAuth && (
                        <div className="pm-note">
                            <Info size={14} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
                            <div>
                                <strong>Signed up with {providerName(user.authProvider)}</strong>
                                {user.passwordSetAt && <> · <Chip tone="success"><CheckCircle2 size={10} /> Password set</Chip></>}
                                <div>
                                    {user.passwordSetAt
                                        ? `You can sign in with ${providerName(user.authProvider)} or with your email and password.`
                                        : 'Set a password to also sign in with your email.'}
                                </div>
                            </div>
                        </div>
                    )}

                    {!isOAuth && (
                        <PasswordInput
                            label="Current password"
                            value={passData.old}
                            onChange={e => setPassData({ ...passData, old: e.target.value })}
                            show={showPasswords.old}
                            onToggle={() => setShowPasswords(prev => ({ ...prev, old: !prev.old }))}
                            fieldType="current"
                        />
                    )}

                    <PasswordInput
                        label="New password"
                        value={passData.new}
                        onChange={e => setPassData({ ...passData, new: e.target.value })}
                        show={showPasswords.new}
                        onToggle={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                        fieldType="new"
                    />

                    <div className="pm-rules" aria-label="Password requirements">
                        {RULES.map((r) => {
                            const ok = r.test(passData.new);
                            return (
                                <span key={r.label} className="pm-rule-item" data-ok={ok ? 'true' : undefined}>
                                    {ok ? <Check size={11} strokeWidth={3} /> : <span className="pm-ring" aria-hidden="true" />}
                                    {r.label}
                                </span>
                            );
                        })}
                    </div>

                    <PasswordInput
                        label="Confirm new password"
                        value={passData.confirm}
                        onChange={e => setPassData({ ...passData, confirm: e.target.value })}
                        show={showPasswords.confirm}
                        onToggle={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                        fieldType="confirm"
                    />

                    <Btn variant="primary" className="gl-btn--block" onClick={onSavePassword}>
                        {isOAuth ? 'Set password' : 'Update password'}
                    </Btn>
                </section>

                <section className="pm-group">
                    <div className="pm-group-title"><Shield size={14} /><span className="pm-cap">Two-step verification</span></div>
                    <div className="pm-setting">
                        <div>
                            <div className="pm-setting-label">Authenticator app</div>
                            <div className="pm-setting-sub">A code from your phone at each sign-in.</div>
                        </div>
                        <Btn size="sm" onClick={() => navigate('/settings?tab=security', { state: { from: window.location.pathname } })}>
                            Set up <ArrowUpRight size={12} />
                        </Btn>
                    </div>
                </section>

                <section className="pm-group">
                    <div className="pm-group-title"><Laptop size={14} /><span className="pm-cap">Signed-in devices</span></div>
                    {sessions.length === 0 && <p className="pm-hint" style={{ margin: 0 }}>Loading your devices…</p>}
                    {sessions.map((session) => (
                        <div key={session.id} className="pm-session">
                            <span className="pm-session-icon" aria-hidden="true">
                                {session.type === 'laptop' ? <Laptop size={15} /> : session.type === 'mobile' ? <Smartphone size={15} /> : <Monitor size={15} />}
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="pm-session-name">
                                    {session.device}
                                    {session.browser && <small>· {session.browser}</small>}
                                    {session.current && <Chip tone="success">This device</Chip>}
                                </div>
                                <div className="pm-session-meta">{[session.location, session.lastActive].filter(Boolean).join(' · ')}</div>
                            </div>
                            {!session.current && (
                                <Btn size="sm" variant="ghost" onClick={() => onLogoutSession(session.id)}>Sign out</Btn>
                            )}
                        </div>
                    ))}
                    {sessions.length > 1 && (
                        <Btn variant="danger" icon={LogOut} className="gl-btn--block" onClick={onLogoutAllSessions}>
                            Sign out of all other devices
                        </Btn>
                    )}
                </section>

                {user?.userType === "personal" && !user?.companyId && (
                    <section className="pm-group" data-tone="danger">
                        <div className="pm-group-title"><AlertCircle size={14} /><span className="pm-cap">Danger zone</span></div>
                        <div className="pm-setting">
                            <div>
                                <div className="pm-setting-label">Delete account</div>
                                <div className="pm-setting-sub">Removes your data for good.</div>
                            </div>
                            <Btn size="sm" variant="danger" icon={Trash2} onClick={onDeleteAccount}>Delete</Btn>
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
};

export default SecurityView;
