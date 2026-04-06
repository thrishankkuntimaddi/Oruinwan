import React, { useState, useEffect } from "react";
import { X, Link as LinkIcon, Mail, Copy, Check, Send, AlertCircle } from "lucide-react";
import { useToast } from "../contexts/ToastContext";

const API_BASE = import.meta.env.VITE_BACKEND_URL || '';

// ── Design tokens ──────────────────────────────────────────────────────────
const T = {
    bg: '#0c0c0c',
    sidebar: '#111111',
    surface: '#141414',
    border: 'rgba(255,255,255,0.06)',
    borderHover: 'rgba(255,255,255,0.12)',
    accent: '#b8956a',
    accentBg: 'rgba(184,149,106,0.1)',
    accentBorder: 'rgba(184,149,106,0.3)',
    text: '#e4e4e4',
    muted: 'rgba(228,228,228,0.4)',
    dim: 'rgba(228,228,228,0.2)',
    font: 'Inter, system-ui, sans-serif',
    input: 'rgba(255,255,255,0.04)',
};

const InvitePeopleModal = ({ isOpen, onClose, workspaceId, workspaceName }) => {
    const { showToast } = useToast();

    const [inviteMethod, setInviteMethod] = useState("email");
    const [emails, setEmails]     = useState("");
    const [role, setRole]         = useState("member");
    const [inviteLink, setInviteLink] = useState(null);
    const [copied, setCopied]     = useState(false);
    const [pendingInvites, setPendingInvites] = useState([]);
    const [loading, setLoading]   = useState(false);
    const [sent, setSent]         = useState(false);

    useEffect(() => {
        if (!isOpen || !workspaceId) return;
        const fetchPendingInvites = async () => {
            try {
                const token = localStorage.getItem('accessToken');
                const response = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/invites`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    setPendingInvites(data.pending || []);
                }
            } catch (err) { console.error('Failed to fetch invites:', err); }
        };
        fetchPendingInvites();
    }, [isOpen, workspaceId]);

    if (!isOpen) return null;

    const handleGenerateLink = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/invite`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ inviteType: 'link', role: 'member' })
            });
            if (!response.ok) throw new Error('Failed to generate invite link');
            const data = await response.json();
            setInviteLink(data.inviteLink);
        } catch (err) {
            showToast(err.message || 'Failed to generate invite link', 'error');
        } finally { setLoading(false); }
    };

    const handleCopyLink = () => {
        if (inviteLink) {
            navigator.clipboard.writeText(inviteLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleSendEmails = async () => {
        if (!emails.trim()) { showToast('Please enter at least one email address', 'warning'); return; }
        setLoading(true);
        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/invite`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ emails, inviteType: 'email', role })
            });
            if (!response.ok) { const error = await response.json(); throw new Error(error.message || 'Failed to send invites'); }
            setSent(true);
            showToast('Invitations sent successfully!', 'success');
            const refreshResponse = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/invites`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (refreshResponse.ok) { const data = await refreshResponse.json(); setPendingInvites(data.pending || []); }
            setTimeout(() => { setSent(false); setEmails(""); }, 2000);
        } catch (err) { showToast(err.message || 'Failed to send invites', 'error'); }
        finally { setLoading(false); }
    };

    const handleRevokeInvite = async (inviteId) => {
        if (!window.confirm('Are you sure you want to revoke this invite?')) return;
        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/invites/${inviteId}/revoke`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: 'Revoked by admin' })
            });
            if (!response.ok) throw new Error('Failed to revoke invite');
            setPendingInvites(prev => prev.filter(inv => inv._id !== inviteId));
            showToast('Invite revoked successfully', 'success');
        } catch (err) { showToast(err.message || 'Failed to revoke invite', 'error'); }
    };

    return (
        <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', backdropFilter: 'blur(4px)' }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div style={{ background: T.bg, border: `1px solid ${T.border}`, width: '100%', maxWidth: '820px', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'row', fontFamily: T.font, position: 'relative' }}>

                {/* ── LEFT SIDEBAR ── */}
                <div style={{ width: '220px', flexShrink: 0, background: T.sidebar, borderRight: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column' }}>
                    {/* Title */}
                    <div style={{ padding: '20px 16px', borderBottom: `1px solid ${T.border}` }}>
                        <h2 style={{ fontSize: '15px', fontWeight: 700, color: T.text, margin: 0 }}>Invite People</h2>
                        <p style={{ fontSize: '11px', color: T.muted, marginTop: '2px', marginBottom: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>to {workspaceName}</p>
                    </div>

                    {/* Nav */}
                    <div style={{ padding: '12px 8px', flex: 1, overflowY: 'auto' }}>
                        <div style={{ fontSize: '9px', fontWeight: 700, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.12em', padding: '0 8px', marginBottom: '6px' }}>Invite Via</div>

                        {/* Email */}
                        <button
                            onClick={() => setInviteMethod("email")}
                            style={{
                                width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                                padding: '8px 10px', fontSize: '13px', fontWeight: inviteMethod === 'email' ? 600 : 400,
                                color: inviteMethod === 'email' ? T.accent : T.muted,
                                background: inviteMethod === 'email' ? T.accentBg : 'transparent',
                                border: `1px solid ${inviteMethod === 'email' ? T.accentBorder : 'transparent'}`,
                                cursor: 'pointer', fontFamily: T.font, textAlign: 'left', transition: 'all 150ms ease',
                            }}
                            onMouseEnter={e => { if (inviteMethod !== 'email') { e.currentTarget.style.color = T.text; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; } }}
                            onMouseLeave={e => { if (inviteMethod !== 'email') { e.currentTarget.style.color = T.muted; e.currentTarget.style.background = 'transparent'; } }}
                        >
                            <div style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: inviteMethod === 'email' ? T.accentBg : 'rgba(255,255,255,0.06)', flexShrink: 0 }}>
                                <Mail size={13} />
                            </div>
                            <span>Email Address</span>
                        </button>

                        {/* Link */}
                        <button
                            onClick={() => setInviteMethod("link")}
                            style={{
                                width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                                padding: '8px 10px', marginTop: '4px', fontSize: '13px', fontWeight: inviteMethod === 'link' ? 600 : 400,
                                color: inviteMethod === 'link' ? T.accent : T.muted,
                                background: inviteMethod === 'link' ? T.accentBg : 'transparent',
                                border: `1px solid ${inviteMethod === 'link' ? T.accentBorder : 'transparent'}`,
                                cursor: 'pointer', fontFamily: T.font, textAlign: 'left', transition: 'all 150ms ease',
                            }}
                            onMouseEnter={e => { if (inviteMethod !== 'link') { e.currentTarget.style.color = T.text; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; } }}
                            onMouseLeave={e => { if (inviteMethod !== 'link') { e.currentTarget.style.color = T.muted; e.currentTarget.style.background = 'transparent'; } }}
                        >
                            <div style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: inviteMethod === 'link' ? T.accentBg : 'rgba(255,255,255,0.06)', flexShrink: 0 }}>
                                <LinkIcon size={13} />
                            </div>
                            <span>Shareable Link</span>
                        </button>

                        {/* Pending invites */}
                        {pendingInvites.length > 0 && (
                            <>
                                <div style={{ height: '1px', background: T.border, margin: '12px 8px' }} />
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px', marginBottom: '6px' }}>
                                    <span style={{ fontSize: '9px', fontWeight: 700, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Pending</span>
                                    <span style={{ fontSize: '9px', fontWeight: 700, color: T.muted, background: 'rgba(255,255,255,0.06)', padding: '1px 5px' }}>{pendingInvites.length}</span>
                                </div>
                                <div style={{ maxHeight: '120px', overflowY: 'auto' }}>
                                    {pendingInvites.map(invite => {
                                        const inviteId = invite._id || invite.id;
                                        return (
                                            <div key={inviteId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 8px', borderRadius: 0 }}
                                                className="group"
                                            >
                                                <div style={{ minWidth: 0 }}>
                                                    <p style={{ fontSize: '11px', fontWeight: 500, color: T.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px', margin: 0 }}>
                                                        {invite.email || 'Link invite'}
                                                    </p>
                                                    <p style={{ fontSize: '10px', color: T.dim, margin: 0 }}>{invite.role}</p>
                                                </div>
                                                <button
                                                    onClick={e => { e.stopPropagation(); handleRevokeInvite(inviteId); }}
                                                    title="Revoke"
                                                    style={{ padding: '3px', background: 'none', border: 'none', color: T.dim, cursor: 'pointer', display: 'flex', alignItems: 'center', transition: '150ms ease' }}
                                                    onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                                                    onMouseLeave={e => e.currentTarget.style.color = T.dim}
                                                >
                                                    <X size={11} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* ── RIGHT CONTENT ── */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: T.bg, position: 'relative', overflowY: 'auto' }}>
                    {/* Close */}
                    <button
                        onClick={onClose}
                        style={{ position: 'absolute', top: '14px', right: '14px', padding: '5px', background: 'none', border: 'none', color: T.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', zIndex: 10, transition: '150ms ease' }}
                        onMouseEnter={e => e.currentTarget.style.color = T.text}
                        onMouseLeave={e => e.currentTarget.style.color = T.muted}
                    >
                        <X size={16} />
                    </button>

                    <div style={{ padding: '32px 28px', flex: 1 }}>

                        {/* ── EMAIL VIEW ── */}
                        {inviteMethod === "email" ? (
                            <div style={{ maxWidth: '440px', margin: '0 auto' }}>
                                {/* Icon + Header */}
                                <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                                    <div style={{ width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.accentBg, border: `1px solid ${T.accentBorder}`, margin: '0 auto 12px' }}>
                                        <Mail size={18} style={{ color: T.accent }} />
                                    </div>
                                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: T.text, margin: '0 0 4px' }}>Invite by Email</h3>
                                    <p style={{ fontSize: '12px', color: T.muted, margin: 0 }}>Send invitations directly to their inbox</p>
                                </div>

                                {/* Email textarea */}
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '8px' }}>
                                        Email Addresses
                                    </label>
                                    <textarea
                                        value={emails}
                                        onChange={e => setEmails(e.target.value)}
                                        placeholder="colleague@example.com, partner@agency.com"
                                        rows={4}
                                        style={{
                                            width: '100%', padding: '10px 12px', background: T.input,
                                            border: `1px solid ${T.border}`, color: T.text, fontSize: '13px',
                                            outline: 'none', resize: 'none', fontFamily: T.font,
                                            boxSizing: 'border-box', transition: 'border-color 150ms ease',
                                        }}
                                        onFocus={e => e.currentTarget.style.borderColor = T.accentBorder}
                                        onBlur={e => e.currentTarget.style.borderColor = T.border}
                                    />
                                    <p style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: T.dim, marginTop: '4px' }}>
                                        <AlertCircle size={11} /> Comma separated emails
                                    </p>
                                </div>

                                {/* Role picker */}
                                <div style={{ marginBottom: '24px' }}>
                                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '10px' }}>
                                        Assign Role
                                    </label>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        {[
                                            { key: 'member', title: 'Member', desc: 'Can view and participate' },
                                            { key: 'admin',  title: 'Admin',  desc: 'Full workspace access' },
                                        ].map(r => (
                                            <button
                                                key={r.key}
                                                onClick={() => setRole(r.key)}
                                                style={{
                                                    padding: '12px', textAlign: 'left', position: 'relative',
                                                    background: role === r.key ? T.accentBg : T.input,
                                                    border: `1px solid ${role === r.key ? T.accent : T.border}`,
                                                    cursor: 'pointer', fontFamily: T.font, transition: 'all 150ms ease',
                                                }}
                                                onMouseEnter={e => { if (role !== r.key) e.currentTarget.style.borderColor = T.borderHover; }}
                                                onMouseLeave={e => { if (role !== r.key) e.currentTarget.style.borderColor = T.border; }}
                                            >
                                                {role === r.key && (
                                                    <div style={{ position: 'absolute', top: '8px', right: '8px', width: '6px', height: '6px', borderRadius: '50%', background: T.accent }} />
                                                )}
                                                <span style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: role === r.key ? T.accent : T.text, marginBottom: '2px' }}>{r.title}</span>
                                                <span style={{ display: 'block', fontSize: '11px', color: T.muted }}>{r.desc}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Send CTA */}
                                <button
                                    onClick={handleSendEmails}
                                    disabled={loading || !emails.trim()}
                                    style={{
                                        width: '100%', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                        fontSize: '13px', fontWeight: 700, fontFamily: T.font, cursor: (loading || !emails.trim()) ? 'not-allowed' : 'pointer',
                                        background: sent ? '#22c55e' : (loading || !emails.trim()) ? 'rgba(184,149,106,0.3)' : T.accent,
                                        color: '#0c0c0c', border: 'none', transition: 'all 150ms ease',
                                        opacity: (loading || !emails.trim()) ? 0.6 : 1,
                                    }}
                                >
                                    {loading ? 'Sending…' : sent ? <><Check size={15} /> Sent Successfully</> : <>Send Invitations <Send size={14} /></>}
                                </button>
                            </div>

                        ) : (
                            /* ── LINK VIEW ── */
                            <div style={{ maxWidth: '440px', margin: '0 auto' }}>
                                <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                                    <div style={{ width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(192,132,252,0.1)', border: '1px solid rgba(192,132,252,0.2)', margin: '0 auto 12px' }}>
                                        <LinkIcon size={18} style={{ color: '#c084fc' }} />
                                    </div>
                                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: T.text, margin: '0 0 4px' }}>Share Invite Link</h3>
                                    <p style={{ fontSize: '12px', color: T.muted, margin: 0 }}>Anyone with this link can join instantly</p>
                                </div>

                                {/* Warning */}
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '12px 14px', background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)', marginBottom: '24px' }}>
                                    <AlertCircle size={14} style={{ color: '#fbbf24', flexShrink: 0, marginTop: '1px' }} />
                                    <p style={{ fontSize: '12px', color: 'rgba(251,191,36,0.8)', margin: 0, lineHeight: 1.5 }}>
                                        For security, this link is valid for <strong>one-time use</strong> only. Create a new link for each person you want to invite.
                                    </p>
                                </div>

                                {!inviteLink ? (
                                    <button
                                        onClick={handleGenerateLink}
                                        disabled={loading}
                                        style={{ width: '100%', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, fontFamily: T.font, background: 'rgba(192,132,252,0.15)', border: '1px solid rgba(192,132,252,0.3)', color: '#c084fc', cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 150ms ease', opacity: loading ? 0.6 : 1 }}>
                                        <LinkIcon size={14} />
                                        {loading ? 'Generating…' : 'Generate New Link'}
                                    </button>
                                ) : (
                                    <div>
                                        <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '8px' }}>
                                            Your Invite Link
                                        </label>
                                        <div style={{ display: 'flex', background: T.input, border: `1px solid ${T.border}`, overflow: 'hidden' }}>
                                            <div style={{ flex: 1, padding: '10px 12px', fontSize: '12px', color: T.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                                                {inviteLink}
                                            </div>
                                            <button
                                                onClick={handleCopyLink}
                                                style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 700, background: copied ? '#22c55e' : T.accentBg, border: 'none', borderLeft: `1px solid ${T.border}`, color: copied ? '#fff' : T.accent, cursor: 'pointer', fontFamily: T.font, transition: 'all 150ms ease', whiteSpace: 'nowrap' }}>
                                                {copied ? <Check size={13} /> : <Copy size={13} />}
                                                {copied ? 'Copied' : 'Copy'}
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => setInviteLink(null)}
                                            style={{ width: '100%', marginTop: '12px', padding: '8px', fontSize: '12px', color: T.muted, background: 'none', border: 'none', cursor: 'pointer', fontFamily: T.font, transition: '150ms ease' }}
                                            onMouseEnter={e => e.currentTarget.style.color = T.text}
                                            onMouseLeave={e => e.currentTarget.style.color = T.muted}
                                        >
                                            Generate a different link
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InvitePeopleModal;
