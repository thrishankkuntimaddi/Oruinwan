import React, { useState } from 'react';
import { Shield, Check, LogOut, Loader2 } from 'lucide-react';
import api from '@services/api';
import { useToast } from '../../../contexts/ToastContext';
import logger from '../../../utils/logger';
import { WORKSPACE_ICON_OPTIONS, WorkspaceIcon, DEFAULT_WORKSPACE_COLOR } from '../../../utils/workspaceIcons';

const RULES_MAX = 5000;

const COLOR_OPTIONS = [
    { name: 'Accent',  color: '#b8956a' }, { name: 'Blue',    color: '#3b82f6' },
    { name: 'Red',     color: '#ef4444' }, { name: 'Orange',  color: '#ea580c' },
    { name: 'Yellow',  color: '#eab308' }, { name: 'Green',   color: '#16a34a' },
    { name: 'Teal',    color: '#14b8a6' }, { name: 'Purple',  color: '#a855f7' },
    { name: 'Pink',    color: '#ec4899' }, { name: 'Cyan',    color: '#06b6d4' },
    { name: 'Lime',    color: '#84cc16' }, { name: 'Amber',   color: '#f59e0b' },
    { name: 'Emerald', color: '#10b981' }, { name: 'Violet',  color: '#8b5cf6' },
    { name: 'Slate',   color: '#5c5852' }, { name: 'Rose',    color: '#f43f5e' },
];

// Theme tokens only, so the tab follows dark / light.
const border       = 'var(--border-default)';
const borderSubtle = 'var(--border-subtle)';
const surface      = 'var(--bg-active)';
const accent       = 'var(--accent)';
const accentBg     = 'var(--accent-dim)';
const text         = 'var(--text-primary)';
const secondary    = 'var(--text-secondary)';
const muted        = 'var(--text-muted)';
const font         = 'var(--font)';

const inputStyle = {
    width: '100%', padding: '9px 12px', background: 'var(--bg-input)',
    border: `1px solid ${border}`, borderRadius: '2px', color: text, fontSize: '13px',
    outline: 'none', fontFamily: font, boxSizing: 'border-box', transition: 'border-color 150ms ease',
};
const labelStyle = { display: 'block', fontSize: '10px', fontWeight: 700, color: secondary, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '8px' };
const btnSecondary = { padding: '8px 16px', fontSize: '13px', fontWeight: 600, color: secondary, background: 'transparent', border: `1px solid ${border}`, borderRadius: '2px', cursor: 'pointer', fontFamily: font, transition: '150ms ease' };
const btnPrimary   = { padding: '8px 16px', fontSize: '13px', fontWeight: 700, color: 'var(--bg-base)', background: accent, border: 'none', borderRadius: '2px', cursor: 'pointer', fontFamily: font, transition: '150ms ease' };
const card = { padding: '18px 20px', background: 'var(--bg-surface)', border: `1px solid ${border}`, borderRadius: '2px' };

const iconName = (icon) => WORKSPACE_ICON_OPTIONS.find(o => o.id === icon)?.name || 'Default';

