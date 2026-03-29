import React from 'react';
import { Rocket, Briefcase, Zap, Palette, FlaskConical, Globe, ShieldCheck, TrendingUp, Lightbulb, Flame, Target, Trophy, Shield } from 'lucide-react';
import api from '@services/api';
import { useToast } from '../../../contexts/ToastContext';

// Icon options for workspace customization
const iconOptions = [
    { id: 'rocket', name: 'Rocket', Icon: Rocket },
    { id: 'briefcase', name: 'Briefcase', Icon: Briefcase },
    { id: 'zap', name: 'Zap', Icon: Zap },
    { id: 'palette', name: 'Palette', Icon: Palette },
    { id: 'flask', name: 'Flask', Icon: FlaskConical },
    { id: 'globe', name: 'Globe', Icon: Globe },
    { id: 'shield', name: 'Shield', Icon: ShieldCheck },
    { id: 'trending', name: 'Trending', Icon: TrendingUp },
    { id: 'lightbulb', name: 'Lightbulb', Icon: Lightbulb },
    { id: 'flame', name: 'Flame', Icon: Flame },
    { id: 'target', name: 'Target', Icon: Target },
    { id: 'trophy', name: 'Trophy', Icon: Trophy }
];

/**
 * GeneralTab Component
 * Manages workspace general settings: name, icon, color, and rules
 */
