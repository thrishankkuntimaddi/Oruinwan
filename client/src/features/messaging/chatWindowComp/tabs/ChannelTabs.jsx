import React, { useState } from 'react';
import { Plus, FileText, MessageSquare, CheckSquare, Palette, List } from 'lucide-react';

export default function ChannelTabs({
    tabs = [],
    activeTab,
    onTabChange,
    onAddTab,
    onDeleteTab,
    onRenameTab,
    currentUserId,
    isAdmin
}) {
    const [editingTabId, setEditingTabId] = useState(null);
    const [editingName, setEditingName] = useState("");

    const handleAddClick = () => {
        if (tabs.length >= 5) return;
        const untitledPattern = /^Untitled (\d+)$/;
        const existingNumbers = tabs
            .map(t => {
                const match = t.name.match(untitledPattern);
                return match ? parseInt(match[1], 10) : 0;
            })
            .filter(n => n > 0);
        const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
        const name = `Untitled ${nextNumber}`;
        onAddTab(name);
    };

    const handleDoubleClick = (tab) => {
        setEditingTabId(tab._id);
        setEditingName(tab.name);
    };

    const handleRename = (tabId) => {
        if (editingName.trim() && editingName !== tabs.find(t => t._id === tabId)?.name) {
            onRenameTab(tabId, editingName.trim());
        }
        setEditingTabId(null);
        setEditingName("");
    };

    const tabStyle = (isActive) => ({
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 8px',
        fontSize: '13px',
        fontWeight: 400,
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        color: isActive ? 'var(--accent)' : 'var(--text-muted)',
        background: 'none',
        border: 'none',
        borderBottom: isActive ? '1px solid var(--accent)' : '1px solid transparent',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'color 150ms ease, border-color 150ms ease',
        flexShrink: 0,
    });

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border-default)',
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '0 12px',
                overflowX: 'auto',
            }}>
                {}
                <button
                    onClick={() => onTabChange("chat")}
                    style={tabStyle(activeTab === "chat")}
                    onMouseEnter={e => { if (activeTab !== "chat") e.currentTarget.style.color = 'var(--text-secondary)'; }}
                    onMouseLeave={e => { if (activeTab !== "chat") e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                    <MessageSquare size={14} />
                    <span>Chat</span>
                </button>

                {}
                <button
                    onClick={() => onTabChange("threads")}
                    style={tabStyle(activeTab === "threads")}
                    onMouseEnter={e => { if (activeTab !== "threads") e.currentTarget.style.color = 'var(--text-secondary)'; }}
                    onMouseLeave={e => { if (activeTab !== "threads") e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                    <List size={14} />
                    <span>Threads</span>
                </button>

                {}
                <button
                    onClick={() => onTabChange("tasks")}
                    style={tabStyle(activeTab === "tasks")}
                    onMouseEnter={e => { if (activeTab !== "tasks") e.currentTarget.style.color = 'var(--text-secondary)'; }}
                    onMouseLeave={e => { if (activeTab !== "tasks") e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                    <CheckSquare size={14} />
                    <span>Tasks</span>
                </button>

                {}
                <button
                    onClick={() => onTabChange("canvas")}
                    style={tabStyle(activeTab === "canvas")}
                    onMouseEnter={e => { if (activeTab !== "canvas") e.currentTarget.style.color = 'var(--text-secondary)'; }}
                    onMouseLeave={e => { if (activeTab !== "canvas") e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                    <Palette size={14} />
                    <span>Canvas</span>
                </button>

                {}
                {tabs.map((tab) => {
                    const isActive = activeTab === tab._id;
                    return (
                        <div
                            key={tab._id}
                            style={{
                                ...tabStyle(isActive),
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                cursor: 'pointer',
                            }}
                            onClick={() => onTabChange(tab._id)}
                        >
                            {editingTabId === tab._id ? (
                                <input
                                    autoFocus
                                    type="text"
                                    value={editingName}
                                    onChange={(e) => setEditingName(e.target.value)}
                                    onBlur={() => handleRename(tab._id)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleRename(tab._id);
                                        if (e.key === 'Escape') {
                                            setEditingTabId(null);
                                            setEditingName("");
                                        }
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                        fontSize: '13px', padding: '2px 4px',
                                        background: 'transparent', color: 'var(--text-primary)',
                                        outline: 'none', border: 'none',
                                        borderBottom: '1px solid var(--accent)',
                                        minWidth: '80px',
                                        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                                    }}
                                />
                            ) : (
                                <div
                                    onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        handleDoubleClick(tab);
                                    }}
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                                >
                                    <FileText size={14} style={{ flexShrink: 0 }} />
                                    <span>{tab.name}</span>
                                </div>
                            )}
                        </div>
                    );
                })}

                {}
                <button
                    onClick={handleAddClick}
                    disabled={tabs.length >= 5}
                    style={{
                        padding: '6px', borderRadius: '2px',
                        background: 'none', border: 'none', cursor: tabs.length >= 5 ? 'not-allowed' : 'pointer',
                        color: tabs.length >= 5 ? 'var(--text-muted)' : 'var(--text-muted)',
                        display: 'flex', alignItems: 'center',
                        marginLeft: '4px', opacity: tabs.length >= 5 ? 0.3 : 1,
                        transition: 'color 150ms ease',
                    }}
                    onMouseEnter={e => { if (tabs.length < 5) e.currentTarget.style.color = 'var(--text-primary)'; }}
                    onMouseLeave={e => { if (tabs.length < 5) e.currentTarget.style.color = 'var(--text-muted)'; }}
                    title={tabs.length >= 5 ? "Maximum 5 canvases reached" : "Add Canvas"}
                >
                    <Plus size={14} />
                </button>
            </div>
        </div>
    );
}
