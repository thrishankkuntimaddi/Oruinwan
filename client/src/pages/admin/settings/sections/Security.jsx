import React, { useState } from 'react';
import { Shield, Lock, AlertTriangle, Save } from 'lucide-react';
import { useToast } from '../../../../contexts/ToastContext';

const Security = () => {
    const { showToast } = useToast();
    const [settings, setSettings] = useState({
        passwordPolicy: 'medium',
        twoFactorAuth: false,
        sessionTimeout: '30',
        ipWhitelist: false
    });

    const handleSave = () => {
        showToast('Security settings saved', 'success');
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Security</h2>
                <p className="text-gray-500 dark:text-gray-400">Protect your company account</p>
            </div>

            {/* Password Policy */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Lock size={20} />
                    Password Policy
                </h3>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                            Required Password Strength
                        </label>
                        <select
                            value={settings.passwordPolicy}
                            onChange={(e) => setSettings(prev => ({ ...prev, passwordPolicy: e.target.value }))}
                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white"
                        >
                            <option value="weak">Weak (minimum 6 characters)</option>
                            <option value="medium">Medium (8+ chars, uppercase, number)</option>
                            <option value="strong">Strong (12+ chars, uppercase, number, special)</option>
                        </select>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                        <div>
                            <p className="font-bold text-gray-900 dark:text-white">Two-Factor Authentication</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Require 2FA for all users</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={settings.twoFactorAuth}
                                onChange={(e) => setSettings(prev => ({ ...prev, twoFactorAuth: e.target.checked }))}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                        </label>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                            Session Timeout (minutes)
                        </label>
                        <input
                            type="number"
                            value={settings.sessionTimeout}
                            onChange={(e) => setSettings(prev => ({ ...prev, sessionTimeout: e.target.value }))}
                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white"
                            min="5"
                            max="1440"
                        />
                    </div>
                </div>
            </div>

            {/* IP Whitelist */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Shield size={20} />
                    IP Whitelist
                </h3>

                <div className="flex items-center justify-between p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="text-yellow-600 dark:text-yellow-400 mt-0.5" size={20} />
                        <div>
                            <p className="font-bold text-gray-900 dark:text-white">Enable IP Restrictions</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Only allow access from specific IP addresses</p>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={settings.ipWhitelist}
                            onChange={(e) => setSettings(prev => ({ ...prev, ipWhitelist: e.target.checked }))}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                    </label>
                </div>
            </div>

            <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-2"
                >
                    <Save size={18} />
                    Save Changes
                </button>
            </div>
        </div>
    );
};

export default Security;
