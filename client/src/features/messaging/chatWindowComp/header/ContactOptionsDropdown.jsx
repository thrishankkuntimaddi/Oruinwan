import React, { useState, useRef, useEffect } from "react";
import { User, BellOff, Bell, Ban, Trash2, MoreVertical } from "lucide-react";

const FONT = 'Inter, system-ui, -apple-system, sans-serif';

export default function ContactOptionsDropdown({ contact, onViewProfile, onMute, onBlock, onDelete, isMuted, isBlocked }) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false);
        };
        if (isOpen) document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    return (
        <div style={{ position: 'relative' }} ref={dropdownRef}>
            <ToggleBtn isOpen={isOpen} onClick={() => setIsOpen(!isOpen)} />

            {isOpen && (
                <div style={{
                    position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                    width: '220px', backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-accent)', borderRadius: '2px',
                    padding: '4px 0', zIndex: 50, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    animation: 'fadeIn 180ms cubic-bezier(0.16,1,0.3,1)',
                    fontFamily: FONT,
                }}>
                    <div style={{ padding: '6px 12px', fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
                        Contact Options
                    </div>

                    <MenuBtn icon={<User size={14} />} label="View Profile" onClick={() => { onViewProfile(); setIsOpen(false); }} />
                    <MenuBtn
                        icon={isMuted ? <Bell size={14} /> : <BellOff size={14} />}
                        label={isMuted ? "Unmute Notifications" : "Mute Notifications"}
                        onClick={() => { onMute(!isMuted); setIsOpen(false); }}
                    />

                    <div style={{ height: '1px', backgroundColor: 'var(--border-default)', margin: '4px 0' }} />

                    <MenuBtn icon={<Ban size={14} />} label={isBlocked ? "Unblock User" : "Block User"} onClick={() => { onBlock(); setIsOpen(false); }} danger />
                    <MenuBtn icon={<Trash2 size={14} />} label="Delete Chat" onClick={() => { onDelete(); setIsOpen(false); }} danger />
                </div>
            )}
        </div>
    );
}

function ToggleBtn({ isOpen, onClick }) {
    const [hov, setHov] = useState(false);
    return (
        <button onClick={onClick} aria-label="Contact options"
            onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{
                padding: '7px', borderRadius: '2px', background: 'none', border: 'none',
                cursor: 'pointer', display: 'flex', alignItems: 'center', transition: '100ms ease',
                color: isOpen ? 'var(--accent)' : (hov ? 'var(--text-primary)' : 'var(--text-muted)'),
                backgroundColor: isOpen || hov ? 'var(--bg-hover)' : 'transparent',
            }}>
            <MoreVertical size={18} />
        </button>
    );
}

function MenuBtn({ icon, label, onClick, danger }) {
    const [hov, setHov] = useState(false);
    return (
        <button onClick={onClick}
            onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{
                width: '100%', textAlign: 'left', padding: '7px 12px',
                display: 'flex', alignItems: 'center', gap: '10px',
                backgroundColor: hov ? 'var(--bg-hover)' : 'transparent',
                color: danger ? 'var(--state-danger)' : (hov ? 'var(--text-primary)' : 'var(--text-secondary)'),
                border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 400,
                fontFamily: FONT, transition: '100ms ease',
            }}>
            {icon}
            {label}
        </button>
    );
}
