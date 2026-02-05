import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Shield, Lock, Eye, Database,
    ChevronRight, CheckCircle, Menu, X, ArrowLeft,
    UserCheck, Server, Mail, Shuffle
} from 'lucide-react';

const tabs = [
    { id: 'overview', label: 'Privacy Overview', icon: Eye },
    { id: 'collection', label: 'Data Collection & Usage', icon: Database },
    { id: 'rights', label: 'Your Rights & Sharing', icon: UserCheck },
    { id: 'security', label: 'Security & AI', icon: Shield },
    { id: 'contact', label: 'Contact', icon: Mail },
];

const Privacy = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('overview');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Scroll to section handler
    const scrollToSection = (id) => {
        const element = document.getElementById(id);
        if (element) {
            const yOffset = -24;
            const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
            window.scrollTo({ top: y, behavior: 'smooth' });
            setActiveTab(id);
            setIsMobileMenuOpen(false);
        }
    };

    // Scroll Spy Effect
    useEffect(() => {
        const handleScroll = () => {
            const scrollPosition = window.scrollY + 200; // Offset

            for (const tab of tabs) {
                const element = document.getElementById(tab.id);
                if (element) {
                    const { offsetTop, offsetHeight } = element;
                    if (
                        scrollPosition >= offsetTop &&
                        scrollPosition < offsetTop + offsetHeight
                    ) {
                        setActiveTab(tab.id);
                    }
                }
            }
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#0b1121] font-sans text-slate-900 dark:text-white flex flex-col md:flex-row transition-colors duration-300">

            {/* --- Mobile Header --- */}
            <div className="md:hidden flex items-center justify-between p-4 bg-white dark:bg-[#111827] border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
                <div className="flex items-center gap-2 font-bold text-lg">
                    <Lock className="text-indigo-600" size={24} />
                    <span>Privacy Center</span>
                </div>
                <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2">
                    {isMobileMenuOpen ? <X /> : <Menu />}
                </button>
            </div>

            {/* --- Sidebar Navigation --- */}
            <aside className={`fixed md:sticky top-0 h-[calc(100vh)] z-40 w-full md:w-80 bg-white dark:bg-[#111827] border-r border-slate-200 dark:border-slate-800 flex flex-col transition-transform duration-300 transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
                <div className="p-8 border-b border-slate-100 dark:border-slate-800 hidden md:block">
                    <div
                        onClick={() => navigate('/')}
                        className="flex items-center gap-4 cursor-pointer group"
                    >
                        <img src="/chttrix-logo.jpg" alt="Chttrix" className="w-10 h-10 rounded-xl shadow-sm group-hover:scale-105 transition-transform" />
                        <div>
                            <span className="block font-extrabold text-xl tracking-tight leading-none text-slate-900 dark:text-white">Privacy Center</span>
                            <span className="block text-xs text-slate-500 font-medium mt-1 group-hover:text-indigo-500 transition-colors">by Chttrix</span>
                        </div>
                    </div>
                </div>

                <div className="p-4 flex-1 overflow-y-auto">
                    <nav className="space-y-1">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => scrollToSection(tab.id)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${isActive
                                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-indigo-200 dark:ring-indigo-800'
                                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                                        }`}
                                >
                                    <Icon size={18} className={isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'} />
                                    {tab.label}
                                    {isActive && <ChevronRight size={16} className="ml-auto opacity-50" />}
                                </button>
                            );
                        })}
                    </nav>
                </div>

                <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-[#0f172a]/50">
                    <p className="text-xs text-slate-400 leading-relaxed mb-4">
                        Effective Date: <span className="font-bold text-slate-600 dark:text-slate-300">Jan 2026</span>
                    </p>
                    <button onClick={() => navigate('/terms')} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline block mb-1">
                        Terms of Service
                    </button>
                    <button onClick={() => navigate('/security')} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline block">
                        Security Center
                    </button>
                </div>
            </aside>

            {/* --- Main Content Area --- */}
            <main className="flex-1 min-w-0 bg-slate-50 dark:bg-[#0b1121] min-h-screen">
                <div className="max-w-4xl mx-auto px-6 py-12 md:py-16 animate-fade-in relative">
                    <div className="absolute top-6 right-6 z-10 hidden md:block">
                        <button onClick={() => navigate("/")} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm">
                            <ArrowLeft size={16} /> Back to Home
                        </button>
                    </div>

                    {/* Render ALL sections with IDs for scroll targeting */}
                    <div className="space-y-32 pb-32">
                        <section id="overview" className="scroll-mt-24">
                            <OverviewSection scrollToSection={scrollToSection} />
                        </section>
                        <section id="collection" className="scroll-mt-24">
                            <CollectionSection />
                        </section>
                        <section id="rights" className="scroll-mt-24">
                            <RightsSection />
                        </section>
                        <section id="security" className="scroll-mt-24">
                            <SecuritySection />
                        </section>
                        <section id="contact" className="scroll-mt-24">
                            <ContactSection />
                        </section>
                    </div>

                </div>
            </main>
        </div>
    );
};

