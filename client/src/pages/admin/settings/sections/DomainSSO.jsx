import React, { useState } from 'react';
import { CheckCircle, Copy, Save, AlertCircle } from 'lucide-react';
import { useCompany } from '../../../../contexts/CompanyContext';
import { useToast } from '../../../../contexts/ToastContext';

const DomainSSO = () => {
    const { company } = useCompany();
    const { showToast } = useToast();
    const [settings, setSettings] = useState({
        autoJoin: false,
        ssoEnabled: false,
        ssoProvider: 'saml'
    });

    const verificationCode = 'chttrix-verify-abc123';

    const handleCopy = () => {
        navigator.clipboard.writeText(verificationCode);
        showToast('Verification code copied', 'success');
    };

    const handleSave = () => {
        showToast('Domain & SSO settings saved', 'success');
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Domain & SSO</h2>
                <p className="text-gray-500 dark:text-gray-400">Manage domain verification and single sign-on</p>
            </div>

            {/* Domain Verification */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Domain Verification</h3>

                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                        <div>
                            <p className="font-bold text-gray-900 dark:text-white">{company?.domain || 'company.com'}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Company domain</p>
                        </div>
                        {company?.domainVerified ? (
                            <span className="flex items-center gap-2 text-green-600 dark:text-green-400 font-bold">
                                <CheckCircle size={20} />
                                Verified
                            </span>
                        ) : (
                            <span className="flex items-center gap-2 text-orange-600 dark:text-orange-400 font-bold">
                                <AlertCircle size={20} />
                                Not Verified
                            </span>
                        )}
                    </div>

                    {!company?.domainVerified && (
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                            <p className="text-sm font-bold text-gray-900 dark:text-white mb-2">
                                Add this TXT record to your DNS:
                            </p>
                            <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                                <code className="flex-1 text-sm text-gray-900 dark:text-white font-mono">
                                    {verificationCode}
                                </code>
                                <button
                                    onClick={handleCopy}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                >
                                    <Copy size={16} />
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                        <div>
                            <p className="font-bold text-gray-900 dark:text-white">Auto-join by Email Domain</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Allow users with @{company?.domain} to join automatically
                            </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={settings.autoJoin}
                                onChange={(e) => setSettings(prev => ({ ...prev, autoJoin: e.target.checked }))}
                                disabled={!company?.domainVerified}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 peer-disabled:opacity-50"></div>
                        </label>
                    </div>
                </div>
            </div>

            {/* SSO Configuration */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Single Sign-On (SSO)</h3>

                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                        <div>
                            <p className="font-bold text-gray-900 dark:text-white">Enable SSO</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Allow sign-in via identity provider</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={settings.ssoEnabled}
                                onChange={(e) => setSettings(prev => ({ ...prev, ssoEnabled: e.target.checked }))}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                    </div>

                    {settings.ssoEnabled && (
                        <>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                    SSO Provider
                                </label>
                                <select
                                    value={settings.ssoProvider}
                                    onChange={(e) => setSettings(prev => ({ ...prev, ssoProvider: e.target.value }))}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white"
                                >
                                    <option value="saml">SAML 2.0</option>
                                    <option value="oauth">OAuth 2.0</option>
                                    <option value="oidc">OpenID Connect</option>
                                </select>
                            </div>

                            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                    <strong>Note:</strong> SSO configuration requires additional setup with your identity provider.
                                    Contact support for assistance.
                                </p>
                            </div>
                        </>
                    )}
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

export default DomainSSO;
