// client/src/pages/SidebarComp/states/EmptyState.jsx

// ⚠️ UI-ONLY COMPONENT
// This component is pure presentational.
// DO NOT add navigation logic, API calls, or state management here.

/**
 * EmptyState - Welcome screen for Home route
 * 
 * Displays when no chat is selected. Shows branding, welcome message,
 * and navigation cards to channels and DMs.
 * 
 * @param {function} onNavigateChannels - Callback for "Channels" card click
 * @param {function} onNavigateDMs - Callback for "Direct Messages" card click
 */
function EmptyState({ onNavigateChannels, onNavigateDMs }) {
    return (
        <div className="flex flex-col items-center justify-center h-full bg-slate-50 dark:bg-gray-900 relative overflow-hidden">
            {/* Background Decor */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>

            <div className="relative z-10 flex flex-col items-center max-w-lg text-center p-8">
                <div className="w-24 h-24 mb-8 relative group">
                    <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-2xl blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-500"></div>
                    <div className="relative w-full h-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl flex items-center justify-center border border-indigo-50 dark:border-gray-700 group-hover:-translate-y-1 transition-transform duration-300 overflow-hidden">
                        <video
                            src="/hover-animation.mp4"
                            autoPlay
                            loop
                            muted
                            playsInline
                            className="w-full h-full object-cover"
                        />
                    </div>
                </div>

                <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-3 tracking-tight">
                    Welcome to <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">Chttrix</span>
                </h1>

                <p className="text-lg text-slate-500 dark:text-gray-400 mb-8 leading-relaxed">
                    Your command center for collaboration. Select a channel or direct message to start the conversation.
                </p>

                <div className="grid grid-cols-2 gap-4 w-full">
                    <div
                        onClick={onNavigateChannels}
                        className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-slate-100 dark:border-gray-700 shadow-sm flex items-center gap-3 cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all group"
                    >
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-100 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                        </div>
                        <div className="text-left">
                            <div className="font-bold text-slate-800 dark:text-gray-200 text-sm group-hover:text-indigo-600 transition-colors">Channels</div>
                            <div className="text-xs text-slate-400 dark:text-gray-500">Team discussions</div>
                        </div>
                    </div>

                    <div
                        onClick={onNavigateDMs}
                        className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-slate-100 dark:border-gray-700 shadow-sm flex items-center gap-3 cursor-pointer hover:shadow-md hover:border-purple-200 transition-all group"
                    >
                        <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg text-purple-600 dark:text-purple-400 group-hover:bg-purple-100 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="22" y1="21" x2="22" y2="21"></line><path d="M20 8v6"></path><path d="M23 11h-6"></path></svg>
                        </div>
                        <div className="text-left">
                            <div className="font-bold text-slate-800 dark:text-gray-200 text-sm group-hover:text-purple-600 transition-colors">Direct Messages</div>
                            <div className="text-xs text-slate-400 dark:text-gray-500">Private chats</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default EmptyState;
