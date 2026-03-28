import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Server, AlertCircle, Clock } from 'lucide-react';
import api from '../../../services/api';

const Status = () => {
    const navigate = useNavigate();
    const [healthData, setHealthData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(new Date());

    const fetchHealthStatus = async () => {
        try {
            const response = await api.get('/api/status/health');
            setHealthData(response.data);
            setLastUpdated(new Date());
            setLoading(false);
        } catch (error) {
            console.error('Failed to fetch health status:', error);
            setHealthData({
                status: 'outage',
                services: [],
                timestamp: new Date().toISOString()
            });
            setLoading(false);
        }
    };

    useEffect(() => {
        // Initial fetch
        fetchHealthStatus();

        // Auto-refresh every 30 seconds
        const interval = setInterval(fetchHealthStatus, 30000);

        return () => clearInterval(interval);
    }, []);

    const getStatusColor = (status) => {
        switch (status) {
            case 'operational':
                return 'bg-green-500';
            case 'degraded':
                return 'bg-yellow-500';
            case 'outage':
                return 'bg-red-500';
            default:
                return 'bg-slate-500';
        }
    };

    const getStatusTextColor = (status) => {
        switch (status) {
            case 'operational':
                return 'text-green-500';
            case 'degraded':
                return 'text-yellow-500';
            case 'outage':
                return 'text-red-500';
            default:
                return 'text-slate-500';
        }
    };

    const getStatusIcon = () => {
        if (loading) return <Clock size={48} className="opacity-80 animate-spin" />;
        if (!healthData || healthData.status === 'outage') return <AlertCircle size={48} className="opacity-80" />;
        if (healthData.status === 'degraded') return <AlertCircle size={48} className="opacity-80" />;
        return <CheckCircle2 size={48} className="opacity-80" />;
    };

    const getStatusTitle = () => {
        if (loading) return 'Checking Systems...';
        if (!healthData) return 'Status Unavailable';
        if (healthData.status === 'operational') return 'All Systems Operational';
        if (healthData.status === 'degraded') return 'Partial Service Degradation';
        return 'Service Outage Detected';
    };

    const formatTime = (date) => {
        const now = new Date();
        const diff = Math.floor((now - date) / 1000); // seconds

        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)} minute(s) ago`;
        return date.toLocaleTimeString();
    };

    return (
        <div className="min-h-screen bg-white dark:bg-[#030712] text-slate-900 dark:text-white transition-colors duration-500">
            <nav className="fixed top-0 w-full z-50 bg-white/80 dark:bg-[#030712]/80 backdrop-blur-xl border-b border-slate-200 dark:border-white/5">
                <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/")}>
                        <img src="/chttrix-logo.jpg" alt="Logo" className="w-10 h-10 rounded-xl shadow-md" />
                        <span className="font-black text-2xl tracking-tighter">Chttrix</span>
                    </div>
                    <button onClick={() => navigate("/")} className="text-sm font-bold text-slate-500 hover:text-indigo-600 dark:hover:text-white transition-colors flex items-center gap-2">
                        <ArrowLeft size={16} /> Back to Home
                    </button>
                </div>
            </nav>

            <div className="pt-32 pb-20 container mx-auto px-6 max-w-4xl">
                <div className={`${healthData ? getStatusColor(healthData.status) : 'bg-slate-500'} text-white p-8 rounded-3xl flex items-center justify-between mb-12 shadow-lg transition-all duration-500`}>
                    <div>
                        <h1 className="text-3xl font-bold mb-2">{getStatusTitle()}</h1>
                        <p className="opacity-90">Last updated: {formatTime(lastUpdated)}</p>
                    </div>
                    {getStatusIcon()}
                </div>

                {loading ? (
                    <div className="text-center py-12">
                        <Clock size={48} className="mx-auto text-indigo-500 animate-spin mb-4" />
                        <p className="text-slate-500 dark:text-slate-400">Loading system status...</p>
                    </div>
                ) : (
                    <>
                        <div className="space-y-4">
                            {healthData?.services && healthData.services.length > 0 ? (
                                healthData.services.map((service, i) => (
                                    <div key={i} className="flex items-center justify-between p-6 bg-white dark:bg-[#0B0F19] border border-slate-200 dark:border-white/5 rounded-2xl hover:border-indigo-200 dark:hover:border-white/10 transition-all">
                                        <div className="flex items-center gap-4 flex-1">
                                            <Server className="text-slate-400" size={20} />
                                            <div>
                                                <span className="font-bold text-lg block">{service.name}</span>
                                                <div className="flex gap-4 text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                    <span>Response: {service.responseTime}ms</span>
                                                    <span>Uptime: {service.uptime}%</span>
                                                </div>
                                            </div>
                                        </div>
                                        <span className={`${getStatusTextColor(service.status)} font-bold text-sm capitalize`}>
                                            {service.status}
                                        </span>
                                    </div>
                                ))
                            ) : (
                                <p className="text-center text-slate-500 dark:text-slate-400">No service data available</p>
                            )}
                        </div>

                        <div className="mt-12 text-center">
                            <h3 className="text-xl font-bold mb-4">Past Incidents</h3>
                            {healthData?.incidents && healthData.incidents.length > 0 ? (
                                <div className="space-y-4">
                                    {healthData.incidents.map((incident, i) => (
                                        <div key={i} className="p-4 bg-slate-50 dark:bg-[#0B0F19] rounded-xl border border-slate-200 dark:border-white/5">
                                            <p className="font-bold">{incident.title}</p>
                                            <p className="text-sm text-slate-500">{incident.description}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-slate-500 dark:text-slate-400">No incidents reported in the last 90 days.</p>
                            )}
                        </div>
                    </>
                )}
            </div>
            <footer className="py-12 border-t border-slate-200 dark:border-white/5 text-center text-slate-500 dark:text-slate-400">
                <p>© 2026 Chttrix Inc.</p>
            </footer>
        </div>
    );
};

export default Status;
