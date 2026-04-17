import { useEffect, useState } from "react";
import { Search, X, Send, Users, Hash, MessageSquare } from "lucide-react";
import api from '@services/api';

const T = {
  bg:          'var(--bg-surface)',
  base:        'var(--bg-base)',
  surface:     'var(--bg-hover)',
  border:      'var(--border-default)',
  accent:      '#b8956a',
  accentBg:    'var(--accent-dim)',
  accentBorder:'rgba(184,149,106,0.3)',
  text:        'var(--text-primary)',
  muted:       'var(--text-muted)',
  font:        'Inter, system-ui, sans-serif',
};

export default function BroadcastModal({ workspaceId, onClose, onSendBroadcast }) {
    const [activeTab, setActiveTab] = useState('dms');
    const [dmContacts, setDmContacts] = useState([]);
    const [channels, setChannels] = useState([]);
    const [members, setMembers] = useState([]);
    const [selectedItems, setSelectedItems] = useState([]);
    const [message, setMessage] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadData() {
            if (!workspaceId) return;
            setLoading(true);
            try {
                const [dmsRes, channelsRes, membersRes] = await Promise.all([
                    api.get(`/api/v2/messages/workspace/${workspaceId}/dms`),
                    api.get(`/api/workspaces/${workspaceId}/channels`),
                    api.get(`/api/workspaces/${workspaceId}/members`)
                ]);
                const dms = (dmsRes.data.sessions || []).map(session => ({
                    type: 'dm', id: session.otherUser?._id,
                    name: session.otherUser?.username || 'Unknown',
                    avatar: session.otherUser?.profilePicture,
                    status: session.otherUser?.userStatus || 'offline'
                }));
                const chans = (channelsRes.data.channels || []).map(ch => ({
                    type: 'channel', id: ch._id, name: ch.name, isPrivate: ch.isPrivate
                }));
                const dmUserIds = new Set(dms.map(d => d.id));
                const mems = (membersRes.data.members || [])
                    .filter(m => !dmUserIds.has(m._id))
                    .map(m => ({ type: 'member', id: m._id, name: m.username, avatar: m.profilePicture, status: m.userStatus || 'offline' }));
                setDmContacts(dms); setChannels(chans); setMembers(mems);
                setLoading(false);
            } catch (err) {
                console.error("Failed to load broadcast data:", err);
                setLoading(false);
            }
        }
        loadData();
    }, [workspaceId]);

    const toggleItem = (item) => {
        const exists = selectedItems.find(s => s.id === item.id && s.type === item.type);
        if (exists) setSelectedItems(selectedItems.filter(s => !(s.id === item.id && s.type === item.type)));
        else setSelectedItems([...selectedItems, item]);
    };

    const handleSend = () => {
        if (!message.trim() || selectedItems.length === 0) return;
        onSendBroadcast(selectedItems, message);
    };

    const getCurrentItems = () => {
        let items = activeTab === 'dms' ? dmContacts : activeTab === 'channels' ? channels : members;
        if (searchQuery) items = items.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()));
        return items;
    };

    const currentItems = getCurrentItems();
    const tabs = [
        { key: 'dms',      label: 'DMs',      Icon: MessageSquare, count: dmContacts.length },
        { key: 'channels', label: 'Channels',  Icon: Hash,          count: channels.length  },
        { key: 'members',  label: 'Members',   Icon: Users,         count: members.length   },
    ];

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', padding: '16px' }}>
            <div style={{ background: T.bg, border: `1px solid ${T.border}`, width: '100%', maxWidth: '900px', height: '82vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                {/* Header */}
                <div style={{ padding: '20px 20px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '36px', height: '36px', background: T.accentBg, border: `1px solid ${T.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Users size={17} style={{ color: T.accent }} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '16px', fontWeight: 700, color: T.text, fontFamily: T.font, margin: 0 }}>New Broadcast</h2>
                            <p style={{ fontSize: '12px', color: T.muted, fontFamily: T.font, marginTop: '2px' }}>Send a message to multiple people at once</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{ padding: '6px', background: 'transparent', border: `1px solid ${T.border}`, color: T.muted, cursor: 'pointer', transition: 'all 150ms ease' }}
                        onMouseEnter={e => { e.currentTarget.style.color = T.text; e.currentTarget.style.borderColor = 'var(--border-accent)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = T.muted; e.currentTarget.style.borderColor = T.border; }}
                    >
                        <X size={15} />
                    </button>
                </div>

                {/* Main Content */}
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                    {/* Left — Contact Selection */}
                    <div style={{ width: '320px', borderRight: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                        {/* Tabs */}
                        <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
                            {tabs.map(({ key, label, Icon, count }) => {
                                const isActive = activeTab === key;
                                return (
                                    <button
                                        key={key}
                                        onClick={() => setActiveTab(key)}
                                        style={{ flex: 1, padding: '12px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', background: 'transparent', border: 'none', borderBottom: `2px solid ${isActive ? T.accent : 'transparent'}`, color: isActive ? T.accent : T.muted, cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: T.font, transition: 'all 150ms ease' }}
                                        onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = T.text; }}
                                        onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = T.muted; }}
                                    >
                                        <Icon size={13} />
                                        <span>{label}</span>
                                        <span style={{ fontSize: '10px', padding: '1px 5px', background: T.surface, color: T.muted, fontFamily: T.font }}>{count}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Search */}
                        <div style={{ padding: '10px 12px', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
                            <div style={{ position: 'relative' }}>
                                <Search size={13} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: T.muted }} />
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{ width: '100%', paddingLeft: '28px', paddingRight: '10px', paddingTop: '7px', paddingBottom: '7px', background: T.surface, border: `1px solid ${T.border}`, color: T.text, fontSize: '12px', outline: 'none', fontFamily: T.font, boxSizing: 'border-box' }}
                                    onFocus={e => e.currentTarget.style.borderColor = T.accentBorder}
                                    onBlur={e => e.currentTarget.style.borderColor = T.border}
                                />
                            </div>
                        </div>

                        {/* List */}
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            {loading ? (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '120px' }}>
                                    <div style={{ width: '22px', height: '22px', border: `2px solid ${T.accent}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                                </div>
                            ) : currentItems.length === 0 ? (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '120px' }}>
                                    <p style={{ fontSize: '12px', color: T.muted, fontFamily: T.font }}>No {activeTab === 'dms' ? 'DMs' : activeTab} found</p>
                                </div>
                            ) : (
                                <div style={{ padding: '6px' }}>
                                    {currentItems.map((item) => {
                                        const isSelected = selectedItems.some(s => s.id === item.id && s.type === item.type);
                                        return (
                                            <button
                                                key={`${item.type}-${item.id}`}
                                                onClick={() => toggleItem(item)}
                                                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: isSelected ? T.accentBg : 'transparent', border: `1px solid ${isSelected ? T.accentBorder : 'transparent'}`, cursor: 'pointer', transition: 'all 150ms ease', marginBottom: '2px' }}
                                                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = T.surface; }}
                                                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                                            >
                                                {/* Avatar/Icon */}
                                                {item.type === 'channel' ? (
                                                    <div style={{ width: '28px', height: '28px', background: T.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                        <Hash size={14} style={{ color: T.muted }} />
                                                    </div>
                                                ) : (
                                                    <div style={{ position: 'relative', flexShrink: 0 }}>
                                                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: T.accentBg, border: `1px solid ${T.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: T.accent, fontFamily: T.font }}>
                                                            {item.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div style={{ position: 'absolute', bottom: '-1px', right: '-1px', width: '8px', height: '8px', borderRadius: '50%', border: '2px solid var(--bg-surface)', background: item.status === 'active' ? '#34d399' : 'var(--border-default)' }} />
                                                    </div>
                                                )}

                                                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                                                    <p style={{ fontSize: '12px', fontWeight: 500, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: T.font }}>
                                                        {item.name}
                                                    </p>
                                                </div>

                                                {/* Checkbox */}
                                                <div style={{ width: '14px', height: '14px', border: `1.5px solid ${isSelected ? T.accent : T.border}`, background: isSelected ? T.accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 150ms ease' }}>
                                                    {isSelected && (
                                                        <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                                                            <path d="M2 6l3 3 5-5" stroke="#0c0c0c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                        </svg>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right — Message Area */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: T.base }}>
                        {/* Recipients */}
                        <div style={{ borderBottom: `1px solid ${T.border}`, minHeight: '52px', display: 'flex', alignItems: 'center', padding: '8px 16px', flexShrink: 0, flexWrap: 'wrap', gap: '6px' }}>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: T.font, flexShrink: 0 }}>TO:</span>
                            {selectedItems.length === 0 ? (
                                <span style={{ fontSize: '13px', color: T.muted, fontFamily: T.font, fontStyle: 'italic' }}>No recipients selected</span>
                            ) : (
                                selectedItems.map(item => (
                                    <span
                                        key={`sel-${item.type}-${item.id}`}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '2px 8px', background: T.accentBg, border: `1px solid ${T.accentBorder}`, color: T.accent, fontSize: '11px', fontWeight: 600, fontFamily: T.font }}
                                    >
                                        {item.type === 'channel' && '# '}{item.name}
                                        <button
                                            onClick={() => toggleItem(item)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.accent, padding: 0, display: 'flex', alignItems: 'center' }}
                                        >
                                            <X size={10} />
                                        </button>
                                    </span>
                                ))
                            )}
                        </div>

                        {/* Message Input */}
                        <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ fontSize: '10px', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: T.font, marginBottom: '10px' }}>
                                Your Message
                            </div>
                            <textarea
                                placeholder="Type your broadcast message here..."
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                style={{ flex: 1, padding: '12px', background: T.surface, border: `1px solid ${T.border}`, color: T.text, fontSize: '13px', resize: 'none', outline: 'none', fontFamily: T.font, lineHeight: 1.6, transition: 'border-color 150ms ease', boxSizing: 'border-box' }}
                                onFocus={e => e.currentTarget.style.borderColor = T.accentBorder}
                                onBlur={e => e.currentTarget.style.borderColor = T.border}
                            />
                        </div>

                        {/* Footer */}
                        <div style={{ padding: '12px 16px', borderTop: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                            <p style={{ fontSize: '12px', color: T.muted, fontFamily: T.font }}>
                                {selectedItems.length} recipient{selectedItems.length !== 1 ? 's' : ''} selected
                            </p>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={onClose}
                                    style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 600, color: T.muted, background: 'transparent', border: `1px solid ${T.border}`, cursor: 'pointer', fontFamily: T.font, transition: 'all 150ms ease' }}
                                    onMouseEnter={e => { e.currentTarget.style.color = T.text; e.currentTarget.style.borderColor = 'var(--border-accent)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.color = T.muted; e.currentTarget.style.borderColor = T.border; }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSend}
                                    disabled={!message.trim() || selectedItems.length === 0}
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 16px', fontSize: '12px', fontWeight: 700, color: '#000', background: T.accent, border: 'none', cursor: !message.trim() || selectedItems.length === 0 ? 'not-allowed' : 'pointer', fontFamily: T.font, transition: 'opacity 150ms ease', opacity: !message.trim() || selectedItems.length === 0 ? 0.4 : 1 }}
                                >
                                    <Send size={13} />
                                    Send Broadcast
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
