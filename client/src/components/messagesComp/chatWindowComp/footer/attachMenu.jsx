/**
 * attachMenu.jsx — Full Attachment Menu for both channels and DMs
 * Monolith Flow Design System — dark token based
 */
import React, { useRef, useState } from "react";
import { Image, FileText, User, BarChart2, Video, Loader2, Mic, Calendar } from "lucide-react";
import api from '@services/api';
import CreateGitHubIssueModal from "../../../../components/apps/modals/CreateGitHubIssueModal";
import CreateJiraTicketModal from "../../../../components/apps/modals/CreateJiraTicketModal";

// Icon background tints mapped to CSS token colors (no Tailwind)
const ITEM_COLORS = {
    Photo:    { bg: 'rgba(156,127,212,0.12)', color: '#9c7fd4' },
    Video:    { bg: 'rgba(99,179,237,0.12)',  color: '#63b3ed' },
    Document: { bg: 'rgba(184,149,106,0.12)', color: 'var(--accent)' },
    'Voice Note': { bg: 'rgba(198,60,60,0.1)', color: 'var(--state-danger)' },
    Contact:  { bg: 'rgba(72,187,120,0.1)',   color: 'var(--state-success)' },
    Poll:     { bg: 'rgba(184,149,106,0.12)', color: 'var(--accent)' },
    Meeting:  { bg: 'rgba(99,179,237,0.1)',   color: '#63b3ed' },
};

function AttachItem({ label, icon, emoji, onClick }) {
    const [hovered, setHovered] = useState(false);
    const c = ITEM_COLORS[label] || { bg: 'var(--bg-hover)', color: 'var(--text-muted)' };
    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px',
                padding: '8px 4px', borderRadius: '2px', background: 'none', border: 'none',
                cursor: 'pointer', transition: '150ms ease',
                backgroundColor: hovered ? 'var(--bg-hover)' : 'transparent',
            }}
        >
            <div style={{
                width: '38px', height: '38px', borderRadius: '2px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: c.bg, color: c.color, fontSize: '18px',
                transition: '150ms ease', transform: hovered ? 'scale(1.08)' : 'scale(1)',
            }}>
                {emoji || icon}
            </div>
            <span style={{ fontSize: '10px', fontWeight: 500, color: hovered ? 'var(--text-primary)' : 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.2, maxWidth: '52px' }}>
                {label}
            </span>
        </button>
    );
}

export default function AttachMenu({
    onAttach, onSendAttachment, onCreatePoll, onOpenVoiceRecorder,
    conversationId, conversationType = "channel", onClose, onInsertText,
}) {
    const photoInputRef = useRef(null);
    const videoInputRef = useRef(null);
    const fileInputRef  = useRef(null);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState(null);
    const [showGitHubModal, setShowGitHubModal] = useState(false);
    const [showJiraModal, setShowJiraModal] = useState(false);

    const uploadFile = async (file) => {
        if (!onSendAttachment) return;
        setUploading(true); setUploadError(null);
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("conversationType", conversationType || "channel");
            if (conversationId) formData.append("conversationId", conversationId);
            const { data: attachment } = await api.post("/api/v2/uploads", formData, { headers: { "Content-Type": "multipart/form-data" } });
            onSendAttachment(attachment);
            onClose?.();
        } catch (err) {
            setUploadError(err.response?.data?.error || "Upload failed");
        } finally { setUploading(false); }
    };

    const handlePhotoChange = (e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ""; };
    const handleVideoChange = (e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ""; };
    const handleFileChange  = (e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ""; };

    const items = [
        { label: "Photo",      icon: <Image size={16} />,    action: () => photoInputRef.current?.click() },
        { label: "Video",      icon: <Video size={16} />,    action: () => videoInputRef.current?.click() },
        { label: "Document",   icon: <FileText size={16} />, action: () => fileInputRef.current?.click() },
        { label: "Voice Note", icon: <Mic size={16} />,      action: () => { onClose?.(); onOpenVoiceRecorder?.(); }, hide: !onOpenVoiceRecorder },
        { label: "Contact",    icon: <User size={16} />,     action: () => { onAttach?.("contact"); onClose?.(); } },
        { label: "Poll",       icon: <BarChart2 size={16} />,action: () => { onCreatePoll?.(); onClose?.(); }, hide: !onCreatePoll || conversationType === 'dm' },
        { label: "Meeting",    icon: <Calendar size={16} />, action: () => { onAttach?.("meeting"); onClose?.(); } },
    ].filter(i => !i.hide);

    const appItems = [
        { label: "GitHub Issue",      emoji: "🐙", action: () => setShowGitHubModal(true) },
        { label: "Jira Ticket",       emoji: "🎫", action: () => setShowJiraModal(true) },
        { label: "Schedule Meeting",  emoji: "📅", action: () => { onAttach?.("meeting"); onClose?.(); } },
    ];

    return (
        <>
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-accent)',
                    borderRadius: '2px', padding: '10px', zIndex: 50, width: '220px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)', fontFamily: 'var(--font)',
                }}
            >
                <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
                <input ref={videoInputRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={handleVideoChange} />
                <input ref={fileInputRef}  type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.rar,.7z,.ppt,.pptx" style={{ display: 'none' }} onChange={handleFileChange} />

                {uploading && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '16px 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                        <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Uploading…
                    </div>
                )}
                {uploadError && (
                    <div style={{ padding: '4px 0', fontSize: '11px', color: 'var(--state-danger)', textAlign: 'center' }}>{uploadError}</div>
                )}

                {!uploading && (
                    <>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px' }}>
                            {items.map(item => (
                                <AttachItem key={item.label} label={item.label} icon={item.icon} onClick={item.action} />
                            ))}
                        </div>

                        {/* Apps divider */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '8px 0 6px' }}>
                            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-subtle)' }} />
                            <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Apps</span>
                            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-subtle)' }} />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px' }}>
                            {appItems.map(item => (
                                <AttachItem key={item.label} label={item.label} emoji={item.emoji} onClick={item.action} />
                            ))}
                        </div>
                    </>
                )}
            </div>

            {showGitHubModal && (
                <CreateGitHubIssueModal onClose={() => { setShowGitHubModal(false); onClose?.(); }} onInsertText={onInsertText} />
            )}
            {showJiraModal && (
                <CreateJiraTicketModal onClose={() => { setShowJiraModal(false); onClose?.(); }} onInsertText={onInsertText} />
            )}
        </>
    );
}