const GeneralTab = ({
    activeWorkspace,
    isAdmin,
    workspaceName,
    setWorkspaceName,
    newWorkspaceName,
    setNewWorkspaceName,
    editingIcon,
    setEditingIcon,
    selectedIcon,
    setSelectedIcon,
    selectedColor,
    setSelectedColor,
    savingIcon,
    setSavingIcon,
    savingName,
    setSavingName,
    workspaceRules,
    setWorkspaceRules,
    editingRules,
    setEditingRules,
    savingRules,
    setSavingRules,
    stats,
    loadingStats,
    refreshWorkspace
}) => {
    const { showToast } = useToast();

    return (
        <div className="space-y-6">
            {editingIcon ? (
                /* EDIT MODE */
                <div className="space-y-8 bg-blue-50/30 dark:bg-blue-900/10 rounded-2xl p-6 border border-blue-100 dark:border-blue-800">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Edit Workspace Settings</h3>
                        <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full font-semibold">Editing</span>
                    </div>

                    {/* Workspace Name */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Workspace Name</label>
                        <input
                            type="text"
                            value={newWorkspaceName}
                            onChange={(e) => setNewWorkspaceName(e.target.value)}
                            className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-white placeholder-gray-400"
                            placeholder="Enter workspace name"
                        />
                    </div>

                    {/* Icon Selection */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Choose Icon</label>
                        <div className="grid grid-cols-6 gap-3">
                            {iconOptions.map((option) => {
                                const IconComponent = option.Icon;
                                const isSelected = selectedIcon === option.id;
                                return (
                                    <button
                                        key={option.id}
                                        onClick={() => setSelectedIcon(option.id)}
                                        className={`relative p-4 rounded-xl flex items-center justify-center transition-all bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border-2 ${isSelected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'border-gray-200 dark:border-gray-700'}`}
                                        title={option.name}
                                    >
                                        <IconComponent size={24} className="text-gray-700 dark:text-gray-300" />
                                        {isSelected && (
                                            <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center shadow-sm">
                                                <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Color Selection */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Choose Color</label>
                        <div className="grid grid-cols-8 gap-3">
                            {[
                                { name: 'Blue', color: '#3b82f6' },
                                { name: 'Red', color: '#ef4444' },
                                { name: 'Orange', color: '#ea580c' },
                                { name: 'Yellow', color: '#eab308' },
                                { name: 'Green', color: '#16a34a' },
                                { name: 'Teal', color: '#14b8a6' },
                                { name: 'Purple', color: '#a855f7' },
                                { name: 'Pink', color: '#ec4899' },
                                { name: 'Cyan', color: '#06b6d4' },
                                { name: 'Lime', color: '#84cc16' },
                                { name: 'Amber', color: '#f59e0b' },
                                { name: 'Emerald', color: '#10b981' },
                                { name: 'Violet', color: '#8b5cf6' },
                                { name: 'Fuchsia', color: '#d946ef' },
                                { name: 'Indigo', color: '#6366f1' },
                                { name: 'Rose', color: '#f43f5e' }
                            ].map((colorOption) => {
                                const isSelected = selectedColor === colorOption.color;
                                return (
                                    <button
                                        key={colorOption.color}
                                        onClick={() => setSelectedColor(colorOption.color)}
                                        className={`relative w-12 h-12 rounded-xl transition-all hover:scale-110 border-2 ${isSelected ? 'border-blue-500 scale-105 shadow-lg' : 'border-transparent'}`}
                                        style={{ backgroundColor: colorOption.color }}
                                        title={colorOption.name}
                                    >
                                        {isSelected && (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <svg className="w-6 h-6 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 20 20">
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
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Preview</h4>
                        <div className="flex items-center gap-4">
                            <div
                                className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg"
                                style={{ backgroundColor: selectedColor }}
                            >
                                {(() => {
                                    const option = iconOptions.find(opt => opt.id === selectedIcon);
                                    const IconComponent = option?.Icon || Rocket;
                                    return <IconComponent size={40} className="text-white" />;
                                })()}
                            </div>
                            <div>
                                <p className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                                    {newWorkspaceName || 'Workspace Name'}
                                </p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {iconOptions.find(opt => opt.id === selectedIcon)?.name || 'Rocket'} · {selectedColor}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            onClick={() => {
                                setEditingIcon(false);
                                setSelectedIcon(activeWorkspace?.icon || 'rocket');
                                setSelectedColor(activeWorkspace?.color || '#2563eb');
                                setNewWorkspaceName(workspaceName);
                            }}
                            className="px-6 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-semibold rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={async () => {
                                try {
                                    setSavingIcon(true);
                                    setSavingName(true);

                                    // Update everything in one call
                                    await api.put(`/api/workspaces/${activeWorkspace.id}`, {
                                        icon: selectedIcon,
                                        color: selectedColor
                                    });

                                    // Update name separately
                                    if (newWorkspaceName.trim() !== workspaceName) {
                                        await api.put(`/api/workspaces/${activeWorkspace.id}/rename`, {
                                            name: newWorkspaceName.trim()
                                        });
                                        setWorkspaceName(newWorkspaceName.trim());
                                    }

                                    setEditingIcon(false);
                                    showToast('Workspace updated successfully');

                                    // Refresh to update everywhere
                                    window.location.reload();
                                } catch (error) {
                                    console.error('Error updating workspace:', error);
                                    showToast(error.response?.data?.message || 'Failed to update workspace', 'error');
                                } finally {
                                    setSavingIcon(false);
                                    setSavingName(false);
                                }
                            }}
                            disabled={savingIcon || savingName || !newWorkspaceName.trim()}
                            className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm"
                        >
                            {(savingIcon || savingName) ? 'Saving...' : 'Save All Changes'}
                        </button>
                    </div>
                </div>
            ) : (
                /* VIEW MODE */
                <>
                    {/* Current Settings Display */}
                    <div className="bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
                        <div className="flex items-start justify-between mb-4">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Workspace Details</h3>
                            {isAdmin && (
                                <button
                                    onClick={() => {
                                        setEditingIcon(true);
                                        setSelectedIcon(activeWorkspace?.icon || 'rocket');
                                        setSelectedColor(activeWorkspace?.color || '#2563eb');
                                        setNewWorkspaceName(workspaceName);
                                    }}
                                    className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                                >
                                    Edit Workspace
                                </button>
                            )}
                        </div>

                        <div className="flex items-center gap-6">
                            <div
                                className="w-24 h-24 rounded-2xl flex items-center justify-center shadow-lg"
                                style={{ backgroundColor: activeWorkspace?.color || '#2563eb' }}
                            >
                                {(() => {
                                    const currentOption = iconOptions.find(opt => opt.id === (activeWorkspace?.icon || 'rocket'));
                                    const IconComponent = currentOption?.Icon || Rocket;
                                    return <IconComponent size={48} className="text-white" />;
                                })()}
                            </div>

                            <div className="flex-1">
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{workspaceName}</h3>
                                <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                                    <span className="flex items-center gap-1">
                                        <span className="font-semibold">Icon:</span>
                                        {iconOptions.find(opt => opt.id === (activeWorkspace?.icon || 'rocket'))?.name || 'Rocket'}
                                    </span>
                                    <span className="text-gray-400 dark:text-gray-600">•</span>
                                    <span className="flex items-center gap-1">
                                        <span className="font-semibold">Color:</span>
                                        {activeWorkspace?.color || '#2563eb'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Workspace Information */}
                    {loadingStats ? (
                        <div className="text-sm text-gray-500 dark:text-gray-400">Loading workspace info...</div>
                    ) : stats && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                            <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Workspace Information</h4>
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                                    <span className="text-gray-600 dark:text-gray-400">Created by</span>
                                    <span className="font-semibold text-gray-900 dark:text-white">{stats.creator?.username || 'Unknown'}</span>
                                </div>
                                <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                                    <span className="text-gray-600 dark:text-gray-400">Created on</span>
                                    <span className="font-semibold text-gray-900 dark:text-white">
                                        {new Date(stats.createdAt).toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric'
                                        })}
                                    </span>
                                </div>
                                <div className="flex justify-between py-2">
                                    <span className="text-gray-600 dark:text-gray-400">Total members</span>
                                    <span className="font-semibold text-gray-900 dark:text-white">{stats.memberCount}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Workspace Rules & Guidelines */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <Shield size={16} className="text-blue-600 dark:text-blue-400" />
                                Rules & Guidelines
                            </h4>
                            {isAdmin && !editingRules && (
                                <button
                                    onClick={() => setEditingRules(true)}
                                    className="px-3 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                >
                                    Edit Rules
                                </button>
                            )}
                        </div>

                        {editingRules ? (
                            <div className="space-y-4">
                                <textarea
                                    value={workspaceRules}
                                    onChange={(e) => setWorkspaceRules(e.target.value)}
                                    placeholder="Set the tone for your workspace. E.g., 'Be respectful', 'No spam', 'Updates every Friday'..."
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-white placeholder-gray-400 text-sm h-32 resize-none"
                                />
                                <div className="flex justify-end gap-2">
                                    <button
                                        onClick={() => {
                                            setWorkspaceRules(activeWorkspace?.rules || "");
                                            setEditingRules(false);
                                        }}
                                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={async () => {
                                            try {
                                                setSavingRules(true);
                                                await api.put(`/api/workspaces/${activeWorkspace.id}`, {
                                                    rules: workspaceRules
                                                });
                                                showToast('✅ Workspace rules updated successfully', 'success');
                                                setEditingRules(false);
                                                await refreshWorkspace();
                                            } catch (error) {
                                                console.error('Error updating rules:', error);
                                                showToast(error.response?.data?.message || 'Failed to update rules', 'error');
                                            } finally {
                                                setSavingRules(false);
                                            }
                                        }}
                                        disabled={savingRules}
                                        className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                                    >
                                        {savingRules ? 'Saving...' : 'Save Rules'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div>
                                {workspaceRules && workspaceRules.trim() ? (
                                    <div className="prose prose-sm dark:prose-invert max-w-none">
                                        <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700 font-sans">{workspaceRules}</pre>
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <Shield className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">No rules set for this workspace</p>
                                        {isAdmin && (
                                            <p className="text-xs text-gray-400 dark:text-gray-500">Click "Edit Rules" to add guidelines for your team</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default GeneralTab;
