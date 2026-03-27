import React from 'react';
import { Lock, Unlock, AlertTriangle, Eraser, Trash2, Globe, Link } from 'lucide-react';

export default function SettingsTab({
    channel,
    isDefaultChannel,
    isEditingName,
    editedName,
    onEditedNameChange,
    onStartEditName,
    onSaveName,
    onCancelEditName,
    isEditingDescription,
    editedDescription,
    onEditedDescriptionChange,
    onStartEditDescription,
    onSaveDescription,
    onCancelEditDescription,
    privacyVerification,
    onPrivacyVerificationChange,
    onTogglePrivacy,
    onTogglePublic,
    deleteVerification,
    onDeleteVerificationChange,
    onDeleteChannel,
    onClearMessages,
    loading
}) {
    return (
        <div className="space-y-8">
            {/* Channel Information */}
            <div className="space-y-4">
                <h4 className="text-sm font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-800 pb-2">Channel Information</h4>

                {/* Channel Name */}
                <div className="flex items-center justify-between">
                    <div className="flex-1">
                        <div className="font-medium text-gray-800 dark:text-white text-sm">Channel Name</div>
                        <p className="text-xs text-gray-500 mt-0.5">
                            This is how your channel appears to all members
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {isEditingName ? (
                            <>
                                <input
                                    type="text"
                                    value={editedName}
                                    onChange={(e) => onEditedNameChange(e.target.value)}
                                    className="text-sm border border-blue-300 dark:border-blue-700 rounded px-3 py-1.5 w-48 focus:outline-none focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                    autoFocus
                                    disabled={loading || isDefaultChannel}
                                />
                                <button
                                    onClick={onSaveName}
                                    disabled={loading || !editedName.trim()}
                                    className="text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                                >
                                    Save
                                </button>
                                <button
                                    onClick={onCancelEditName}
                                    className="text-xs font-bold bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                            </>
                        ) : (
                            <>
                                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{channel.name}</span>
                                {!isDefaultChannel && (
                                    <button
                                        onClick={onStartEditName}
                                        className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
                                    >
                                        Edit
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Channel Description */}
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <div className="font-medium text-gray-800 dark:text-white text-sm">Channel Description</div>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Help others understand what this channel is for
                        </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-1">
                        {isEditingDescription ? (
                            <>
                                <textarea
                                    value={editedDescription}
                                    onChange={(e) => onEditedDescriptionChange(e.target.value)}
                                    className="text-sm border border-blue-300 dark:border-blue-700 rounded px-3 py-2 w-full focus:outline-none focus:border-blue-500 resize-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                    rows={3}
                                    autoFocus
                                    disabled={loading}
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={onSaveDescription}
                                        disabled={loading}
                                        className="text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        Save
                                    </button>
                                    <button
                                        onClick={onCancelEditDescription}
                                        className="text-xs font-bold bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-lg transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <p className="text-sm text-gray-600 dark:text-gray-400 text-right">{channel.description || "No description"}</p>
                                <button
                                    onClick={onStartEditDescription}
                                    className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
                                >
                                    {channel.description ? "Edit" : "Add Description"}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Privacy Settings (Hidden for Default Channels) */}
            {!isDefaultChannel && (
                <div className="space-y-4">
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-800 pb-2">Privacy & Visibility</h4>
                    <div className="flex items-start justify-between">
                        <div>
                            <div className="font-medium text-gray-800 flex items-center gap-2">
                                {channel.isPrivate ? <Lock size={16} /> : <Unlock size={16} />}
                                {channel.isPrivate ? "Private Channel" : "Public Channel"}
                            </div>
                            <p className="text-xs text-gray-500 mt-1 max-w-sm">
                                {channel.isPrivate
                                    ? "Only invited members can view and join this channel."
                                    : "Anyone in the workspace can view and join this channel."}
                            </p>
                        </div>
                        {channel.isPrivate ? (
                            <div className="flex flex-col items-end gap-2">
                                <input
                                    type="text"
                                    placeholder={`Type "${channel.name}" to confirm`}
                                    value={privacyVerification}
                                    onChange={(e) => onPrivacyVerificationChange(e.target.value)}
                                    className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 w-40 focus:outline-none focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                />
                                <button
                                    onClick={onTogglePrivacy}
                                    disabled={privacyVerification !== channel.name}
                                    className="text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                                >
                                    Make Public
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={onTogglePrivacy}
                                className="text-xs font-bold bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-lg transition-colors"
                            >
                                Make Private
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* ── COMMUNITY: External Share Link toggle (public, non-private channels only) */}
            {!isDefaultChannel && !channel.isPrivate && (
                <div className="space-y-3">
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-800 pb-2 flex items-center gap-2">
                        <Globe size={14} className="text-indigo-500" /> Community Sharing
                    </h4>
                    <div className="flex items-start justify-between">
                        <div>
                            <div className="font-medium text-gray-800 dark:text-gray-200 text-sm flex items-center gap-2">
                                Share via Public Link
                            </div>
                            <p className="text-xs text-gray-500 mt-1 max-w-xs">
                                {channel.isPublic
                                    ? "Anyone with the link can view this channel (read-only)."
                                    : "Allow anyone with a link to view this channel externally."}
                            </p>
                            {channel.isPublic && (
                                <div className="flex items-center gap-1.5 mt-2 text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded-lg w-fit">
                                    <Link size={10} /> Publicly accessible
                                </div>
                            )}
                        </div>
                        <button
                            onClick={() => onTogglePublic?.(!channel.isPublic)}
                            disabled={loading}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 mt-1 ${
                                channel.isPublic ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'
                            } disabled:opacity-50`}
                            role="switch"
                            aria-checked={channel.isPublic}
                            title={channel.isPublic ? "Disable public link" : "Enable public link"}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                                channel.isPublic ? 'translate-x-6' : 'translate-x-1'
                            }`} />
                        </button>
                    </div>
                </div>
            )}


            {/* Danger Zone (Hidden for Default Channels) */}
            {!isDefaultChannel && (
                <div className="space-y-4">
                    <h4 className="text-sm font-bold text-red-600 border-b border-red-100 dark:border-red-900/30 pb-2 flex items-center gap-2">
                        <AlertTriangle size={16} /> Danger Zone
                    </h4>

                    <div className="flex items-center justify-between p-4 border border-red-100 dark:border-red-900/50 rounded-xl bg-red-50/30 dark:bg-red-900/10">
                        <div>
                            <div className="font-bold text-gray-800 dark:text-gray-200 text-sm">Clear All Messages</div>
                            <p className="text-xs text-gray-500 mt-0.5">Permanently delete all message history in this channel.</p>
                        </div>
                        <button
                            onClick={onClearMessages}
                            className="text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 border border-red-200 dark:border-red-900/50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                        >
                            <Eraser size={14} /> Clear History
                        </button>
                    </div>

                    <div className="flex items-center justify-between p-4 border border-red-100 dark:border-red-900/50 rounded-xl bg-red-50/30 dark:bg-red-900/10">
                        <div>
                            <div className="font-bold text-gray-800 dark:text-gray-200 text-sm">Delete Channel</div>
                            <p className="text-xs text-gray-500 mt-0.5">Permanently delete this channel and all its data.</p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <input
                                type="text"
                                placeholder={`Type "${channel.name}" to confirm`}
                                value={deleteVerification}
                                onChange={(e) => onDeleteVerificationChange(e.target.value)}
                                className="text-xs border border-red-200 dark:border-red-900/50 rounded px-2 py-1 w-40 focus:outline-none focus:border-red-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            />
                            <button
                                onClick={onDeleteChannel}
                                disabled={deleteVerification !== channel.name}
                                className="text-xs font-bold bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                            >
                                <Trash2 size={14} /> Delete Channel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
