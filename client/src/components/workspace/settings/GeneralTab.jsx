import React from 'react';
import { Rocket, Briefcase, Zap, Palette, FlaskConical, Globe, ShieldCheck, TrendingUp, Lightbulb, Flame, Target, Trophy, Shield } from 'lucide-react';
import api from '@services/api';
import { useToast } from '../../../contexts/ToastContext';

// Icon options for workspace customization
const iconOptions = [
    { id: 'rocket',    name: 'Rocket',    Icon: Rocket     },
    { id: 'briefcase', name: 'Briefcase', Icon: Briefcase  },
    { id: 'zap',       name: 'Zap',       Icon: Zap        },
    { id: 'palette',   name: 'Palette',   Icon: Palette    },
    { id: 'flask',     name: 'Flask',     Icon: FlaskConical },
    { id: 'globe',     name: 'Globe',     Icon: Globe      },
    { id: 'shield',    name: 'Shield',    Icon: ShieldCheck },
    { id: 'trending',  name: 'Trending',  Icon: TrendingUp },
    { id: 'lightbulb', name: 'Lightbulb', Icon: Lightbulb  },
    { id: 'flame',     name: 'Flame',     Icon: Flame      },
    { id: 'target',    name: 'Target',    Icon: Target     },
    { id: 'trophy',    name: 'Trophy',    Icon: Trophy     },
];

// ── Shared token shortcuts ──────────────────────────────────────
const border  = 'rgba(255,255,255,0.07)';
const surface = 'rgba(255,255,255,0.04)';
const accent  = '#b8956a';
const accentBg     = 'rgba(184,149,106,0.1)';
const accentBorder = 'rgba(184,149,106,0.3)';
const text    = '#e4e4e4';
const muted   = 'rgba(228,228,228,0.4)';
const font    = 'Inter, system-ui, sans-serif';

const inputStyle = {
    width: '100%', padding: '9px 12px', background: surface,
    border: `1px solid ${border}`, color: text, fontSize: '13px',
    outline: 'none', fontFamily: font, boxSizing: 'border-box', transition: 'border-color 150ms ease',
};
const labelStyle = { display: 'block', fontSize: '10px', fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '8px' };
const btnSecondary = { padding: '8px 16px', fontSize: '13px', fontWeight: 600, color: muted, background: 'transparent', border: `1px solid ${border}`, cursor: 'pointer', fontFamily: font, transition: '150ms ease' };
const btnPrimary   = { padding: '8px 16px', fontSize: '13px', fontWeight: 700, color: '#0c0c0c', background: accent, border: 'none', cursor: 'pointer', fontFamily: font, transition: '150ms ease' };

