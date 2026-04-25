import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import * as Icons from "lucide-react";
import api from '@services/api';
import { useTheme } from "../contexts/ThemeContext";

const JoinWorkspace = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user } = useAuth();
    const token = searchParams.get('token');
    const { theme, toggleTheme } = useTheme();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [workspaceDetails, setWorkspaceDetails] = useState(null);
    const [joining, setJoining] = useState(false);

    useEffect(() => {
        if (!token) {
            setError("Invalid invitation link");
            setLoading(false);
            return;
        }

        
        const fetchDetails = async () => {
            try {
                const response = await api.get(`/api/workspaces/invite/${token}`);
                const data = response.data;
                setWorkspaceDetails(data);
                setLoading(false);
            } catch (err) {
                setError(err.response?.data?.message || err.message || "Failed to fetch");
                setLoading(false);
            }
        };

        fetchDetails();
    }, [token]);

    const handleJoin = async () => {
        if (!user) {
            
            localStorage.setItem('pendingInvite', token);
            navigate('/login');
            return;
        }

        setJoining(true);
        try {
            const response = await api.post('/api/workspaces/join', { token });

            const data = response.data;

            
            localStorage.setItem('currentWorkspace', data.workspace.id);
            localStorage.removeItem('pendingInvite');

            navigate(`/workspace/${data.workspace.id}/home`, {
                state: {
                    message: `Successfully joined ${data.workspace.name}!`
                }
            });
        } catch (err) {
            console.error('Join workspace error:', err);
            setError(err.response?.data?.message || err.message || "Failed to join workspace");
            setJoining(false);
        }
    };

    
    const renderWorkspaceIcon = (iconName) => {
        if (!iconName) return <Icons.Rocket size={48} strokeWidth={1.5} />;

        
        const IconComponent = Icons[iconName.charAt(0).toUpperCase() + iconName.slice(1)];
        if (IconComponent) {
            return <IconComponent size={48} strokeWidth={1.5} />;
        }

        
        return <Icons.Hash size={48} strokeWidth={1.5} />;
    };

    if (loading) {
        return (
            <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-[#030712] transition-colors duration-500">
                <div className="text-center">
                    <Icons.Loader className="w-12 h-12 text-indigo-600 dark:text-indigo-400 animate-spin mx-auto mb-4" />
                    <p className="text-slate-600 dark:text-slate-400 font-medium">Verifying invitation...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-[#030712] transition-colors duration-500 p-6">
                {}
                <div className="absolute top-6 right-6 z-50">
                    <button
                        onClick={toggleTheme}
                        className="p-3 rounded-xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-md border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-slate-700/80 transition-all shadow-sm"
                    >
                        {theme === 'dark' ? <Icons.Sun size={20} /> : <Icons.Moon size={20} />}
                    </button>
                </div>

                <div className="backdrop-blur-xl bg-white/70 dark:bg-[#0B0F19]/60 border border-white/50 dark:border-white/10 shadow-2xl rounded-3xl p-8 max-w-md w-full text-center">
                    <div className="w-20 h-20 bg-red-100 dark:bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Icons.AlertCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Invitation Error</h1>
                    <p className="text-slate-600 dark:text-slate-400 mb-8">{error}</p>
                    <button
                        onClick={() => navigate('/workspaces')}
                        className="w-full py-3.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/25"
                    >
                        Go to Workspaces
                    </button>
                </div>
            </div>
        );
    }

    if (!workspaceDetails) {
        return null;
    }

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-[#030712] transition-colors duration-500 relative overflow-hidden font-sans selection:bg-indigo-500 selection:text-white">
            {}
            <div className={`absolute inset-0 transition-opacity duration-1000 ${theme === 'dark' ? 'opacity-100' : 'opacity-0'}`}>
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2"></div>
                <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/2"></div>
            </div>

            <div className={`absolute inset-0 transition-opacity duration-1000 ${theme === 'dark' ? 'opacity-0' : 'opacity-100'}`}>
                <div className="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] rounded-full bg-gradient-to-br from-blue-100/60 via-purple-100/30 to-transparent blur-[80px]"></div>
                <div className="absolute top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-gradient-to-bl from-indigo-100/60 via-pink-100/30 to-transparent blur-[80px]"></div>
            </div>

            {}
            <div className="absolute top-6 right-6 z-50">
                <button
                    onClick={toggleTheme}
                    className="p-3 rounded-xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-md border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-slate-700/80 transition-all shadow-sm"
                >
                    {theme === 'dark' ? <Icons.Sun size={20} /> : <Icons.Moon size={20} />}
                </button>
            </div>

            <div className="relative z-10 w-full max-w-lg px-6">
                <div className="backdrop-blur-xl bg-white/70 dark:bg-[#0B0F19]/60 border border-white/50 dark:border-white/10 shadow-2xl rounded-3xl p-8 md:p-10 animate-fade-in-up">

                    {}
                    <div className="text-center mb-8">
                        <div
                            className="w-24 h-24 rounded-3xl flex items-center justify-center text-white mx-auto mb-6 shadow-xl transform rotate-3 transition-transform hover:rotate-6"
                            style={{ backgroundColor: workspaceDetails.workspaceColor || '#4F46E5' }}
                        >
                            <span className="text-5xl drop-shadow-md">
                                {renderWorkspaceIcon(workspaceDetails.workspaceIcon)}
                            </span>
                        </div>

                        <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">
                            Join <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400">{workspaceDetails.workspaceName}</span>
                        </h1>

                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm font-medium text-slate-600 dark:text-slate-300 mb-4">
                            <span>Invited by</span>
                            <span className="font-bold text-slate-900 dark:text-white">{workspaceDetails.invitedBy}</span>
                        </div>

                        {workspaceDetails.workspaceDescription && (
                            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed max-w-sm mx-auto">
                                {workspaceDetails.workspaceDescription}
                            </p>
                        )}
                    </div>

                    {}
                    <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="bg-slate-50/50 dark:bg-white/5 rounded-2xl p-4 text-center border border-slate-200/50 dark:border-white/5">
                            <Icons.Users className="w-6 h-6 text-blue-500 dark:text-blue-400 mx-auto mb-2" />
                            <p className="text-xl font-bold text-slate-900 dark:text-white">{workspaceDetails.memberCount}</p>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Members</p>
                        </div>
                        <div className="bg-slate-50/50 dark:bg-white/5 rounded-2xl p-4 text-center border border-slate-200/50 dark:border-white/5">
                            <Icons.Shield className="w-6 h-6 text-purple-500 dark:text-purple-400 mx-auto mb-2" />
                            <p className="text-xl font-bold text-slate-900 dark:text-white capitalize">{workspaceDetails.role}</p>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Your Role</p>
                        </div>
                    </div>

                    {}
                    <div className="space-y-4">
                        <button
                            onClick={handleJoin}
                            disabled={joining}
                            className="group w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {joining ? (
                                <>
                                    <Icons.Loader className="w-5 h-5 animate-spin" />
                                    Joining...
                                </>
                            ) : (
                                <>
                                    {user ? 'Join Workspace' : 'Sign In & Join'}
                                    <Icons.ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>

                        <button
                            onClick={() => navigate('/workspaces')}
                            disabled={joining}
                            className="w-full py-4 text-slate-500 dark:text-slate-400 font-bold hover:text-slate-700 dark:hover:text-white transition-colors"
                        >
                            No thanks, maybe later
                        </button>
                    </div>

                    {!user && (
                        <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-6 font-medium">
                            Join securely. Create an account after accepting.
                        </p>
                    )}
                </div>
                <div className={`mt-8 text-center text-xs font-medium transition-colors duration-500 ${theme === 'dark' ? 'text-white/20' : 'text-slate-300'}`}>
                    Secure Invite System
                </div>
            </div>
        </div>
    );
};

export default JoinWorkspace;
