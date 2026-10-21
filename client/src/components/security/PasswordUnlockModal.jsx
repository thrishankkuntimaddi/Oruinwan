import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Lock, AlertCircle, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { Btn, IconBtn } from '../ui/page';
import logger from '../../utils/logger';
import '../shared/entryModals.css';

/**
 * Unlocks messages on this device with the account password, once. Only accounts whose key is
 * still password-protected (set up before automatic unlock) ever see it; after it, the key is
 * sealed on the server and every device unlocks automatically. onClose makes it dismissible.
 */
export default function PasswordUnlockModal({ onSubmit, onResetKeys, onClose }) {
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    // 'unlock', or 'reset' after a password reset: the old key can't be opened with the new
    // password, so encryption is set up again (the server checks the current password).
    const [mode, setMode] = useState('unlock');
    const [keyMismatch, setKeyMismatch] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleUnlock = async (e) => {
        e.preventDefault();

        if (!password.trim()) {
            setError('Enter your password');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            if (mode === 'reset') {
                await onResetKeys(password);
                return;
            }
            await onSubmit(password);
        } catch (err) {
            logger.error('❌ [UNLOCK] Password unlock failed:', err);

            const rawMsg = err.message || '';
            let friendlyMsg = 'That password didn’t work. Try again.';
            if (rawMsg.includes('500')) {
                friendlyMsg = 'The server had a problem checking your password. Try again in a moment.';
            } else if (rawMsg.includes('404')) {
                friendlyMsg = 'We couldn’t find your encryption keys. Contact support.';
            } else if (rawMsg.includes('403')) {
                friendlyMsg = 'Your session has expired. Refresh the page and sign in again.';
            } else if (mode === 'reset' && /current password|401/i.test(rawMsg)) {
                friendlyMsg = 'That isn’t your current account password.';
            } else if (rawMsg.includes('Failed to unwrap') || /decrypt/i.test(rawMsg)) {
                friendlyMsg = 'We couldn’t unlock your messages with that password. Check it and try again.';
                setKeyMismatch(true);
            } else if (rawMsg && rawMsg !== 'Incorrect password') {
                friendlyMsg = rawMsg;
            }

            setError(friendlyMsg);
            setLoading(false);
        }
    };

    return createPortal(
        <div className="cd-dialog-backdrop" onMouseDown={(e) => { if (onClose && e.target === e.currentTarget && !loading) onClose(); }}
            onKeyDown={(e) => { if (onClose && e.key === 'Escape' && !loading) onClose(); }}>
            <div className="cd-dialog" data-size="sm" role="dialog" aria-modal="true" aria-labelledby="unlock-modal-title" aria-describedby="unlock-modal-lead">
                <div className="cd-dialog-head">
                    <div className="em-head">
                        <span className="em-mark" aria-hidden="true"><Lock size={17} /></span>
                        <div style={{ minWidth: 0 }}>
                            <h2 id="unlock-modal-title">{mode === 'reset' ? 'Set up encryption again' : 'Unlock your messages'}</h2>
                            <p id="unlock-modal-lead">{mode === 'reset'
                                ? 'Your password was reset, so the key locked with the old password can’t be opened. Confirm your current password to make a new key for this account.'
                                : 'Enter your account password once. After that, your devices unlock messages automatically.'}</p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleUnlock}>
                    <div className="cd-dialog-body">
                        <div className="cd-field">
                            <label htmlFor="unlock-password">Password</label>
                            <div className="em-pass">
                                <input
                                    id="unlock-password"
                                    className="gl-input"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => {
                                        setPassword(e.target.value);
                                        setError(null);
                                    }}
                                    placeholder="Enter your password"
                                    autoFocus
                                    autoComplete="current-password"
                                    disabled={loading}
                                    aria-invalid={error ? 'true' : undefined}
                                    aria-describedby={error ? 'unlock-error' : 'unlock-hint'}
                                />
                                <IconBtn label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                                </IconBtn>
                            </div>
                        </div>

                        {error ? (
                            <div className="em-alert" data-tone="danger" role="alert" id="unlock-error">
                                <AlertCircle size={14} />
                                <span>{error}</span>
                            </div>
                        ) : (
                            <div className="em-alert" id="unlock-hint">
                                <ShieldCheck size={14} />
                                <span><strong>Asked only once.</strong> Your password isn’t stored. Oruinwan keeps a sealed copy of your message key so your other devices unlock on their own.</span>
                            </div>
                        )}
                    </div>

                    <div className="cd-dialog-foot">
                        <Btn type="submit" variant="primary" className="gl-btn--block" icon={Lock} loading={loading} disabled={!password.trim()}>
                            {mode === 'reset'
                                ? (loading ? 'Setting up…' : 'Set up encryption')
                                : (loading ? 'Unlocking…' : 'Unlock encryption')}
                        </Btn>
                        {onResetKeys && keyMismatch && mode === 'unlock' && (
                            <Btn variant="ghost" className="gl-btn--block" disabled={loading}
                                onClick={() => { setMode('reset'); setError(null); }}>
                                Reset your password recently? Set up encryption again
                            </Btn>
                        )}
                        {onClose && mode === 'unlock' && (
                            <Btn variant="ghost" className="gl-btn--block" disabled={loading} onClick={onClose}>
                                Not now
                            </Btn>
                        )}
                        {mode === 'reset' && (
                            <Btn variant="ghost" className="gl-btn--block" disabled={loading}
                                onClick={() => { setMode('unlock'); setError(null); }}>
                                Back
                            </Btn>
                        )}
                    </div>
                </form>
            </div>
        </div>,
        document.body,
    );
}
