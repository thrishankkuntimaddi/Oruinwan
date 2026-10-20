import React, { useState } from 'react';
import { Shield, Check, LogOut, Pencil, Info } from 'lucide-react';
import api from '@services/api';
import { useToast } from '../../../contexts/ToastContext';
import logger from '../../../utils/logger';
import { WORKSPACE_ICON_OPTIONS, WorkspaceIcon, DEFAULT_WORKSPACE_COLOR } from '../../../utils/workspaceIcons';
import { Btn, Chip, Confirm, Field, Panel, EmptyState, LoadingState } from '../../ui/page';
import './generalTab.css';

const RULES_MAX = 5000;

const COLOR_OPTIONS = [
    { name: 'Gold',    color: '#b8956a' }, { name: 'Blue',    color: '#3b82f6' },
    { name: 'Red',     color: '#ef4444' }, { name: 'Orange',  color: '#ea580c' },
    { name: 'Yellow',  color: '#eab308' }, { name: 'Green',   color: '#16a34a' },
    { name: 'Teal',    color: '#14b8a6' }, { name: 'Purple',  color: '#a855f7' },
    { name: 'Pink',    color: '#ec4899' }, { name: 'Cyan',    color: '#06b6d4' },
    { name: 'Lime',    color: '#84cc16' }, { name: 'Amber',   color: '#f59e0b' },
    { name: 'Emerald', color: '#10b981' }, { name: 'Violet',  color: '#8b5cf6' },
    { name: 'Slate',   color: '#5c5852' }, { name: 'Rose',    color: '#f43f5e' },
];

