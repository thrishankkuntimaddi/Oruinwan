import React from 'react';
import { Smartphone, Monitor, LogOut } from 'lucide-react';
import Button from '../../shared/components/ui/Button';
import Card from './Card';

/**
 * SessionsTab - Active sessions management
 * @param {object} props - Component props
 * @param {Array} props.sessions - Array of active sessions
 * @param {function} props.handleLogoutSession - Logout single session handler
 * @param {function} props.handleLogoutOthers - Logout all other sessions handler
 * @param {function} props.handleLogout - Logout current session handler
 */
const SessionsTab = ({ sessions, handleLogoutSession, handleLogoutOthers, handleLogout }) => {
    return (
        <div className="space-y-6 animate-fade-in-up">
            <Card title="Active Sessions" subtitle="Devices currently logged into your account">
                <div className="space-y-4">
                    {Array.isArray(sessions) && sessions.map((session) => (
                        <div key={session.id} className="flex items-center justify-between p-4 border border-slate-100 dark:border-white/5 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${session.current ? 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400' : 'bg-slate-100 text-slate-500 dark:bg-[#111827] dark:text-slate-400'}`}>
                                    {session.os === 'mobile' ? <Smartphone size={22} /> : <Monitor size={22} />}
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 text-sm">
                                        {session.device || 'Unknown Device'}{session.browser && ` - ${session.browser}`}
                                        {session.current && (
                                            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full dark:bg-green-500/20 dark:text-green-400 font-bold">Current</span>
                                        )}
                                    </h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        {new Date(session.lastActive).toLocaleString()} · {session.location}
                                    </p>
                                </div>
                            </div>
                            {session.current ? (
                                <Button
                                    onClick={handleLogout}
                                    size="sm"
                                    variant="danger"
                                    icon={<LogOut size={14} />}
                                >
                                    Logout
                                </Button>
                            ) : (
                                <Button
                                    onClick={() => handleLogoutSession(session.id)}
                                    size="sm"
                                    variant="danger"
                                    className="opacity-0 group-hover:opacity-100"
                                >
                                    Revoke
                                </Button>
                            )}
                        </div>
                    ))}
                    {(!sessions || sessions.length === 0) && (
                        <div className="text-center py-12 text-slate-400">No active sessions found</div>
                    )}
                </div>
                {sessions && sessions.length > 1 && (
                    <div className="mt-6 pt-4 border-t border-slate-100 dark:border-white/5 flex justify-end">
                        <Button
                            onClick={handleLogoutOthers}
                            variant="danger"
                        >
                            Log Out All Other Devices
                        </Button>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default SessionsTab;