const GeneralTab = ({
    activeWorkspace, isAdmin,
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
}) => {
    const { showToast } = useToast();

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontFamily: font }}>

            {editingIcon ? (
                /* ── EDIT MODE ── */
                <div style={{ padding: '20px', background: accentBg, border: `1px solid ${accentBorder}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                        <h3 style={{ fontSize: '14px', fontWeight: 700, color: text, margin: 0 }}>Edit Workspace Settings</h3>
                        <span style={{ fontSize: '9px', fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.12em', padding: '2px 8px', background: accentBg, border: `1px solid ${accentBorder}` }}>Editing</span>
                    </div>

                    {/* Name */}
                    <div style={{ marginBottom: '20px' }}>
                        <label style={labelStyle}>Workspace Name</label>
                        <input
                            type="text" value={newWorkspaceName}
                            onChange={e => setNewWorkspaceName(e.target.value)}
                            placeholder="Enter workspace name"
                            style={inputStyle}
                            onFocus={e => e.currentTarget.style.borderColor = accentBorder}
                            onBlur={e => e.currentTarget.style.borderColor = border}
                        />
                    </div>

                    {/* Icon picker */}
                    <div style={{ marginBottom: '20px' }}>
                        <label style={labelStyle}>Choose Icon</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }}>
                            {iconOptions.map(option => {
                                const IconComp = option.Icon;
                                const isSelected = selectedIcon === option.id;
                                return (
                                    <button
                                        key={option.id}
                                        onClick={() => setSelectedIcon(option.id)}
                                        title={option.name}
                                        style={{ position: 'relative', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isSelected ? accentBg : surface, border: `1px solid ${isSelected ? accent : border}`, cursor: 'pointer', transition: 'all 150ms ease' }}
                                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
                                        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = border; }}
                                    >
                                        <IconComp size={20} style={{ color: isSelected ? accent : muted }} />
                                        {isSelected && (
                                            <div style={{ position: 'absolute', top: '-4px', right: '-4px', width: '14px', height: '14px', borderRadius: '50%', background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <svg width="8" height="8" viewBox="0 0 20 20" fill="#0c0c0c">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Color picker */}
                    <div style={{ marginBottom: '20px' }}>
                        <label style={labelStyle}>Choose Color</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '6px' }}>
                            {[
                                { name: 'Blue',    color: '#3b82f6' }, { name: 'Red',     color: '#ef4444' },
                                { name: 'Orange',  color: '#ea580c' }, { name: 'Yellow',  color: '#eab308' },
                                { name: 'Green',   color: '#16a34a' }, { name: 'Teal',    color: '#14b8a6' },
                                { name: 'Purple',  color: '#a855f7' }, { name: 'Pink',    color: '#ec4899' },
                                { name: 'Cyan',    color: '#06b6d4' }, { name: 'Lime',    color: '#84cc16' },
                                { name: 'Amber',   color: '#f59e0b' }, { name: 'Emerald', color: '#10b981' },
                                { name: 'Violet',  color: '#8b5cf6' }, { name: 'Fuchsia', color: '#d946ef' },
                                { name: 'Indigo',  color: '#6366f1' }, { name: 'Rose',    color: '#f43f5e' },
                            ].map(colorOpt => {
                                const isSelected = selectedColor === colorOpt.color;
                                return (
                                    <button
                                        key={colorOpt.color}
                                        onClick={() => setSelectedColor(colorOpt.color)}
                                        title={colorOpt.name}
                                        style={{ width: '36px', height: '36px', borderRadius: 0, border: `2px solid ${isSelected ? text : 'transparent'}`, backgroundColor: colorOpt.color, cursor: 'pointer', position: 'relative', transition: 'all 150ms ease', transform: isSelected ? 'scale(1.1)' : 'scale(1)' }}
                                    >
                                        {isSelected && (
                                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <svg width="14" height="14" viewBox="0 0 20 20" fill="white">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Preview */}
                    <div style={{ padding: '16px', background: surface, border: `1px solid ${border}`, marginBottom: '16px' }}>
                        <p style={{ fontSize: '10px', fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '12px' }}>Preview</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <div style={{ width: '56px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: selectedColor, flexShrink: 0 }}>
                                {(() => {
                                    const option = iconOptions.find(o => o.id === selectedIcon);
                                    const IC = option?.Icon || Rocket;
                                    return <IC size={28} style={{ color: '#fff' }} />;
                                })()}
                            </div>
                            <div>
                                <p style={{ fontSize: '15px', fontWeight: 700, color: text, margin: '0 0 4px' }}>{newWorkspaceName || 'Workspace Name'}</p>
                                <p style={{ fontSize: '11px', color: muted, margin: 0 }}>
                                    Icon: {iconOptions.find(o => o.id === selectedIcon)?.name || 'Rocket'} &nbsp;·&nbsp; Color: {selectedColor}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button
                            onClick={() => { setEditingIcon(false); setSelectedIcon(activeWorkspace?.icon || 'rocket'); setSelectedColor(activeWorkspace?.color || '#2563eb'); setNewWorkspaceName(workspaceName); }}
                            style={btnSecondary}
                            onMouseEnter={e => e.currentTarget.style.background = surface}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={async () => {
                                try {
                                    setSavingIcon(true); setSavingName(true);
                                    await api.put(`/api/workspaces/${activeWorkspace.id}`, { icon: selectedIcon, color: selectedColor });
                                    if (newWorkspaceName.trim() !== workspaceName) {
                                        await api.put(`/api/workspaces/${activeWorkspace.id}/rename`, { name: newWorkspaceName.trim() });
                                        setWorkspaceName(newWorkspaceName.trim());
                                    }
                                    setEditingIcon(false);
                                    showToast('Workspace updated successfully');
                                    window.location.reload();
                                } catch (error) {
                                    console.error('Error updating workspace:', error);
                                    showToast(error.response?.data?.message || 'Failed to update workspace', 'error');
                                } finally { setSavingIcon(false); setSavingName(false); }
                            }}
                            disabled={savingIcon || savingName || !newWorkspaceName.trim()}
                            style={{ ...btnPrimary, opacity: (savingIcon || savingName || !newWorkspaceName.trim()) ? 0.5 : 1 }}
                            onMouseEnter={e => { if (!savingIcon && !savingName) e.currentTarget.style.background = '#a07a58'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = accent; }}
                        >
                            {(savingIcon || savingName) ? 'Saving…' : 'Save All Changes'}
                        </button>
                    </div>
                </div>

            ) : (
                /* ── VIEW MODE ── */
                <>
                    {/* Workspace Details card */}
                    <div style={{ padding: '18px 20px', background: surface, border: `1px solid ${border}` }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
                            <h3 style={{ fontSize: '13px', fontWeight: 700, color: text, margin: 0 }}>Workspace Details</h3>
                            {isAdmin && (
                                <button
                                    onClick={() => { setEditingIcon(true); setSelectedIcon(activeWorkspace?.icon || 'rocket'); setSelectedColor(activeWorkspace?.color || '#2563eb'); setNewWorkspaceName(workspaceName); }}
                                    style={{ padding: '5px 12px', fontSize: '11px', fontWeight: 700, color: accent, background: accentBg, border: `1px solid ${accentBorder}`, cursor: 'pointer', fontFamily: font, transition: '150ms ease' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(184,149,106,0.18)'}
                                    onMouseLeave={e => e.currentTarget.style.background = accentBg}
                                >
                                    Edit Workspace
                                </button>
                            )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: activeWorkspace?.color || '#2563eb', flexShrink: 0 }}>
                                {(() => {
                                    const opt = iconOptions.find(o => o.id === (activeWorkspace?.icon || 'rocket'));
                                    const IC = opt?.Icon || Rocket;
                                    return <IC size={30} style={{ color: '#fff' }} />;
                                })()}
                            </div>
                            <div>
                                <h3 style={{ fontSize: '17px', fontWeight: 700, color: text, margin: '0 0 4px' }}>{workspaceName}</h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: muted }}>
                                    <span>Icon: <strong style={{ color: text }}>{iconOptions.find(o => o.id === (activeWorkspace?.icon || 'rocket'))?.name || 'Rocket'}</strong></span>
                                    <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>
                                    <span>Color: <strong style={{ color: text }}>{activeWorkspace?.color || '#2563eb'}</strong></span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Workspace Information */}
                    {loadingStats ? (
                        <p style={{ fontSize: '12px', color: muted }}>Loading workspace info…</p>
                    ) : stats && (
                        <div style={{ padding: '16px 20px', background: surface, border: `1px solid ${border}` }}>
                            <p style={{ fontSize: '10px', fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '12px' }}>Workspace Information</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                                {[
                                    { label: 'Created by',    value: stats.creator?.username || 'Unknown' },
                                    { label: 'Created on',    value: new Date(stats.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) },
                                    { label: 'Total members', value: stats.memberCount },
                                ].map((row, i, arr) => (
                                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < arr.length - 1 ? `1px solid ${border}` : 'none' }}>
                                        <span style={{ fontSize: '12px', color: muted }}>{row.label}</span>
                                        <span style={{ fontSize: '12px', fontWeight: 700, color: text }}>{row.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Rules & Guidelines */}
                    <div style={{ padding: '16px 20px', background: surface, border: `1px solid ${border}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                            <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: text, margin: 0 }}>
                                <Shield size={14} style={{ color: accent }} />
                                Rules &amp; Guidelines
                            </h4>
                            {isAdmin && !editingRules && (
                                <button
                                    onClick={() => setEditingRules(true)}
                                    style={{ padding: '3px 10px', fontSize: '11px', fontWeight: 600, color: accent, background: 'transparent', border: `1px solid ${accentBorder}`, cursor: 'pointer', fontFamily: font, transition: '150ms ease' }}
                                    onMouseEnter={e => e.currentTarget.style.background = accentBg}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                >
                                    Edit Rules
                                </button>
                            )}
                        </div>

                        {editingRules ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <textarea
                                    value={workspaceRules}
                                    onChange={e => setWorkspaceRules(e.target.value)}
                                    placeholder="Set the tone for your workspace. E.g., 'Be respectful', 'No spam'..."
                                    rows={5}
                                    style={{ ...inputStyle, resize: 'none' }}
                                    onFocus={e => e.currentTarget.style.borderColor = accentBorder}
                                    onBlur={e => e.currentTarget.style.borderColor = border}
                                />
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                    <button
                                        onClick={() => { setWorkspaceRules(activeWorkspace?.rules || ""); setEditingRules(false); }}
                                        style={btnSecondary}
                                        onMouseEnter={e => e.currentTarget.style.background = surface}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={async () => {
                                            try {
                                                setSavingRules(true);
                                                await api.put(`/api/workspaces/${activeWorkspace.id}`, { rules: workspaceRules });
                                                showToast('✅ Workspace rules updated successfully', 'success');
                                                setEditingRules(false);
                                                await refreshWorkspace();
                                            } catch (error) {
                                                console.error('Error updating rules:', error);
                                                showToast(error.response?.data?.message || 'Failed to update rules', 'error');
                                            } finally { setSavingRules(false); }
                                        }}
                                        disabled={savingRules}
                                        style={{ ...btnPrimary, opacity: savingRules ? 0.6 : 1 }}
                                    >
                                        {savingRules ? 'Saving…' : 'Save Rules'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            workspaceRules?.trim() ? (
                                <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px', color: muted, background: 'rgba(255,255,255,0.02)', padding: '12px', border: `1px solid ${border}`, fontFamily: font, margin: 0, lineHeight: 1.6 }}>
                                    {workspaceRules}
                                </pre>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                                    <Shield size={28} style={{ color: border, margin: '0 auto 8px', display: 'block' }} />
                                    <p style={{ fontSize: '12px', color: muted, margin: '0 0 4px' }}>No rules set for this workspace</p>
                                    {isAdmin && <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>Click "Edit Rules" to add guidelines for your team</p>}
                                </div>
                            )
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default GeneralTab;
