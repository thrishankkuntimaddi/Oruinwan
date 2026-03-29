import React, { useState, useCallback } from 'react';
import { Smartphone, Monitor, LogOut, RefreshCw, MapPin, Clock, Globe, AlertCircle } from 'lucide-react';
import Card from './Card';
import api from '@services/api';
import { useToast } from '../../contexts/ToastContext';

const SessionsTab = ({ sessions: initialSessions, handleLogoutSession, handleLogoutOthers, handleLogout }) => {
    const { showToast } = useToast();
    const [sessions, setSessions] = useState(initialSessions || []);
    const [refreshing, setRefreshing] = useState(false);
    const [revokingId, setRevokingId] = useState(null);

    const refreshSessions = useCallback(async () => {
        setRefreshing(true);
        try {
            const { data } = await api.get('/api/auth/sessions');
            setSessions(Array.isArray(data) ? data : []);
        } catch { showToast('Failed to refresh sessions', 'error'); }
        finally { setRefreshing(false); }
    }, [showToast]);

    const revokeSession = async (sessionId) => {
        setRevokingId(sessionId);
        try {
            await handleLogoutSession(sessionId);
            setSessions(prev => prev.filter(s => s.id !== sessionId));
            showToast('Session revoked', 'success');
        } catch { showToast('Failed to revoke session', 'error'); }
        finally { setRevokingId(null); }
    };

    const logoutOthers = async () => {
        try { await handleLogoutOthers(); await refreshSessions(); } catch { }
    };

    const formatLastActive = (dateStr) => {
        if (!dateStr) return 'Unknown';
        const diff = Date.now() - new Date(dateStr).getTime();
        const m = Math.floor(diff / 60000);
        if (m < 1) return 'Just now';
        if (m < 60) return `${m}m ago`;
        const h = Math.floor(m / 60);
        if (h < 24) return `${h}h ago`;
        return new Date(dateStr).toLocaleDateString();
    };

    const refreshAction = (
        <button onClick={refreshSessions} disabled={refreshing}
            className="flex items-center gap-1.5 text-[11.5px] text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            Refresh
        </button>
    );

    return (
        <div className="space-y-4">
            <Card title="Active Sessions" subtitle="Devices logged into your account" action={refreshAction}>
                <div className="space-y-2">
                    {Array.isArray(sessions) && sessions.map(session => (
                        <div key={session.id}
                            className={`flex items-center justify-between p-3 border rounded-xl group transition-all ${session.current
                                    ? 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/10'
                                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                                }`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${session.current
                                        ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400'
                                        : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                                    }`}>
                                    {session.os === 'mobile' ? <Smartphone size={16} /> : <Monitor size={16} />}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[12.5px] font-semibold text-gray-800 dark:text-gray-100">
                                            {session.device || 'Unknown Device'}
                                            {session.browser && <span className="font-normal text-gray-400"> · {session.browser}</span>}
                                        </span>
                                        {session.current && (
                                            <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-bold rounded-full">
                                                This device
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-0.5">
                                        {session.location && <span className="flex items-center gap-1"><MapPin size={10} />{session.location}</span>}
                                        {session.lastActive && <span className="flex items-center gap-1"><Clock size={10} />{formatLastActive(session.lastActive)}</span>}
                                        {session.ip && <span className="flex items-center gap-1"><Globe size={10} />{session.ip}</span>}
                                    </div>
                                </div>
                            </div>

                            {session.current ? (
                                <button onClick={handleLogout}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 text-[12px] font-semibold rounded-lg transition-colors">
                                    <LogOut size={12} /> Sign Out
                                </button>
                            ) : (
                                <button
                                    onClick={() => revokeSession(session.id)}
                                    disabled={revokingId === session.id}
                                    className="opacity-0 group-hover:opacity-100 px-3 py-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 text-[12px] font-semibold rounded-lg transition-all"
                                >
                                    {revokingId === session.id ? 'Revoking…' : 'Revoke'}
                                </button>
                            )}
                        </div>
                    ))}

                    {(!sessions || sessions.length === 0) && (
                        <div className="text-center py-10">
                            <AlertCircle className="mx-auto text-gray-300 dark:text-gray-700 mb-2" size={28} />
                            <p className="text-[12px] text-gray-400">No active sessions found</p>
                            <button onClick={refreshSessions} className="text-[12px] text-blue-600 dark:text-blue-400 mt-1 hover:underline">Refresh</button>
                        </div>
                    )}
                </div>

                {sessions && sessions.length > 1 && (
                    <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between">
                        <span className="text-[11.5px] text-gray-400">{sessions.length - 1} other active {sessions.length - 1 === 1 ? 'session' : 'sessions'}</span>
                        <button onClick={logoutOthers}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 text-[12px] font-semibold rounded-lg transition-colors">
                            <LogOut size={12} /> Sign Out All Others
                        </button>
                    </div>
                )}
            </Card>

            <div className="flex items-start gap-2.5 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl">
                <AlertCircle size={14} className="text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <div>
                    <p className="text-[12.5px] font-bold text-amber-800 dark:text-amber-300">Unrecognised device?</p>
                    <p className="text-[11.5px] text-amber-700 dark:text-amber-400 mt-0.5">Revoke it immediately and change your password in the Security tab.</p>
                </div>
            </div>
        </div>
    );
};

export default SessionsTab;