const iconName = (icon) => WORKSPACE_ICON_OPTIONS.find(o => o.id === icon)?.name || 'Default';
const colorName = (c) => COLOR_OPTIONS.find(o => o.color.toLowerCase() === String(c || '').toLowerCase())?.name || 'Custom';

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

    const cancelEdit = () => { setEditingIcon(false); setSelectedIcon(activeWorkspace?.icon || 'rocket'); setSelectedColor(currentColor); setNewWorkspaceName(workspaceName); };
    const role = activeWorkspace?.role || 'member';

    return (
        <div className="wsg">
            {editingIcon ? (
                <Panel title="Edit workspace" icon={Pencil} action={<Chip tone="accent">Editing</Chip>}>
                    <div className="wsg-form">
                        <Field label="Name" htmlFor="ws-name-input">
                            <input
                                id="ws-name-input"
                                className="gl-input"
                                type="text" value={newWorkspaceName}
                                onChange={e => setNewWorkspaceName(e.target.value)}
                                placeholder="e.g. Acme Studio"
                                maxLength={80}
                            />
                        </Field>

                        <Field label="Icon">
                            <div className="wsg-icons" role="group" aria-label="Icon">
                                {WORKSPACE_ICON_OPTIONS.map(option => {
                                    const IconComp = option.Icon;
                                    const isSelected = selectedIcon === option.id;
                                    return (
                                        <button
                                            key={option.id}
                                            type="button"
                                            className="wsg-icon"
                                            onClick={() => setSelectedIcon(option.id)}
                                            title={option.name}
                                            aria-label={option.name}
                                            aria-pressed={isSelected}
                                        >
                                            <IconComp size={20} />
                                            {isSelected && <span className="wsg-tick"><Check size={9} strokeWidth={3} /></span>}
                                        </button>
                                    );
                                })}
                            </div>
                        </Field>

                        <Field label="Colour">
                            <div className="wsg-colors" role="group" aria-label="Colour">
                                {COLOR_OPTIONS.map(colorOpt => {
                                    const isSelected = selectedColor === colorOpt.color;
                                    return (
                                        <button
                                            key={colorOpt.color}
                                            type="button"
                                            className="wsg-color"
                                            onClick={() => setSelectedColor(colorOpt.color)}
                                            title={colorOpt.name}
                                            aria-label={colorOpt.name}
                                            aria-pressed={isSelected}
                                            style={{ backgroundColor: colorOpt.color }}
                                        >
                                            {isSelected && <Check size={14} strokeWidth={3} />}
                                        </button>
                                    );
                                })}
                            </div>
                        </Field>

                        <div className="wsg-preview">
                            <span className="cd-label">Preview</span>
                            <div className="wsg-id">
                                <span className="wsg-tile" style={{ backgroundColor: selectedColor }}>
                                    <WorkspaceIcon icon={selectedIcon} size={26} />
                                </span>
                                <div style={{ minWidth: 0 }}>
                                    <p className="wsg-name">{newWorkspaceName || 'Workspace name'}</p>
                                    <p className="wsg-sub">{iconName(selectedIcon)} icon · {colorName(selectedColor)}</p>
                                </div>
                            </div>
                        </div>

                        <div className="wsg-actions">
                            <Btn variant="ghost" onClick={cancelEdit} disabled={busy}>Cancel</Btn>
                            <Btn variant="primary" onClick={saveAll} loading={busy} disabled={!newWorkspaceName.trim()}>Save changes</Btn>
                        </div>
                    </div>
                </Panel>
            ) : (
                <>
                    <Panel
                        title="Workspace"
                        action={isAdmin && <Btn size="sm" icon={Pencil} onClick={startEditing}>Edit</Btn>}
                    >
                        <div className="wsg-id">
                            <span className="wsg-tile wsg-tile--lg" style={{ backgroundColor: currentColor }}>
                                <WorkspaceIcon icon={activeWorkspace?.icon} size={28} />
                            </span>
                            <div style={{ minWidth: 0 }}>
                                <h3 className="wsg-name wsg-name--lg">{workspaceName}</h3>
                                <div className="wsg-meta">
                                    <span>{iconName(activeWorkspace?.icon)} icon · {colorName(currentColor)}</span>
                                    <Chip tone={role === 'owner' || role === 'admin' ? 'accent' : undefined}>{role.charAt(0).toUpperCase() + role.slice(1)}</Chip>
                                </div>
                            </div>
                        </div>
                    </Panel>

                    {loadingStats ? (
                        <Panel><LoadingState label="Loading workspace details…" /></Panel>
                    ) : stats && (
                        <Panel title="Details" icon={Info} flush>
                            <dl className="wsg-rows">
                                {[
                                    { label: 'Created by',    value: stats.creator?.username || 'Unknown' },
                                    { label: 'Created on',    value: stats.createdAt ? new Date(stats.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '—' },
                                    { label: 'Members',       value: stats.memberCount ?? '—' },
                                ].map((row) => (
                                    <div key={row.label} className="wsg-row">
                                        <dt>{row.label}</dt>
                                        <dd>{row.value}</dd>
                                    </div>
                                ))}
                            </dl>
                        </Panel>
                    )}

                    <Panel
                        title="Rules and guidelines"
                        icon={Shield}
                        action={isAdmin && !editingRules && workspaceRules?.trim() && <Btn size="sm" icon={Pencil} onClick={() => setEditingRules(true)}>Edit</Btn>}
                    >
                        {editingRules ? (
                            <div className="wsg-form">
                                <textarea
                                    className="gl-input"
                                    value={workspaceRules}
                                    onChange={e => setWorkspaceRules(e.target.value.slice(0, RULES_MAX))}
                                    maxLength={RULES_MAX}
                                    placeholder="How should people work together here? e.g. Be respectful. Keep threads on topic. No spam."
                                    rows={6}
                                    aria-label="Workspace rules"
                                    style={{ resize: 'vertical', width: '100%', boxSizing: 'border-box', lineHeight: 1.6 }}
                                />
                                <div className="wsg-actions" style={{ justifyContent: 'space-between' }}>
                                    <span className="cd-hint" style={workspaceRules.length >= RULES_MAX ? { color: 'var(--state-danger)' } : undefined}>
                                        {workspaceRules.length.toLocaleString()} / {RULES_MAX.toLocaleString()}
                                    </span>
                                    <span style={{ display: 'flex', gap: 8 }}>
                                        <Btn variant="ghost" onClick={() => { setWorkspaceRules(activeWorkspace?.rules || ""); setEditingRules(false); }} disabled={savingRules}>Cancel</Btn>
                                        <Btn variant="primary" onClick={saveRules} loading={savingRules}>Save rules</Btn>
                                    </span>
                                </div>
                            </div>
                        ) : workspaceRules?.trim() ? (
                            <p className="wsg-rules">{workspaceRules}</p>
                        ) : (
                            <EmptyState
                                icon={Shield}
                                title="No rules yet"
                                text={isAdmin ? 'Rules are shown to everyone who joins, so expectations are clear from day one.' : 'An admin has not added any rules for this workspace.'}
                                action={isAdmin && <Btn variant="primary" icon={Pencil} onClick={() => setEditingRules(true)}>Write rules</Btn>}
                            />
                        )}
                    </Panel>

                    {!isOwner && onLeave && (
                        <Panel>
                            <div className="wsg-leave">
                                <div style={{ minWidth: 0 }}>
                                    <div className="wsg-leave-title">Leave workspace</div>
                                    <div className="cd-hint">You'll lose access to its channels, messages and files.</div>
                                </div>
                                <Btn variant="danger" icon={LogOut} onClick={() => setConfirmLeave(true)} disabled={leaving}>Leave</Btn>
                            </div>
                        </Panel>
                    )}
                    <Confirm
                        open={confirmLeave}
                        title={`Leave ${workspaceName}?`}
                        confirmLabel="Leave workspace"
                        tone="danger"
                        busy={leaving}
                        onConfirm={onLeave}
                        onClose={() => setConfirmLeave(false)}
                    >
                        You'll need a new invitation to come back.
                    </Confirm>
                </>
            )}
        </div>
    );
};

export default GeneralTab;
