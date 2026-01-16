import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Megaphone, Send, Calendar, Users, Check } from 'lucide-react';
import { useToast } from '../../../../contexts/ToastContext';

const Broadcast = () => {
    const [activeTab, setActiveTab] = useState('compose'); // 'compose' or 'history'
    const [formData, setFormData] = useState({
        subject: '',
        message: '',
        targetType: 'all', // 'all', 'active', 'pending', 'specific'
        targetCompanies: [],
        scheduleType: 'now' // 'now' or 'schedule'
    });
    const [companies, setCompanies] = useState([]);
    const [broadcastHistory, setBroadcastHistory] = useState([]);
    const [sending, setSending] = useState(false);
    const { showToast } = useToast();

    useEffect(() => {
        if (formData.targetType === 'specific') {
            fetchCompanies();
        }
        if (activeTab === 'history') {
            fetchHistory();
        }
    }, [formData.targetType, activeTab]);

    const fetchCompanies = async () => {
        try {
            const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/admin/active-companies`, {
                withCredentials: true
            });
            setCompanies(res.data);
        } catch (err) {
            console.error('Failed to fetch companies:', err);
        }
    };

    const fetchHistory = async () => {
        try {
            const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/admin/broadcast/history`, {
                withCredentials: true
            });
            setBroadcastHistory(res.data);
        } catch (err) {
            console.error('Failed to fetch broadcast history:', err);
        }
    };

    const handleCompanyToggle = (companyId) => {
        setFormData(prev => ({
            ...prev,
            targetCompanies: prev.targetCompanies.includes(companyId)
                ? prev.targetCompanies.filter(id => id !== companyId)
                : [...prev.targetCompanies, companyId]
        }));
    };

    const handleSend = async () => {
        if (!formData.subject.trim() || !formData.message.trim()) {
            showToast('Please fill in subject and message', 'error');
            return;
        }

        if (formData.targetType === 'specific' && formData.targetCompanies.length === 0) {
            showToast('Please select at least one company', 'error');
            return;
        }

        setSending(true);
        try {
            await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/admin/broadcast/send`, formData, {
                withCredentials: true
            });
            showToast('Broadcast sent successfully!', 'success');
            setFormData({
                subject: '',
                message: '',
                targetType: 'all',
                targetCompanies: [],
                scheduleType: 'now'
            });
            setActiveTab('history');
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to send broadcast', 'error');
        } finally {
            setSending(false);
        }
    };

    const getTargetCount = () => {
        switch (formData.targetType) {
            case 'specific':
                return formData.targetCompanies.length;
            case 'all':
                return companies.length;
            default:
                return '?';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2 flex items-center gap-3">
                        <Megaphone size={32} />
                        Broadcast Messages
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400">
                        Send announcements to companies
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
                <button
                    onClick={() => setActiveTab('compose')}
                    className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${activeTab === 'compose'
                        ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                >
                    Compose
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${activeTab === 'history'
                        ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                >
                    History
                </button>
            </div>

            {/* Compose Tab */}
            {activeTab === 'compose' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Form */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 space-y-6">
                            {/* Subject */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                    Subject *
                                </label>
                                <input
                                    type="text"
                                    value={formData.subject}
                                    onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                                    placeholder="e.g., New Feature Announcement"
                                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900"
                                />
                            </div>

                            {/* Message */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                    Message *
                                </label>
                                <textarea
                                    value={formData.message}
                                    onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                                    placeholder="Write your broadcast message here..."
                                    rows={10}
                                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 resize-none"
                                />
                            </div>

                            {/* Target Selection */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">
                                    Send To *
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { value: 'all', label: 'All Companies', icon: Users },
                                        { value: 'active', label: 'Active Only', icon: Check },
                                        { value: 'pending', label: 'Pending Only', icon: Calendar },
                                        { value: 'specific', label: 'Specific Companies', icon: Users }
                                    ].map(option => (
                                        <button
                                            key={option.value}
                                            onClick={() => setFormData(prev => ({ ...prev, targetType: option.value }))}
                                            className={`p-4 rounded-xl border-2 transition-all text-left ${formData.targetType === option.value
                                                ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                                                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                                                }`}
                                        >
                                            <option.icon size={20} className={formData.targetType === option.value ? 'text-indigo-600' : 'text-gray-400'} />
                                            <p className="font-bold text-sm mt-2 text-gray-900 dark:text-white">{option.label}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Specific Companies Selection */}
                            {formData.targetType === 'specific' && (
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">
                                        Select Companies ({formData.targetCompanies.length} selected)
                                    </label>
                                    <div className="max-h-64 overflow-y-auto space-y-2 border border-gray-200 dark:border-gray-600 rounded-xl p-4">
                                        {companies.map(company => (
                                            <label
                                                key={company._id}
                                                className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg cursor-pointer transition-colors"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={formData.targetCompanies.includes(company._id)}
                                                    onChange={() => handleCompanyToggle(company._id)}
                                                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                                                />
                                                <div className="flex-1">
                                                    <p className="font-bold text-sm text-gray-900 dark:text-white">{company.name}</p>
                                                    <p className="text-xs text-gray-500">{company.domain}</p>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Preview & Actions */}
                    <div className="space-y-6">
                        {/* Preview */}
                        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6">
                            <h3 className="font-bold text-gray-900 dark:text-white mb-4">Preview</h3>
                            <div className="space-y-4">
                                <div>
                                    <p className="text-xs text-gray-400 mb-1">SUBJECT</p>
                                    <p className="font-bold text-gray-900 dark:text-white">
                                        {formData.subject || 'No subject'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-400 mb-1">MESSAGE</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                                        {formData.message || 'No message'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-400 mb-1">RECIPIENTS</p>
                                    <p className="font-bold text-indigo-600 dark:text-indigo-400">
                                        {getTargetCount()} companies
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Send Button */}
                        <button
                            onClick={handleSend}
                            disabled={sending}
                            className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg"
                        >
                            {sending ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <Send size={20} />
                                    Send Broadcast
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Subject</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Recipients</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Sent</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                                {broadcastHistory.map(broadcast => (
                                    <tr key={broadcast._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{broadcast.subject}</td>
                                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                                            {broadcast.recipientCount} companies
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                            {new Date(broadcast.sentAt).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full text-xs font-bold">
                                                Sent
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {broadcastHistory.length === 0 && (
                            <div className="p-12 text-center text-gray-400">
                                No broadcast history yet
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Broadcast;
