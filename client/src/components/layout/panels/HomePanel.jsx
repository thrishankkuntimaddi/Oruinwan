import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const HomePanel = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const currentPath = location.pathname;

    const [expanded, setExpanded] = useState({
        favorites: true,
        channels: true,
        dms: true,
    });

    const [workspaceName, setWorkspaceName] = useState(localStorage.getItem("currentWorkspace") || "Chttrix HQ");
    const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
    const [showRenameModal, setShowRenameModal] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [activeSettingsTab, setActiveSettingsTab] = useState("General");
    const [newName, setNewName] = useState("");
    const [inviteEmail, setInviteEmail] = useState("");
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteVerification, setDeleteVerification] = useState("");

    const toggle = (section) => {
        setExpanded((prev) => ({ ...prev, [section]: !prev[section] }));
    };

    const handleRename = () => {
        if (newName.trim()) {
            setWorkspaceName(newName);
            setShowRenameModal(false);
            setNewName("");
        }
    };

    const handleInvite = () => {
        if (inviteEmail.trim()) {
            alert(`Invitation sent to ${inviteEmail}`);
            setShowInviteModal(false);
            setInviteEmail("");
        }
    };

    const handleDeleteWorkspace = () => {
        if (deleteVerification === workspaceName) {
            alert(`Workspace "${workspaceName}" has been deleted.`);
            setShowDeleteConfirm(false);
            setShowSettingsModal(false);
            navigate("/workspaces");
        }
    };

    const SectionHeader = ({ label, isOpen, onClick, onAdd }) => (
        <div className="flex items-center justify-between px-4 py-2 group cursor-pointer hover:text-gray-900 text-gray-500 mt-2">
            <div className="flex items-center" onClick={onClick}>
                <span className={`mr-2 text-[10px] transition-transform ${isOpen ? "rotate-90" : ""}`}>▶</span>
                <span className="uppercase text-xs font-bold tracking-wide">{label}</span>
            </div>
            {onAdd && (
                <button
                    className="opacity-0 group-hover:opacity-100 hover:bg-gray-200 rounded p-1 text-gray-600 transition-opacity"
                    onClick={(e) => { e.stopPropagation(); onAdd(); }}
                >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                </button>
            )}
        </div>
    );

    const Item = ({ icon, label, path, hasUnread }) => {
        const isActive = currentPath === path;
        return (
            <div
                onClick={() => navigate(path)}
                className={`px-4 py-1.5 mx-2 rounded-md cursor-pointer flex items-center justify-between group transition-colors ${isActive
                    ? "bg-blue-100 text-blue-700 font-medium"
                    : "hover:bg-gray-200 text-gray-600 hover:text-gray-900"
                    }`}
            >
                <div className="flex items-center truncate">
                    <span className="mr-2 opacity-70 text-lg">{icon}</span>
                    <span className="truncate text-sm">{label}</span>
                </div>
                {hasUnread && <div className="w-2 h-2 bg-blue-600 rounded-full"></div>}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-gray-50 relative">
            {/* Workspace Header with Dropdown */}
            <div className="h-12 flex items-center justify-between px-4 hover:bg-gray-100 transition-colors group relative select-none">
                <div
                    className="flex items-center font-bold text-gray-900 cursor-pointer flex-1"
                    onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
                >
                    <span className="truncate max-w-[160px]">{workspaceName}</span>
                    <span className={`ml-2 text-xs text-gray-500 transition-transform ${showWorkspaceMenu ? "rotate-180" : ""}`}>▼</span>
                </div>
                <button
                    className="text-gray-500 hover:bg-gray-200 p-1 rounded"
                    onClick={(e) => { e.stopPropagation(); alert("New Message"); }}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>

                {/* Dropdown Menu */}
                {showWorkspaceMenu && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowWorkspaceMenu(false)}></div>
                        <div className="absolute top-10 left-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-50 py-1 animate-fade-in origin-top-left">
                            <div className="px-4 py-3 border-b border-gray-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded bg-blue-600 text-white flex items-center justify-center font-bold text-lg">
                                        {workspaceName.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-gray-900 truncate">{workspaceName}</div>
                                        <div className="text-xs text-gray-500">cchtrix.com</div>
                                    </div>
                                </div>
                            </div>

                            <div className="py-1">
                                <button
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
                                    onClick={() => { setShowInviteModal(true); setShowWorkspaceMenu(false); }}
                                >
                                    <span>👋</span> Invite people to {workspaceName}
                                </button>
                                <button
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
                                    onClick={() => { setShowSettingsModal(true); setShowWorkspaceMenu(false); }}
                                >
                                    <span>⚙️</span> Workspace Settings
                                </button>
                                <button
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
                                    onClick={() => { setShowRenameModal(true); setShowWorkspaceMenu(false); setNewName(workspaceName); }}
                                >
                                    <span>✏️</span> Rename Workspace
                                </button>
                            </div>

                            <div className="border-t border-gray-100 py-1">
                                <button
                                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                    onClick={() => navigate("/workspaces")}
                                >
                                    <span>🚪</span> Sign out of {workspaceName}
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Divider */}
            <div className="border-t border-gray-200 mx-4 mt-2 mb-2"></div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pb-4">

                {/* Favorites */}
                <SectionHeader label="Favorites" isOpen={expanded.favorites} onClick={() => toggle("favorites")} />
                {expanded.favorites && (
                    <div className="space-y-0.5">
                        <Item icon="⭐" label="general" path="/channel/general" />
                        <Item icon="⭐" label="announcements" path="/channel/announcements" />
                    </div>
                )}

                {/* Channels */}
                <SectionHeader
                    label="Channels"
                    isOpen={expanded.channels}
                    onClick={() => toggle("channels")}
                    onAdd={() => alert("Create Channel Modal")}
                />
                {expanded.channels && (
                    <div className="space-y-0.5">
                        <Item icon="#" label="engineering" path="/channel/engineering" />
                        <Item icon="#" label="design" path="/channel/design" />
                        <Item icon="#" label="marketing" path="/channel/marketing" />
                        <Item icon="🔒" label="leadership" path="/channel/leadership" />
                    </div>
                )}

                {/* Direct Messages */}
                <SectionHeader
                    label="Direct Messages"
                    isOpen={expanded.dms}
                    onClick={() => toggle("dms")}
                    onAdd={() => alert("New DM Modal")}
                />
                {expanded.dms && (
                    <div className="space-y-0.5">
                        <Item icon="👤" label="Sarah Connor" path="/dm/sarah" />
                        <Item icon="👤" label="John Doe" path="/dm/john" />
                        <Item icon="👤" label="Alice Smith" path="/dm/alice" />
                    </div>
                )}
            </div>

            {/* Rename Modal */}
            {showRenameModal && (
                <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center animate-fade-in backdrop-blur-md">
                    <div className="bg-white rounded-2xl shadow-2xl w-[420px] p-8 transform transition-all scale-100 border border-gray-100">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Rename Workspace</h3>
                        <p className="text-sm text-gray-500 mb-6 leading-relaxed">Choose a new name for your team's workspace. This will be visible to everyone.</p>

                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Workspace Name</label>
                        <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all mb-6 text-gray-900 placeholder-gray-400"
                            placeholder="e.g. Acme Corp"
                            autoFocus
                        />
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowRenameModal(false)}
                                className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRename}
                                className="px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-md hover:shadow-lg hover:scale-[1.02] transition-all"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Workspace Settings Modal */}
            {showSettingsModal && (
                <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center animate-fade-in backdrop-blur-md">
                    <div className="bg-white rounded-2xl shadow-2xl w-[800px] h-[600px] flex overflow-hidden transform transition-all scale-100 border border-gray-100">
                        {/* Sidebar */}
                        <div className="w-56 bg-gray-50/80 backdrop-blur-sm border-r border-gray-200 p-6">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-6 px-2">Settings</h3>
                            <nav className="space-y-1">
                                {["General", "Permissions", "Members", "Billing", "Advanced"].map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveSettingsTab(tab)}
                                        className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${activeSettingsTab === tab
                                            ? "bg-white text-blue-600 shadow-sm ring-1 ring-gray-200"
                                            : "text-gray-600 hover:bg-gray-200/50 hover:text-gray-900"}`}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </nav>
                        </div>

                        {/* Content */}
                        <div className="flex-1 p-10 overflow-y-auto bg-white">
                            <h2 className="text-2xl font-bold text-gray-900 mb-8">{activeSettingsTab}</h2>

                            {activeSettingsTab === "General" && (
                                <div className="space-y-8">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-3">Workspace Icon</label>
                                        <div className="flex items-center gap-6">
                                            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                                                {workspaceName.charAt(0)}
                                            </div>
                                            <button className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all">
                                                Upload New Icon
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-3">Workspace URL</label>
                                        <div className="flex rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
                                            <span className="inline-flex items-center px-4 border-r border-gray-200 bg-gray-50 text-gray-500 text-sm font-medium">
                                                chttrix.com/
                                            </span>
                                            <input
                                                type="text"
                                                disabled
                                                value={workspaceName.toLowerCase().replace(/\s+/g, '-')}
                                                className="flex-1 min-w-0 block w-full px-4 py-3 bg-white text-gray-500 sm:text-sm border-none focus:ring-0"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeSettingsTab === "Permissions" && (
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between py-4 border-b border-gray-100">
                                        <div>
                                            <h4 className="text-sm font-bold text-gray-900">Channel Creation</h4>
                                            <p className="text-sm text-gray-500 mt-1">Allow members to create new channels</p>
                                        </div>
                                        <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
                                            <input type="checkbox" name="toggle" id="toggle1" defaultChecked className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer" />
                                            <label htmlFor="toggle1" className="toggle-label block overflow-hidden h-6 rounded-full bg-blue-600 cursor-pointer"></label>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between py-4 border-b border-gray-100">
                                        <div>
                                            <h4 className="text-sm font-bold text-gray-900">Invite Members</h4>
                                            <p className="text-sm text-gray-500 mt-1">Allow members to invite new people</p>
                                        </div>
                                        <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
                                            <input type="checkbox" name="toggle" id="toggle2" defaultChecked className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer" />
                                            <label htmlFor="toggle2" className="toggle-label block overflow-hidden h-6 rounded-full bg-blue-600 cursor-pointer"></label>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeSettingsTab === "Members" && (
                                <div>
                                    <p className="text-sm text-gray-500 mb-6">Manage who has access to this workspace.</p>
                                    <div className="bg-gray-50 rounded-xl p-8 text-center border border-gray-200 border-dashed">
                                        <div className="text-gray-400 mb-2">👥</div>
                                        <p className="text-gray-500 text-sm">Member list integration coming soon...</p>
                                    </div>
                                </div>
                            )}

                            {activeSettingsTab === "Billing" && (
                                <div className="text-center py-12">
                                    <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">💳</div>
                                    <h3 className="text-lg font-bold text-gray-900 mb-2">Pro Plan</h3>
                                    <p className="text-gray-500 mb-6">You are currently on the Pro plan.</p>
                                    <button className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 shadow-md hover:shadow-lg transition-all">
                                        Manage Subscription
                                    </button>
                                </div>
                            )}

                            {activeSettingsTab === "Advanced" && (
                                <div>
                                    <div className="bg-red-50/50 border border-red-100 rounded-2xl p-8">
                                        <h3 className="text-lg font-bold text-red-900 mb-2">Danger Zone</h3>
                                        <p className="text-sm text-red-700/80 mb-8 leading-relaxed">
                                            Deleting a workspace is permanent and cannot be undone. All messages, files, and data will be lost forever.
                                            <br />
                                            <strong>Only administrators can perform this action.</strong>
                                        </p>
                                        <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-red-100 shadow-sm">
                                            <div>
                                                <h4 className="text-sm font-bold text-gray-900">Delete this workspace</h4>
                                                <p className="text-xs text-gray-500 mt-1">Once deleted, it's gone for good.</p>
                                            </div>
                                            <button
                                                onClick={() => setShowDeleteConfirm(true)}
                                                className="px-5 py-2.5 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 shadow-md hover:shadow-lg transition-all"
                                            >
                                                Delete Workspace
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Close Button */}
                        <button
                            onClick={() => setShowSettingsModal(false)}
                            className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 bg-white rounded-full p-1 hover:bg-gray-100 transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>
            )}

            {/* Invite Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center animate-fade-in backdrop-blur-md">
                    <div className="bg-white rounded-2xl shadow-2xl w-[600px] overflow-hidden transform transition-all scale-100 border border-gray-100">
                        {/* Header */}
                        <div className="px-8 py-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                            <h3 className="text-2xl font-bold text-gray-900">Invite people to {workspaceName}</h3>
                            <p className="text-gray-500 mt-1">Bring your team together to collaborate and chat.</p>
                        </div>

                        <div className="p-8">
                            {/* Invite Link Section */}
                            <div className="mb-8">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Invite Link</label>
                                <div className="flex gap-2">
                                    <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-600 font-mono text-sm flex items-center select-all shadow-inner">
                                        https://chttrix.com/invite/{workspaceName.toLowerCase().replace(/\s+/g, '-')}-{Math.random().toString(36).substr(2, 6)}
                                    </div>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(`https://chttrix.com/invite/${workspaceName.toLowerCase().replace(/\s+/g, '-')}`);
                                            alert("Link copied to clipboard!");
                                        }}
                                        className="px-6 py-2 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm hover:shadow active:scale-95"
                                    >
                                        Copy
                                    </button>
                                </div>
                                <p className="text-xs text-gray-400 mt-2">This link expires in 7 days.</p>
                            </div>

                            {/* Email Invite Section */}
                            <div className="mb-8">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Send via Email</label>
                                <input
                                    type="email"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                    placeholder="name@example.com, colleague@work.com"
                                />
                            </div>

                            {/* Rules / Info Section */}
                            <div className="bg-blue-50/50 rounded-xl p-5 border border-blue-100">
                                <h4 className="text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
                                    <span>ℹ️</span> Quick Rules
                                </h4>
                                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside opacity-80">
                                    <li>Be kind and respectful to everyone.</li>
                                    <li>Keep conversations relevant to the channels.</li>
                                    <li>No spamming or sharing sensitive info.</li>
                                </ul>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-8 py-5 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                            <button
                                onClick={() => setShowInviteModal(false)}
                                className="px-6 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleInvite}
                                className="px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-md hover:shadow-lg transition-all transform active:scale-[1.02]"
                            >
                                Send Invitations
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/70 z-[70] flex items-center justify-center animate-fade-in backdrop-blur-md">
                    <div className="bg-white rounded-2xl shadow-2xl w-[480px] p-8 transform transition-all scale-100 border border-gray-100 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-orange-500"></div>

                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-600">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">Delete Workspace?</h3>
                                <p className="text-sm text-gray-500">This action is permanent.</p>
                            </div>
                        </div>

                        <p className="text-sm text-gray-600 mb-6 leading-relaxed bg-red-50 p-4 rounded-xl border border-red-100">
                            You are about to permanently delete <strong>{workspaceName}</strong>. This action <strong>cannot</strong> be undone. All channels, messages, and files will be irretrievably lost.
                        </p>

                        <div className="mb-8">
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                                To confirm, type <span className="text-gray-900 select-all">"{workspaceName}"</span> below:
                            </label>
                            <input
                                type="text"
                                value={deleteVerification}
                                onChange={(e) => setDeleteVerification(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-red-500/20 focus:border-red-500 font-mono text-sm transition-all"
                                placeholder={workspaceName}
                                autoFocus
                            />
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => { setShowDeleteConfirm(false); setDeleteVerification(""); }}
                                className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteWorkspace}
                                disabled={deleteVerification !== workspaceName}
                                className={`px-5 py-2.5 text-sm font-bold text-white rounded-xl shadow-md transition-all ${deleteVerification === workspaceName
                                    ? "bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 hover:shadow-lg hover:scale-[1.02]"
                                    : "bg-gray-300 cursor-not-allowed"
                                    }`}
                            >
                                Delete Workspace
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HomePanel;