// --- Sub-Sections ---

const OverviewSection = ({ scrollToSection }) => (
    <div className="space-y-12 animate-fade-in">
        <div className="space-y-6">
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
                Privacy by Default.
            </h1>
            <p className="text-xl text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">
                Chttrix is committed to protecting user privacy and building technology that respects confidentiality, autonomy, and trust.
                Privacy is a core product feature, not an optional setting.
            </p>
        </div>

        {/* Core Principles Grid */}
        <div className="grid md:grid-cols-2 gap-6">
            <div onClick={() => scrollToSection('collection')} className="cursor-pointer group p-8 bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all duration-300 hover:border-indigo-500/20">
                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-6 group-hover:scale-110 transition-transform">
                    <Database size={24} />
                </div>
                <h3 className="text-xl font-bold mb-3 flex items-center gap-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    Data Collection <ChevronRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity -ml-2 group-hover:ml-0" />
                </h3>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                    We collect minimal metadata to operate the service. No ad profiling.
                </p>
            </div>
            <div onClick={() => scrollToSection('rights')} className="cursor-pointer group p-8 bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all duration-300 hover:border-emerald-500/20">
                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-6 group-hover:scale-110 transition-transform">
                    <UserCheck size={24} />
                </div>
                <h3 className="text-xl font-bold mb-3 flex items-center gap-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    Your Rights <ChevronRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity -ml-2 group-hover:ml-0" />
                </h3>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                    You own your data. Export, delete, or correct it at any time.
                </p>
            </div>
        </div>

        {/* Architecture Card */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 dark:from-[#111827] dark:to-[#0f172a] rounded-3xl p-8 md:p-10 text-white shadow-xl">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                <Shield className="text-emerald-400" /> Privacy-First Architecture
            </h2>
            <div className="grid sm:grid-cols-2 gap-y-4 gap-x-8">
                <FeatureItem text="Messages E2E Encrypted" invert />
                <FeatureItem text="No Server-Side Read Access" invert />
                <FeatureItem text="No Ad Profiling" invert />
                <FeatureItem text="User Data Ownership" invert />
            </div>
        </div>
    </div>
);

const CollectionSection = () => (
    <div className="space-y-10 animate-fade-in">
        <header className="border-b border-slate-200 dark:border-slate-800 pb-8">
            <h2 className="text-3xl font-bold mb-4">Data Collection & Usage</h2>
            <p className="text-lg text-slate-600 dark:text-slate-400">
                We only collect what is absolutely necessary to deliver your messages.
            </p>
        </header>

        <div className="space-y-8">
            <div className="bg-white dark:bg-[#111827] p-8 rounded-3xl border border-slate-200 dark:border-slate-800">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                    <Database size={20} /> Information We Collect
                </h3>
                <div className="space-y-6">
                    <div>
                        <h4 className="font-bold text-slate-900 dark:text-white mb-2">3.1 Account Information</h4>
                        <ul className="list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-400 ml-2">
                            <li>Name, email, username</li>
                            <li>Authentication credentials (hashed/secured)</li>
                            <li>Workspace details</li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-900 dark:text-white mb-2">3.2 Encrypted Content</h4>
                        <ul className="list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-400 ml-2">
                            <li>End-to-End Encrypted messages & files</li>
                            <li><strong>Note:</strong> We cannot see the plaintext content.</li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-900 dark:text-white mb-2">3.3 Metadata</h4>
                        <ul className="list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-400 ml-2">
                            <li>Timestamps, delivery receipts</li>
                            <li>Device/Session identifiers (for sync)</li>
                        </ul>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-[#111827] p-8 rounded-3xl border border-slate-200 dark:border-slate-800">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-green-600 dark:text-green-400">
                    <Shuffle size={20} /> How We Use Information
                </h3>
                <ul className="grid sm:grid-cols-2 gap-4">
                    <li className="flex gap-3 text-slate-600 dark:text-slate-400">
                        <CheckCircle size={18} className="text-green-500 shrink-0 mt-0.5" /> Service delivery
                    </li>
                    <li className="flex gap-3 text-slate-600 dark:text-slate-400">
                        <CheckCircle size={18} className="text-green-500 shrink-0 mt-0.5" /> Fraud prevention
                    </li>
                    <li className="flex gap-3 text-slate-600 dark:text-slate-400">
                        <CheckCircle size={18} className="text-green-500 shrink-0 mt-0.5" /> Authentication
                    </li>
                    <li className="flex gap-3 text-slate-600 dark:text-slate-400">
                        <CheckCircle size={18} className="text-green-500 shrink-0 mt-0.5" /> Legal compliance
                    </li>
                </ul>
                <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 text-sm font-bold text-slate-500">
                    Chttrix does NOT sell personal data or analyze private conversations.
                </div>
            </div>
        </div>
    </div>
);

const RightsSection = () => (
    <div className="space-y-10 animate-fade-in">
        <header className="border-b border-slate-200 dark:border-slate-800 pb-8">
            <h2 className="text-3xl font-bold mb-4">Your Rights & Sharing</h2>
            <p className="text-lg text-slate-600 dark:text-slate-400">
                You stay in control of your digital footprint.
            </p>
        </header>

        <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-[#111827] p-8 rounded-3xl border border-slate-200 dark:border-slate-800">
                <h3 className="text-lg font-bold mb-4">10. User Rights</h3>
                <ul className="space-y-3 text-slate-600 dark:text-slate-400">
                    <li className="flex gap-3"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2"></div> Access personal data</li>
                    <li className="flex gap-3"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2"></div> Correct inaccuracies</li>
                    <li className="flex gap-3"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2"></div> Delete accounts completely</li>
                    <li className="flex gap-3"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2"></div> Export your data</li>
                </ul>
            </div>

            <div className="bg-white dark:bg-[#111827] p-8 rounded-3xl border border-slate-200 dark:border-slate-800">
                <h3 className="text-lg font-bold mb-4">7. Data Sharing</h3>
                <p className="text-slate-600 dark:text-slate-400 mb-4">
                    <strong>We do not sell your data.</strong>
                </p>
                <p className="text-sm text-slate-500">
                    Limited sharing occurs only with trusted infrastructure providers (e.g., AWS, Stripe) under strict confidentiality for operational purposes.
                </p>
            </div>
        </div>

        <div className="bg-slate-100 dark:bg-slate-900 rounded-2xl p-6">
            <h3 className="font-bold mb-2">11. International Data</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
                Chttrix operates globally and processes data across regions under appropriate safeguards like GDPR and CCPA compliance.
            </p>
        </div>
    </div>
);

const SecuritySection = () => (
    <div className="space-y-10 animate-fade-in">
        <header className="border-b border-slate-200 dark:border-slate-800 pb-8">
            <h2 className="text-3xl font-bold mb-4">Security & AI</h2>
            <p className="text-lg text-slate-600 dark:text-slate-400">
                How we protect your data from threats and unauthorized access.
            </p>
        </header>

        <div className="space-y-8">
            {/* Encryption & Security */}
            <div className="bg-white dark:bg-[#111827] p-8 rounded-3xl border border-slate-200 dark:border-slate-800">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Shield size={20} className="text-indigo-600" /> Security Measures
                </h3>
                <div className="grid sm:grid-cols-2 gap-4">
                    <BenefitItem text="End-to-End Encryption" desc="Keys generated on device" />
                    <BenefitItem text="TLS Encryption" desc="In-transit protection" />
                    <BenefitItem text="Zero Knowledge" desc="Servers can't read messages" />
                    <BenefitItem text="Encrypted Backups" desc="Secure operational storage" />
                </div>
            </div>

            {/* AI */}
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/10 dark:to-purple-900/10 p-8 rounded-3xl border border-indigo-100 dark:border-indigo-900/30">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-indigo-900 dark:text-indigo-200">
                    <Server size={20} /> AI & Privacy
                </h3>
                <p className="text-slate-700 dark:text-slate-300 mb-4">
                    Chttrix AI operates under strict privacy boundaries.
                </p>
                <ul className="space-y-2">
                    <li className="flex items-start gap-3 text-slate-700 dark:text-slate-300">
                        <CheckCircle size={18} className="text-indigo-500 shrink-0 mt-0.5" /> No background scanning of private chats
                    </li>
                    <li className="flex items-start gap-3 text-slate-700 dark:text-slate-300">
                        <CheckCircle size={18} className="text-indigo-500 shrink-0 mt-0.5" /> AI only processes explicit user-provided input
                    </li>
                </ul>
            </div>
        </div>
    </div>
);

const ContactSection = () => (
    <div className="space-y-10 animate-fade-in">
        <header className="border-b border-slate-200 dark:border-slate-800 pb-8">
            <h2 className="text-3xl font-bold mb-4">Contact & Changes</h2>
        </header>

        <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-[#111827] p-8 rounded-3xl border border-slate-200 dark:border-slate-800">
                <h3 className="text-lg font-bold mb-4">12. Changes to Policy</h3>
                <p className="text-slate-600 dark:text-slate-400">
                    We may update this Privacy Policy periodically. Material changes will be communicated clearly via email or in-app notifications.
                </p>
            </div>

            <div className="bg-indigo-600 text-white p-8 rounded-3xl shadow-xl flex flex-col justify-between">
                <div>
                    <Mail size={32} className="mb-4 opacity-80" />
                    <h3 className="text-2xl font-bold mb-2">Privacy Questions?</h3>
                    <p className="opacity-90 mb-6">Contact our Data Protection Officer.</p>
                </div>
                <a href="mailto:chttrixchat@gmail.com" className="bg-white text-indigo-700 px-6 py-3 rounded-xl font-bold text-center hover:bg-indigo-50 transition-colors">
                    chttrixchat@gmail.com
                </a>
            </div>
        </div>
    </div>
);

// --- Helpers ---

const FeatureItem = ({ text, invert }) => (
    <div className={`flex items-center gap-3 ${invert ? 'text-slate-200' : 'text-slate-700 dark:text-slate-300'}`}>
        <CheckCircle size={18} className="text-emerald-400 shrink-0" />
        <span className="font-medium">{text}</span>
    </div>
);

const BenefitItem = ({ text, desc }) => (
    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
        <h4 className="font-bold text-slate-900 dark:text-white">{text}</h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{desc}</p>
    </div>
);

export default Privacy;
