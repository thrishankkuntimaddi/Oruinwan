import React, { useState, useEffect, useCallback } from "react";
import { Link as LinkIcon, Mail, Copy, Check, Send, X, Users, Info } from "lucide-react";
import { useToast } from "../contexts/ToastContext";
import { Dialog, Confirm, Btn, IconBtn, Field, Chip, FilterTabs, timeAgo } from './ui/page';
import logger from '../utils/logger';
import './shared/entryModals.css';
import { usePlan } from '../features/plan/usePlan';
import { planBlock, handlePlanLimitResponse } from '../features/plan/planLimit';
import '../features/plan/plan.css';

const API_BASE = import.meta.env.VITE_BACKEND_URL || '';

const ROLES = [
    { key: 'member', title: 'Member', desc: 'Chats and works in channels' },
    { key: 'admin', title: 'Admin', desc: 'Also manages people and settings' },
];

const LINK_KINDS = [
    { key: 'team', title: 'Team link', desc: 'Anyone with it can join for 7 days' },
    { key: 'single', title: 'One-time link', desc: 'Works for one person only' },
];

const authHeaders = (json) => ({
    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
});

const expiresIn = (date) => {
    if (!date) return null;
    const days = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
    if (Number.isNaN(days)) return null;
    return days <= 1 ? 'expires within a day' : `expires in ${days} days`;
};

