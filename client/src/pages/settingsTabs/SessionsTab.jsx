import React, { useState, useCallback } from 'react';
import { Smartphone, Monitor, LogOut, RefreshCw, MapPin, Clock, Globe, AlertCircle } from 'lucide-react';
import Button from '../../shared/components/ui/Button';
import Card from './Card';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

/**
 * SessionsTab - Active sessions management with refresh
 */
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
        } catch (err) {
            showToast('Failed to refresh sessions', 'error');
        } finally {
            setRefreshing(false);
        }
    }, [showToast]);

    const revokeSession = async (sessionId) => {
        setRevokingId(sessionId);
        try {
            await handleLogoutSession(sessionId);
            setSessions(prev => prev.filter(s => s.id !== sessionId));
            showToast('Session revoked', 'success');
        } catch {
            showToast('Failed to revoke session', 'error');
        } finally {
            setRevokingId(null);
        }
    };

    const logoutOthers = async () => {
        try {
            await handleLogoutOthers();
            await refreshSessions();
        } catch { }
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

    return (
        <div className="space-y-6 animate-fade-in-up">
            <Card
                title="Active Sessions"
                subtitle="Devices currently logged into your account"
                action={
                    <button
                        onClick={refreshSessions}
                        disabled={refreshing}
                        className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    >
                        <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                }
            >
                <div className="space-y-3">
                    {Array.isArray(sessions) && sessions.map((session) => (
                        <div
                            key={session.id}
                            className={`flex items-center justify-between p-4 border rounded-xl transition-colors group ${session.current
                                    ? 'border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/10'
                                    : 'border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5'
                                }`}
                        >
                            <div className="flex items-center gap-4">
                                <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${session.current
                                        ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400'
                                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                                    }`}>
                                    {session.os === 'mobile' ? <Smartphone size={20} /> : <Monitor size={20} />}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-white">
                                        {session.device || 'Unknown Device'}
                                        {session.browser && <span className="font-normal text-slate-400">· {session.browser}</span>}
                                        {session.current && (
                                            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] rounded-full dark:bg-indigo-500/20 dark:text-indigo-400 font-bold">
                                                This device
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        {session.location && (
                                            <span className="flex items-center gap-1">
                                                <MapPin size={10} />
                                                {session.location}
                                            </span>
                                        )}
                                        {session.lastActive && (
                                            <span className="flex items-center gap-1">
                                                <Clock size={10} />
                                                {formatLastActive(session.lastActive)}
                                            </span>
                                        )}
                                        {session.ip && (
                                            <span className="flex items-center gap-1">
                                                <Globe size={10} />
                                                {session.ip}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {session.current ? (
                                <Button onClick={handleLogout} size="sm" variant="danger" icon={<LogOut size={13} />}>
                                    Sign Out
                                </Button>
                            ) : (
                                <Button
                                    onClick={() => revokeSession(session.id)}
                                    size="sm"
                                    variant="ghost"
                                    isLoading={revokingId === session.id}
                                    disabled={revokingId === session.id}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10"
                                >
                                    Revoke
                                </Button>
                            )}
                        </div>
                    ))}

                    {(!sessions || sessions.length === 0) && (
                        <div className="text-center py-12">
                            <AlertCircle className="mx-auto text-slate-300 dark:text-slate-600 mb-3" size={36} />
                            <p className="text-slate-500 dark:text-slate-400 text-sm">No active sessions found</p>
                            <button onClick={refreshSessions} className="text-indigo-600 dark:text-indigo-400 text-sm mt-2 hover:underline">
                                Try refreshing
                            </button>
                        </div>
                    )}
                </div>

                {sessions && sessions.length > 1 && (
                    <div className="mt-5 pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {sessions.length - 1} other active {sessions.length - 1 === 1 ? 'session' : 'sessions'}
                        </p>
                        <Button onClick={logoutOthers} variant="danger" size="sm" icon={<LogOut size={13} />}>
                            Sign Out All Other Devices
                        </Button>
                    </div>
                )}
            </Card>

            <Card title="Account Security" subtitle="Review important security information">
                <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl">
                    <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="text-sm font-bold text-amber-800 dark:text-amber-300">Unrecognised session?</p>
                        <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                            If you see a session you don't recognise, revoke it immediately and change your password in the <strong>Security</strong> tab.
                        </p>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default SessionsTab;
