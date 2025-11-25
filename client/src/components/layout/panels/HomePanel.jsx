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

    const [workspaceName, setWorkspaceName] = useState("Chttrix HQ");
    const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
    const [showRenameModal, setShowRenameModal] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [activeSettingsTab, setActiveSettingsTab] = useState("General");
    const [newName, setNewName] = useState("");
    const [inviteEmail, setInviteEmail] = useState("");

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
                <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center animate-fade-in backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-[400px] p-6 transform transition-all scale-100">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Rename Workspace</h3>
                        <p className="text-sm text-gray-500 mb-6">This name will be visible to all members of your team.</p>

                        <label className="block text-sm font-semibold text-gray-700 mb-2">Workspace Name</label>
                        <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-6"
                            placeholder="e.g. Acme Corp"
                            autoFocus
                        />
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowRenameModal(false)}
                                className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRename}
                                className="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md hover:shadow-lg transition-all"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Workspace Settings Modal */}
            {showSettingsModal && (
                <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center animate-fade-in backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-[700px] h-[500px] flex overflow-hidden transform transition-all scale-100">
                        {/* Sidebar */}
                        <div className="w-48 bg-gray-50 border-r border-gray-200 p-4">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 px-2">Settings</h3>
                            <nav className="space-y-1">
                                {["General", "Permissions", "Members", "Billing"].map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveSettingsTab(tab)}
                                        className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeSettingsTab === tab ? "bg-blue-100 text-blue-700" : "text-gray-600 hover:bg-gray-200"}`}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </nav>
                        </div>

                        {/* Content */}
                        <div className="flex-1 p-8 overflow-y-auto">
                            <h2 className="text-2xl font-bold text-gray-900 mb-6">{activeSettingsTab} Settings</h2>

                            {activeSettingsTab === "General" && (
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Workspace Icon</label>
                                        <div className="flex items-center gap-4">
                                            <div className="w-16 h-16 bg-blue-600 rounded-lg flex items-center justify-center text-white text-2xl font-bold">
                                                {workspaceName.charAt(0)}
                                            </div>
                                            <button className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
                                                Upload Icon
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Workspace URL</label>
                                        <div className="flex rounded-md shadow-sm">
                                            <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                                                chttrix.com/
                                            </span>
                                            <input
                                                type="text"
                                                disabled
                                                value={workspaceName.toLowerCase().replace(/\s+/g, '-')}
                                                className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-r-md border border-gray-300 bg-gray-50 text-gray-500 sm:text-sm"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeSettingsTab === "Permissions" && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between py-3 border-b border-gray-100">
                                        <div>
                                            <h4 className="text-sm font-medium text-gray-900">Channel Creation</h4>
                                            <p className="text-sm text-gray-500">Allow members to create new channels</p>
                                        </div>
                                        <input type="checkbox" defaultChecked className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                                    </div>
                                    <div className="flex items-center justify-between py-3 border-b border-gray-100">
                                        <div>
                                            <h4 className="text-sm font-medium text-gray-900">Invite Members</h4>
                                            <p className="text-sm text-gray-500">Allow members to invite new people</p>
                                        </div>
                                        <input type="checkbox" defaultChecked className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                                    </div>
                                </div>
                            )}

                            {activeSettingsTab === "Members" && (
                                <div>
                                    <p className="text-sm text-gray-500 mb-4">Manage who has access to this workspace.</p>
                                    <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-500">
                                        Member list placeholder...
                                    </div>
                                </div>
                            )}

                            {activeSettingsTab === "Billing" && (
                                <div className="text-center py-8">
                                    <div className="text-4xl mb-2">💳</div>
                                    <h3 className="text-lg font-medium text-gray-900">Pro Plan</h3>
                                    <p className="text-gray-500 mb-4">You are currently on the Pro plan.</p>
                                    <button className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700">Manage Subscription</button>
                                </div>
                            )}
                        </div>

                        {/* Close Button */}
                        <button
                            onClick={() => setShowSettingsModal(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>
            )}

            {/* Invite Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center animate-fade-in backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-[600px] overflow-hidden transform transition-all scale-100">
                        {/* Header */}
                        <div className="px-8 py-6 border-b border-gray-100 bg-gray-50/50">
                            <h3 className="text-2xl font-bold text-gray-900">Invite people to {workspaceName}</h3>
                            <p className="text-gray-500 mt-1">Bring your team together to collaborate and chat.</p>
                        </div>

                        <div className="p-8">
                            {/* Invite Link Section */}
                            <div className="mb-8">
                                <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">Invite Link</label>
                                <div className="flex gap-2">
                                    <div className="flex-1 bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 text-gray-600 font-mono text-sm flex items-center select-all">
                                        https://chttrix.com/invite/{workspaceName.toLowerCase().replace(/\s+/g, '-')}-{Math.random().toString(36).substr(2, 6)}
                                    </div>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(`https://chttrix.com/invite/${workspaceName.toLowerCase().replace(/\s+/g, '-')}`);
                                            alert("Link copied to clipboard!");
                                        }}
                                        className="px-6 py-2 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm active:scale-95"
                                    >
                                        Copy
                                    </button>
                                </div>
                                <p className="text-xs text-gray-400 mt-2">This link expires in 7 days.</p>
                            </div>

                            {/* Email Invite Section */}
                            <div className="mb-8">
                                <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">Send via Email</label>
                                <input
                                    type="email"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    placeholder="name@example.com, colleague@work.com"
                                />
                            </div>

                            {/* Rules / Info Section */}
                            <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                                <h4 className="text-sm font-bold text-blue-800 mb-2 flex items-center gap-2">
                                    <span>ℹ️</span> Quick Rules
                                </h4>
                                <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                                    <li>Be kind and respectful to everyone.</li>
                                    <li>Keep conversations relevant to the channels.</li>
                                    <li>No spamming or sharing sensitive info.</li>
                                </ul>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-8 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                            <button
                                onClick={() => setShowInviteModal(false)}
                                className="px-6 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleInvite}
                                className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md hover:shadow-lg transition-all transform active:scale-95"
                            >
                                Send Invitations
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HomePanel;
