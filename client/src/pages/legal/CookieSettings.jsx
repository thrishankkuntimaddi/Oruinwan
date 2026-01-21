import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Cookie, ToggleLeft, ToggleRight, RotateCcw, Check } from 'lucide-react';

const CookieSettings = () => {
    const navigate = useNavigate();
    const [settings, setSettings] = useState({
        essential: true,
        analytics: true,
        marketing: false,
        preferences: true
    });
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');

    // Load saved preferences from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem('chttrix_cookie_preferences');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setSettings({
                    essential: true, // Always true
                    analytics: parsed.analytics ?? true,
                    marketing: parsed.marketing ?? false,
                    preferences: parsed.preferences ?? true
                });
            } catch (error) {
                console.error('Failed to parse saved preferences:', error);
            }
        }
    }, []);

    const toggleSetting = (key) => {
        if (key === 'essential') return; // Cannot toggle essential
        setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const setCookie = (name, value, days = 365) => {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        const expires = `expires=${date.toUTCString()}`;
        document.cookie = `${name}=${value};${expires};path=/;SameSite=Lax`;
    };

    const savePreferences = () => {
        // Save to localStorage
        localStorage.setItem('chttrix_cookie_preferences', JSON.stringify(settings));

        // Set actual cookies
        setCookie('chttrix_essential', 'true'); // Always set
        setCookie('chttrix_analytics', settings.analytics ? 'true' : 'false');
        setCookie('chttrix_marketing', settings.marketing ? 'true' : 'false');
        setCookie('chttrix_preferences', settings.preferences ? 'true' : 'false');

        // Show success toast
        showToastNotification('✅ Preferences saved successfully!');

        // Navigate after a short delay
        setTimeout(() => navigate('/'), 1500);
    };

    const resetToDefaults = () => {
        const defaults = {
            essential: true,
            analytics: true,
            marketing: false,
            preferences: true
        };
        setSettings(defaults);
        showToastNotification('🔄 Reset to default settings');
    };

    const showToastNotification = (message) => {
        setToastMessage(message);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
    };

    return (
        <div className="min-h-screen bg-white dark:bg-[#030712] text-slate-900 dark:text-white transition-colors duration-500">
            {/* Toast Notification */}
            {showToast && (
                <div className="fixed top-24 right-6 z-50 bg-green-500 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-bounce">
                    <Check size={20} />
                    <span className="font-bold">{toastMessage}</span>
                </div>
            )}

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

            <header className="pt-32 pb-12 container mx-auto px-6 max-w-3xl text-center">
                <Cookie className="w-16 h-16 text-yellow-500 mx-auto mb-6" />
                <h1 className="text-4xl font-black mb-4">Cookie Preferences</h1>
                <p className="text-slate-500 dark:text-slate-400">
                    We use cookies to ensure you get the best experience on our website. You can manage your preferences below.
                </p>
                <a href="/privacy" className="text-indigo-600 dark:text-indigo-400 text-sm font-bold hover:underline mt-2 inline-block">
                    Read our Privacy Policy →
                </a>
            </header>

            <section className="pb-20 container mx-auto px-6 max-w-3xl">
                <div className="bg-slate-50 dark:bg-[#0B0F19] rounded-3xl p-8 space-y-8 border border-slate-200 dark:border-white/5">

                    {/* Essential */}
                    <div className="flex justify-between items-start gap-6">
                        <div>
                            <h3 className="text-lg font-bold mb-1">Essential Cookies</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Necessary for the website to function properly. Cannot be disabled.</p>
                        </div>
                        <div className="opacity-50 cursor-not-allowed text-indigo-500">
                            <ToggleRight size={32} />
                        </div>
                    </div>

                    {/* Analytics */}
                    <div className="flex justify-between items-start gap-6">
                        <div>
                            <h3 className="text-lg font-bold mb-1">Analytics</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Help us understand how visitors interact with our website.</p>
                        </div>
                        <button onClick={() => toggleSetting('analytics')} className={`transition-colors ${settings.analytics ? 'text-indigo-500' : 'text-slate-400'}`}>
                            {settings.analytics ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                        </button>
                    </div>

                    {/* Marketing */}
                    <div className="flex justify-between items-start gap-6">
                        <div>
                            <h3 className="text-lg font-bold mb-1">Marketing</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Used to deliver relevant advertisements and track ad performance.</p>
                        </div>
                        <button onClick={() => toggleSetting('marketing')} className={`transition-colors ${settings.marketing ? 'text-indigo-500' : 'text-slate-400'}`}>
                            {settings.marketing ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                        </button>
                    </div>

                    {/* Preferences */}
                    <div className="flex justify-between items-start gap-6">
                        <div>
                            <h3 className="text-lg font-bold mb-1">Preferences</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Allow the site to remember choices you make (like language).</p>
                        </div>
                        <button onClick={() => toggleSetting('preferences')} className={`transition-colors ${settings.preferences ? 'text-indigo-500' : 'text-slate-400'}`}>
                            {settings.preferences ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                        </button>
                    </div>
                </div>

                <div className="mt-8 flex justify-between items-center gap-4">
                    <button
                        className="px-6 py-3 font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-2"
                        onClick={resetToDefaults}
                    >
                        <RotateCcw size={16} />
                        Reset to Defaults
                    </button>
                    <div className="flex gap-4">
                        <button
                            className="px-6 py-3 font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                            onClick={() => navigate('/')}
                        >
                            Cancel
                        </button>
                        <button
                            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-indigo-500/20"
                            onClick={savePreferences}
                        >
                            Save Preferences
                        </button>
                    </div>
                </div>
            </section>
            <footer className="py-12 border-t border-slate-200 dark:border-white/5 text-center text-slate-500 dark:text-slate-400">
                <p>© 2026 Chttrix Inc.</p>
            </footer>
        </div>
    );
};

export default CookieSettings;
