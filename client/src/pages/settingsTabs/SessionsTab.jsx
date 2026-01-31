import React from 'react';
import { Smartphone, Monitor } from 'lucide-react';
import Card from './Card';

/**
 * SessionsTab - Active sessions management
 * @param {object} props - Component props
 * @param {Array} props.sessions - Array of active sessions
 * @param {function} props.handleLogoutSession - Logout single session handler
 * @param {function} props.handleLogoutOthers - Logout all other sessions handler
 */
const SessionsTab = ({ sessions, handleLogoutSession, handleLogoutOthers }) => {
    return (
        <div className="space-y-6 animate-fade-in-up">
            <Card title="Active Sessions" subtitle="Devices currently logged into your account">
                <div className="space-y-4">
                    {sessions.map((session) => (
                        <div key={session._id} className="flex items-center justify-between p-4 border border-slate-100 dark:border-white/5 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${session.isCurrent ? 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400' : 'bg-slate-100 text-slate-500 dark:bg-[#111827] dark:text-slate-400'}`}>
                                    {session.deviceType === 'mobile' ? <Smartphone size={22} /> : <Monitor size={22} />}
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 text-sm">
                                        {session.deviceInfo || 'Unknown Device'}
                                        {session.isCurrent && (
                                            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full dark:bg-green-500/20 dark:text-green-400 font-bold">Current</span>
                                        )}
                                    </h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        {new Date(session.lastActive).toLocaleString()} · {session.ipAddress}
                                    </p>
                                </div>
                            </div>
                            {!session.isCurrent && (
                                <button
                                    onClick={() => handleLogoutSession(session._id)}
                                    className="text-xs font-bold text-red-500 hover:text-white px-3 py-1.5 hover:bg-red-500 rounded-lg transition-colors border border-red-100 dark:border-transparent bg-red-50 dark:bg-red-900/20 opacity-0 group-hover:opacity-100"
                                >
                                    Revoke
                                </button>
                            )}
                        </div>
                    ))}
                    {sessions.length === 0 && (
                        <div className="text-center py-12 text-slate-400">No active sessions found</div>
                    )}
                </div>
                {sessions.length > 1 && (
                    <div className="mt-6 pt-4 border-t border-slate-100 dark:border-white/5 flex justify-end">
                        <button
                            onClick={handleLogoutOthers}
                            className="px-4 py-2 bg-red-50 text-red-600 font-bold rounded-lg hover:bg-red-100 transition-colors text-sm dark:bg-red-900/10 dark:text-red-400 dark:hover:bg-red-900/20 border border-red-200 dark:border-red-900/30"
                        >
                            Log Out All Other Devices
                        </button>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default SessionsTab;
