import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, CheckCircle, XCircle, RefreshCw, Mail, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '@services/api';

const ApplicationReview = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [companyStatus, setCompanyStatus] = useState({
        name: '',
        verificationStatus: 'pending',
        submittedAt: null
    });
    const [refreshing, setRefreshing] = useState(false);

    
    const fetchCompanyStatus = async () => {
        if (!user?.company_Id) return;

        try {
            setRefreshing(true);
            const res = await api.get(
                `/api/companies/${user.companyId}`
            );

            setCompanyStatus({
                name: res.data.name,
                verificationStatus: res.data.verificationStatus,
                submittedAt: res.data.createdAt
            });

            
            if (res.data.verificationStatus === 'verified') {
                if (!res.data.isSetupComplete) {
                    navigate('/company-setup');
                } else {
                    navigate('/home');
                }
            }

            
            if (res.data.verificationStatus === 'rejected') {
                
            }
        } catch (error) {
            console.error('Error fetching company status:', error);
        } finally {
            setRefreshing(false);
        }
    };

    
    useEffect(() => {
        fetchCompanyStatus();
    }, []);

    
    useEffect(() => {
        const interval = setInterval(() => {
            fetchCompanyStatus();
        }, 30000); 

        return () => clearInterval(interval);
    }, [user]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                {}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-8 text-white">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                                <Clock size={28} className="animate-pulse" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold">Application in Review</h1>
                                <p className="text-indigo-100 text-sm">Your registration is being processed</p>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                            title="Logout"
                        >
                            <LogOut size={20} />
                        </button>
                    </div>
                </div>

                {}
                <div className="p-8 space-y-6">
                    {}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Company Name</span>
                            <span className="font-semibold text-gray-900 dark:text-white">{companyStatus.name}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Status</span>
                            <span className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded-full text-sm font-semibold">
                                <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                                Pending Review
                            </span>
                        </div>
                        {companyStatus.submittedAt && (
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600 dark:text-gray-400">Submitted</span>
                                <span className="text-sm text-gray-900 dark:text-white">
                                    {new Date(companyStatus.submittedAt).toLocaleDateString('en-US', {
                                        month: 'long',
                                        day: 'numeric',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </span>
                            </div>
                        )}
                    </div>

                    {}
                    <div className="border-t border-gray-200 dark:border-gray-700" />

                    {}
                    <div className="space-y-4">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">What happens next?</h2>
                        <div className="space-y-3">
                            <div className="flex gap-3">
                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-sm font-bold">
                                    1
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">Document Verification</p>
                                    <p className="text-xs text-gray-600 dark:text-gray-400">Our team reviews your submitted documents and company information</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-sm font-bold">
                                    2
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">Domain Validation</p>
                                    <p className="text-xs text-gray-600 dark:text-gray-400">We verify your company domain ownership</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-sm font-bold">
                                    3
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">Workspace Provisioning</p>
                                    <p className="text-xs text-gray-600 dark:text-gray-400">Once approved, your workspace will be created automatically</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {}
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Clock size={16} className="text-blue-600 dark:text-blue-400" />
                            <p className="text-sm font-semibold text-blue-900 dark:text-blue-300">Estimated Review Time</p>
                        </div>
                        <p className="text-xs text-blue-700 dark:text-blue-400">
                            Most applications are reviewed within <span className="font-bold">24-48 hours</span>.
                            You'll receive an email notification once your account is activated.
                        </p>
                    </div>

                    {}
                    <button
                        onClick={fetchCompanyStatus}
                        disabled={refreshing}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-xl transition-colors disabled:opacity-50"
                    >
                        <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
                        {refreshing ? 'Checking Status...' : 'Refresh Status'}
                    </button>

                    {}
                    <div className="text-center">
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Need assistance?</p>
                        <a
                            href="mailto:chttrixchat@gmail.com"
                            className="inline-flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-semibold"
                        >
                            <Mail size={16} />
                            Contact Support
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ApplicationReview;
