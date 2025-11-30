import React from 'react';


const WorkspaceSettingsModal = ({
    showSettingsModal,
    setShowSettingsModal,
    activeSettingsTab,
    setActiveSettingsTab,
    workspaceName,
    setShowDeleteConfirm
}) => {


    if (!showSettingsModal) return null;

    return (
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
    );
};

export default WorkspaceSettingsModal;
