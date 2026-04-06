// src/components/messageComp/chatWindow/modals/contactShareModal.jsx
import React, { useState } from "react";
import { X } from "lucide-react";

const FONT = 'Inter, system-ui, -apple-system, sans-serif';

export default function ContactShareModal({ contacts, onShare, onClose }) {
    const list = contacts?.length ? contacts : [
        { name: "Thrishank",    phone: "999-111-222" },
        { name: "Sarah Lee",    phone: "999-222-333" },
        { name: "Ethan Carter", phone: "999-333-444" },
    ];

    return (
        <div style={{
            position: 'absolute', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)',
            fontFamily: FONT,
        }}>
            <div style={{
                width: '380px', maxHeight: '70vh', display: 'flex', flexDirection: 'column',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-accent)',
                borderRadius: '4px',
                boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
                overflow: 'hidden',
                position: 'relative',
            }}>
                {/* Header */}
                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                    <h4 style={{ margin: 0, fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', fontFamily: FONT }}>Share Contact</h4>
                    <CloseBtn onClick={onClose} />
                </div>

                {/* List */}
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {list.map((c, i) => (
                        <ContactRow key={i} contact={c} onShare={onShare} />
                    ))}
                </div>
            </div>
        </div>
    );
}

function ContactRow({ contact, onShare }) {
    const [hov, setHov] = useState(false);
    return (
        <div
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 16px',
                borderBottom: '1px solid var(--border-subtle)',
                backgroundColor: hov ? 'var(--bg-hover)' : 'transparent',
                transition: '100ms ease',
            }}>
            <div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'Inter, system-ui, sans-serif' }}>{contact.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'Inter, system-ui, sans-serif' }}>{contact.phone}</div>
            </div>
            <ShareBtn onClick={() => onShare(contact)} />
        </div>
    );
}

function ShareBtn({ onClick }) {
    const [hov, setHov] = useState(false);
    return (
        <button onClick={onClick}
            onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{
                padding: '5px 14px', fontSize: '12px', fontWeight: 600,
                color: '#0c0c0c',
                backgroundColor: hov ? 'var(--accent-hover)' : 'var(--accent)',
                border: '1px solid var(--accent)', borderRadius: '2px',
                cursor: 'pointer', outline: 'none', transition: '100ms ease',
                fontFamily: 'Inter, system-ui, sans-serif',
            }}>
            Share
        </button>
    );
}

function CloseBtn({ onClick }) {
    const [hov, setHov] = useState(false);
    return (
        <button onClick={onClick}
            onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{
                padding: '5px', border: 'none', outline: 'none', background: 'none',
                cursor: 'pointer', borderRadius: '2px', display: 'flex', transition: '100ms',
                color: hov ? 'var(--state-danger)' : 'var(--text-muted)',
            }}>
            <X size={15} />
        </button>
    );
}