const InvitePeopleModal = ({ isOpen, onClose, workspaceId, workspaceName }) => {
    const { showToast } = useToast();

    const [inviteMethod, setInviteMethod] = useState("email");
    const [emails, setEmails]     = useState("");
    const [role, setRole]         = useState("member");
    const [linkKind, setLinkKind] = useState("team");
    const [inviteLink, setInviteLink] = useState(null);
    const [copied, setCopied]     = useState(false);
    const [pendingInvites, setPendingInvites] = useState([]);
    const [loading, setLoading]   = useState(false);
    const [sent, setSent]         = useState(false);
    const [revoking, setRevoking] = useState(null);
    const [revokeBusy, setRevokeBusy] = useState(false);
    // Free plan: people in a workspace, including pending email invites.
    const { plan } = usePlan(isOpen && workspaceId ? workspaceId : false);
    const memberBlock = planBlock(plan, 'members.perWorkspace');

    const fetchPendingInvites = useCallback(async () => {
        if (!workspaceId) return;
        try {
            const response = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/invites`, { headers: authHeaders() });
            if (response.ok) {
                const data = await response.json();
                setPendingInvites(data.pending || []);
            }
        } catch (err) { logger.error('Failed to fetch invites:', err); }
    }, [workspaceId]);

    useEffect(() => {
        if (!isOpen) return;
        fetchPendingInvites();
    }, [isOpen, fetchPendingInvites]);

    const emailList = [...new Set(emails.split(/[\s,;]+/).map(e => e.trim()).filter(Boolean))];

    const handleGenerateLink = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/invite`, {
                method: 'POST',
                headers: authHeaders(true),
                body: JSON.stringify({ inviteType: 'link', role: 'member', reusable: linkKind === 'team' })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) { handlePlanLimitResponse(response.status, data); throw new Error(data.message || 'We couldn’t create an invite link'); }
            setInviteLink(data.inviteLink);
            setCopied(false);
            fetchPendingInvites();
        } catch (err) {
            showToast(err.message || 'We couldn’t create an invite link', 'error');
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
        // One address per comma, semicolon, space or line.
        const list = emailList;
        if (!list.length) { showToast('Add at least one email address', 'warning'); return; }
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/invite`, {
                method: 'POST',
                headers: authHeaders(true),
                body: JSON.stringify({ emails: list, inviteType: 'email', role })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) { handlePlanLimitResponse(response.status, data); throw new Error(data.message || 'We couldn’t send the invites'); }
            const undelivered = (data.invites || []).filter(i => i.emailSent === false).length;
            setSent(true);
            if (undelivered) showToast(data.message, 'warning');
            else showToast(`Invitation${list.length === 1 ? '' : 's'} sent to ${list.length} ${list.length === 1 ? 'person' : 'people'}`, 'success');
            fetchPendingInvites();
            setTimeout(() => { setSent(false); setEmails(""); }, 2000);
        } catch (err) { showToast(err.message || 'We couldn’t send the invites', 'error'); }
        finally { setLoading(false); }
    };

    const handleRevokeInvite = async (inviteId) => {
        setRevokeBusy(true);
        try {
            const response = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/invites/${inviteId}/revoke`, {
                method: 'POST',
                headers: authHeaders(true),
                body: JSON.stringify({ reason: 'Revoked by admin' })
            });
            if (!response.ok) { const error = await response.json().catch(() => ({})); throw new Error(error.message || 'We couldn’t revoke this invite'); }
            setPendingInvites(prev => prev.filter(inv => (inv._id || inv.id) !== inviteId));
            showToast('Invite revoked. The link no longer works.', 'success');
        } catch (err) { showToast(err.message || 'We couldn’t revoke this invite', 'error'); }
        finally { setRevokeBusy(false); setRevoking(null); }
    };

    const footer = inviteMethod === 'email' ? (
        <>
            <Btn variant="ghost" onClick={onClose}>Close</Btn>
            <Btn variant="primary" icon={sent ? Check : Send} loading={loading} disabled={!emailList.length || sent || memberBlock.blocked} title={memberBlock.blocked ? memberBlock.reason : undefined} onClick={handleSendEmails}>
                {loading ? 'Sending…' : sent ? 'Sent' : emailList.length > 1 ? `Send ${emailList.length} invites` : 'Send invite'}
            </Btn>
        </>
    ) : (
        <>
            <Btn variant="ghost" onClick={onClose}>Close</Btn>
            <Btn variant={inviteLink ? undefined : 'primary'} icon={LinkIcon} loading={loading} disabled={memberBlock.blocked} title={memberBlock.blocked ? memberBlock.reason : undefined} onClick={handleGenerateLink}>
                {inviteLink ? 'Create another link' : 'Create link'}
            </Btn>
        </>
    );

    return (
        <>
            <Dialog
                open={isOpen}
                onClose={onClose}
                busy={!!revoking}
                title={workspaceName ? `Invite people to ${workspaceName}` : 'Invite people'}
                lead="Bring teammates in by email, or share a link."
                footer={footer}
            >
                <>
                    {memberBlock.blocked && (
                        <div className="em-alert" role="note" data-testid="invite-plan-limit">
                            <Info size={14} />
                            <span>{memberBlock.reason} Revoke a pending invite below to free a place.</span>
                        </div>
                    )}
                    <FilterTabs
                        label="How to invite"
                        value={inviteMethod}
                        onChange={(v) => setInviteMethod(v)}
                        options={[{ value: 'email', label: 'By email' }, { value: 'link', label: 'Invite link' }]}
                    />

                    {inviteMethod === "email" ? (
                        <>
                            <Field label="Email addresses" htmlFor="invite-emails" hint="Separate addresses with commas, spaces or new lines. Each person gets their own link.">
                                <textarea
                                    id="invite-emails"
                                    className="gl-input"
                                    value={emails}
                                    onChange={e => setEmails(e.target.value)}
                                    placeholder="colleague@example.com, partner@example.com"
                                    rows={3}
                                />
                            </Field>

                            <div className="cd-field">
                                <span className="cd-label" id="invite-role-label">Join as</span>
                                <div className="em-roles" role="radiogroup" aria-labelledby="invite-role-label">
                                    {ROLES.map(r => (
                                        <button key={r.key} type="button" role="radio" aria-checked={role === r.key} className="em-role" onClick={() => setRole(r.key)}>
                                            <b>{r.title}</b>
                                            <small>{r.desc}</small>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="cd-field">
                                <span className="cd-label" id="invite-kind-label">Link type</span>
                                <div className="em-roles" role="radiogroup" aria-labelledby="invite-kind-label">
                                    {LINK_KINDS.map(k => (
                                        <button key={k.key} type="button" role="radio" aria-checked={linkKind === k.key} className="em-role"
                                            onClick={() => { setLinkKind(k.key); setInviteLink(null); }}>
                                            <b>{k.title}</b>
                                            <small>{k.desc}</small>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {inviteLink ? (
                                <Field label={linkKind === 'team' ? 'Your team link' : 'Your one-time link'} htmlFor="invite-link"
                                    hint={linkKind === 'team'
                                        ? 'Share it in your team chat or email. People join as members. Revoke it below to stop new joins.'
                                        : 'Send it to one person. It stops working once they join.'}>
                                    <div className="em-link">
                                        <input id="invite-link" className="gl-input" readOnly value={inviteLink} onFocus={e => e.target.select()} />
                                        <Btn variant={copied ? undefined : 'primary'} icon={copied ? Check : Copy} onClick={handleCopyLink}>
                                            {copied ? 'Copied' : 'Copy'}
                                        </Btn>
                                    </div>
                                </Field>
                            ) : (
                                <div className="em-alert">
                                    <Info size={14} />
                                    <span>
                                        {linkKind === 'team'
                                            ? <>A <strong>team link</strong> is the quickest way to bring everyone in. People who use it join as members.</>
                                            : <>A <strong>one-time link</strong> is safer for a single person. Create a new one for each person.</>}
                                    </span>
                                </div>
                            )}
                        </>
                    )}

                    <section>
                        <p className="em-section-label">
                            <span>Pending invites</span>
                            <Chip>{pendingInvites.length}</Chip>
                        </p>
                        {pendingInvites.length === 0 ? (
                            <p className="cd-hint" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Users size={13} aria-hidden="true" /> No one is waiting to join. Invites you send show up here.
                            </p>
                        ) : (
                            <div className="em-list">
                                {pendingInvites.map(invite => {
                                    const inviteId = invite._id || invite.id;
                                    const isLink = !invite.email;
                                    return (
                                        <div key={inviteId} className="em-list-row">
                                            <span className="em-mark" style={{ width: 28, height: 28 }} aria-hidden="true">
                                                {isLink ? <LinkIcon size={13} /> : <Mail size={13} />}
                                            </span>
                                            <div>
                                                <p>{invite.email || 'Invite link'}</p>
                                                <small>
                                                    {invite.role === 'admin' ? 'Admin' : 'Member'}
                                                    {invite.createdAt ? ` · sent ${timeAgo(invite.createdAt)}` : ''}
                                                    {expiresIn(invite.expiresAt) ? ` · ${expiresIn(invite.expiresAt)}` : ''}
                                                </small>
                                            </div>
                                            <IconBtn label={`Revoke invite${invite.email ? ` for ${invite.email}` : ''}`} onClick={() => setRevoking(invite)}>
                                                <X size={14} />
                                            </IconBtn>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                </>
            </Dialog>

            <Confirm
                open={!!revoking}
                title="Revoke this invite?"
                confirmLabel="Revoke invite"
                tone="danger"
                busy={revokeBusy}
                onClose={() => setRevoking(null)}
                onConfirm={() => handleRevokeInvite(revoking._id || revoking.id)}
            >
                {revoking?.email
                    ? <>The invitation to <strong>{revoking.email}</strong> will stop working. You can invite them again later.</>
                    : <>This link will stop working for anyone who hasn’t joined yet.</>}
            </Confirm>
        </>
    );
};

export default InvitePeopleModal;