const GeneralTab = ({
    activeWorkspace, isAdmin, isOwner = false,
    workspaceName, setWorkspaceName,
    newWorkspaceName, setNewWorkspaceName,
    editingIcon, setEditingIcon,
    selectedIcon, setSelectedIcon,
    selectedColor, setSelectedColor,
    savingIcon, setSavingIcon,
    savingName, setSavingName,
    workspaceRules, setWorkspaceRules,
    editingRules, setEditingRules,
    savingRules, setSavingRules,
    stats, loadingStats,
    refreshWorkspace,
    onLeave, leaving = false,
}) => {
    const { showToast } = useToast();
    const [confirmLeave, setConfirmLeave] = useState(false);
    const currentColor = activeWorkspace?.color || DEFAULT_WORKSPACE_COLOR;

    const startEditing = () => {
        setEditingIcon(true);
        setSelectedIcon(activeWorkspace?.icon || 'rocket');
        setSelectedColor(currentColor);
        setNewWorkspaceName(workspaceName);
    };

    const saveAll = async () => {
        try {
            setSavingIcon(true); setSavingName(true);
            await api.put(`/api/workspaces/${activeWorkspace.id}`, { icon: selectedIcon, color: selectedColor });
            if (newWorkspaceName.trim() !== workspaceName) {
                await api.put(`/api/workspaces/${activeWorkspace.id}/rename`, { name: newWorkspaceName.trim() });
                setWorkspaceName(newWorkspaceName.trim());
            }
            setEditingIcon(false);
            showToast('Workspace updated', 'success');
            // No page reload: it would ask for the encryption password again.
            await refreshWorkspace?.();
        } catch (error) {
            logger.error('Error updating workspace:', error);
            showToast(error.response?.data?.message || 'Failed to update workspace', 'error');
        } finally { setSavingIcon(false); setSavingName(false); }
    };

    const saveRules = async () => {
        try {
            setSavingRules(true);
            await api.put(`/api/workspaces/${activeWorkspace.id}`, { rules: workspaceRules });
            showToast('Workspace rules updated', 'success');
            setEditingRules(false);
            await refreshWorkspace?.();
        } catch (error) {
            logger.error('Error updating rules:', error);
            showToast(error.response?.data?.message || 'Failed to update rules', 'error');
        } finally { setSavingRules(false); }
    };

    const busy = savingIcon || savingName;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontFamily: font }}>

            {editingIcon ? (
                <div style={{ ...card, padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                        <h3 style={{ fontSize: '14px', fontWeight: 700, color: text, margin: 0 }}>Edit workspace</h3>
                        <span style={{ fontSize: '9px', fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.12em', padding: '2px 8px', background: accentBg, borderRadius: '2px' }}>Editing</span>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={labelStyle} htmlFor="ws-name-input">Workspace Name</label>
                        <input
                            id="ws-name-input"
                            type="text" value={newWorkspaceName}
                            onChange={e => setNewWorkspaceName(e.target.value)}
                            placeholder="Enter workspace name"
                            style={inputStyle}
                            onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                            onBlur={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
                        />
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={labelStyle}>Choose Icon</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(42px, 1fr))', gap: '8px' }}>
                            {WORKSPACE_ICON_OPTIONS.map(option => {
                                const IconComp = option.Icon;
                                const isSelected = selectedIcon === option.id;
                                return (
                                    <button
                                        key={option.id}
                                        type="button"
                                        onClick={() => setSelectedIcon(option.id)}
                                        title={option.name}
                                        aria-label={option.name}
                                        aria-pressed={isSelected}
                                        style={{ position: 'relative', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isSelected ? accentBg : surface, border: `1px solid ${isSelected ? 'var(--accent)' : border}`, borderRadius: '2px', cursor: 'pointer', transition: 'all 150ms ease' }}
                                    >
                                        <IconComp size={20} style={{ color: isSelected ? accent : secondary }} />
                                        {isSelected && (
                                            <span style={{ position: 'absolute', top: '-4px', right: '-4px', width: '14px', height: '14px', borderRadius: '50%', background: accent, color: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Check size={9} strokeWidth={3} />
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={labelStyle}>Choose Color</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(34px, 1fr))', gap: '6px' }}>
                            {COLOR_OPTIONS.map(colorOpt => {
                                const isSelected = selectedColor === colorOpt.color;
                                return (
                                    <button
                                        key={colorOpt.color}
                                        type="button"
                                        onClick={() => setSelectedColor(colorOpt.color)}
                                        title={colorOpt.name}
                                        aria-label={colorOpt.name}
                                        aria-pressed={isSelected}
                                        style={{ height: '34px', borderRadius: '2px', border: `2px solid ${isSelected ? 'var(--text-primary)' : 'transparent'}`, backgroundColor: colorOpt.color, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}
                                    >
                                        {isSelected && <Check size={14} strokeWidth={3} />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div style={{ padding: '16px', background: surface, border: `1px solid ${borderSubtle}`, borderRadius: '2px', marginBottom: '16px' }}>
                        <p style={{ fontSize: '10px', fontWeight: 700, color: secondary, textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 12px' }}>Preview</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <div style={{ width: '56px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: selectedColor, color: '#fff', borderRadius: '2px', flexShrink: 0 }}>
                                <WorkspaceIcon icon={selectedIcon} size={28} />
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <p style={{ fontSize: '15px', fontWeight: 700, color: text, margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{newWorkspaceName || 'Workspace Name'}</p>
                                <p style={{ fontSize: '11px', color: secondary, margin: 0 }}>
                                    Icon: {iconName(selectedIcon)} &nbsp;·&nbsp; Color: {selectedColor}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button
                            type="button"
                            onClick={() => { setEditingIcon(false); setSelectedIcon(activeWorkspace?.icon || 'rocket'); setSelectedColor(currentColor); setNewWorkspaceName(workspaceName); }}
                            style={btnSecondary}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={saveAll}
                            disabled={busy || !newWorkspaceName.trim()}
                            style={{ ...btnPrimary, opacity: (busy || !newWorkspaceName.trim()) ? 0.5 : 1 }}
                        >
                            {busy ? 'Saving…' : 'Save All Changes'}
                        </button>
                    </div>
                </div>

            ) : (
                <>
                    <div style={card}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px', gap: '12px' }}>
                            <h3 style={{ fontSize: '13px', fontWeight: 700, color: text, margin: 0 }}>Workspace Details</h3>
                            {isAdmin && (
                                <button
                                    type="button"
                                    onClick={startEditing}
                                    style={{ padding: '5px 12px', fontSize: '11px', fontWeight: 700, color: accent, background: accentBg, border: `1px solid ${border}`, borderRadius: '2px', cursor: 'pointer', fontFamily: font, transition: '150ms ease' }}
                                >
                                    Edit Workspace
                                </button>
                            )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: currentColor, color: '#fff', borderRadius: '2px', flexShrink: 0 }}>
                                <WorkspaceIcon icon={activeWorkspace?.icon} size={30} />
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <h3 style={{ fontSize: '17px', fontWeight: 700, color: text, margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{workspaceName}</h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: secondary, flexWrap: 'wrap' }}>
                                    <span>Icon: <strong style={{ color: text }}>{iconName(activeWorkspace?.icon)}</strong></span>
                                    <span style={{ color: muted }}>•</span>
                                    <span>Color: <strong style={{ color: text }}>{currentColor}</strong></span>
                                    <span style={{ color: muted }}>•</span>
                                    <span>Your role: <strong style={{ color: text, textTransform: 'capitalize' }}>{activeWorkspace?.role || 'member'}</strong></span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {loadingStats ? (
                        <p style={{ fontSize: '12px', color: secondary }}>Loading workspace info…</p>
                    ) : stats && (
                        <div style={card}>
                            <p style={{ fontSize: '10px', fontWeight: 700, color: secondary, textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 12px' }}>Workspace Information</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                                {[
                                    { label: 'Created by',    value: stats.creator?.username || 'Unknown' },
                                    { label: 'Created on',    value: stats.createdAt ? new Date(stats.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—' },
                                    { label: 'Total members', value: stats.memberCount },
                                ].map((row, i, arr) => (
                                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < arr.length - 1 ? `1px solid ${borderSubtle}` : 'none' }}>
                                        <span style={{ fontSize: '12px', color: secondary }}>{row.label}</span>
                                        <span style={{ fontSize: '12px', fontWeight: 700, color: text }}>{row.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div style={card}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                            <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: text, margin: 0 }}>
                                <Shield size={14} style={{ color: accent }} />
                                Rules &amp; Guidelines
                            </h4>
                            {isAdmin && !editingRules && (
                                <button
                                    type="button"
                                    onClick={() => setEditingRules(true)}
                                    style={{ padding: '3px 10px', fontSize: '11px', fontWeight: 600, color: accent, background: 'transparent', border: `1px solid ${border}`, borderRadius: '2px', cursor: 'pointer', fontFamily: font, transition: '150ms ease' }}
                                >
                                    Edit Rules
                                </button>
                            )}
                        </div>

                        {editingRules ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <textarea
                                    value={workspaceRules}
                                    onChange={e => setWorkspaceRules(e.target.value.slice(0, RULES_MAX))}
                                    maxLength={RULES_MAX}
                                    placeholder="Set the tone for your workspace. E.g., 'Be respectful', 'No spam'..."
                                    rows={6}
                                    aria-label="Workspace rules"
                                    style={{ ...inputStyle, resize: 'vertical' }}
                                    onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                                    onBlur={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
                                />
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                    <span style={{ fontSize: '11px', color: workspaceRules.length >= RULES_MAX ? 'var(--state-danger)' : muted }}>
                                        {workspaceRules.length.toLocaleString()} / {RULES_MAX.toLocaleString()}
                                    </span>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            type="button"
                                            onClick={() => { setWorkspaceRules(activeWorkspace?.rules || ""); setEditingRules(false); }}
                                            style={btnSecondary}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={saveRules}
                                            disabled={savingRules}
                                            style={{ ...btnPrimary, opacity: savingRules ? 0.6 : 1 }}
                                        >
                                            {savingRules ? 'Saving…' : 'Save Rules'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            workspaceRules?.trim() ? (
                                <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px', color: secondary, background: surface, padding: '12px', border: `1px solid ${borderSubtle}`, borderRadius: '2px', fontFamily: font, margin: 0, lineHeight: 1.6 }}>
                                    {workspaceRules}
                                </pre>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                                    <Shield size={28} style={{ color: muted, margin: '0 auto 8px', display: 'block' }} />
                                    <p style={{ fontSize: '12px', color: secondary, margin: '0 0 4px' }}>No rules set for this workspace</p>
                                    {isAdmin && <p style={{ fontSize: '11px', color: muted, margin: 0 }}>Click "Edit Rules" to add guidelines for your team</p>}
                                </div>
                            )
                        )}
                    </div>

                    {!isOwner && onLeave && (
                        <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: text, marginBottom: '2px' }}>Leave workspace</div>
                                <div style={{ fontSize: '12px', color: secondary }}>
                                    {confirmLeave
                                        ? `Leave ${workspaceName}? You'll need a new invitation to come back.`
                                        : "You'll lose access to its channels, messages and files."}
                                </div>
                            </div>
                            {confirmLeave ? (
                                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                                    <button type="button" onClick={() => setConfirmLeave(false)} disabled={leaving} style={btnSecondary}>Cancel</button>
                                    <button
                                        type="button"
                                        onClick={onLeave}
                                        disabled={leaving}
                                        style={{ ...btnPrimary, background: 'var(--state-danger)', display: 'flex', alignItems: 'center', gap: '6px', opacity: leaving ? 0.7 : 1 }}
                                    >
                                        {leaving ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} />} Leave
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setConfirmLeave(true)}
                                    style={{ ...btnSecondary, color: 'var(--state-danger)', borderColor: 'var(--state-danger)', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}
                                >
                                    <LogOut size={13} /> Leave workspace
                                </button>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default GeneralTab;
