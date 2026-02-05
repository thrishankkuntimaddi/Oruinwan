import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Shield, Lock, Key, Server, Eye, Database,
    Fingerprint, Activity, FileText, Globe,
    ChevronRight, CheckCircle, Mail,
    Layers, Cpu, Menu, X, ArrowLeft
} from 'lucide-react';

const tabs = [
    { id: 'overview', label: 'Security Overview', icon: Shield },
    { id: 'encryption', label: 'End-to-End Encryption', icon: Lock },
    { id: 'privacy', label: 'Data Privacy & Rights', icon: Fingerprint },
    { id: 'infrastructure', label: 'Infrastructure', icon: Server },
    { id: 'ai', label: 'AI Safety', icon: Cpu },
    { id: 'compliance', label: 'Trust & Transparency', icon: FileText },
];

const Security = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('overview');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Scroll to section handler
    const scrollToSection = (id) => {
        const element = document.getElementById(id);
        if (element) {
            // Offset for fixed header/mobile menu if needed, though here we have a sidebar layout
            // Adding a small offset for breathing room
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
            const scrollPosition = window.scrollY + 200; // Offset to trigger active state earlier

            // Find the current section
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
        <div className="min-h-screen bg-slate-50 dark:bg-[#0b1121] font-sans text-slate-900 dark:text-white flex flex-col md:flex-row">

            {/* --- Mobile Header --- */}
            <div className="md:hidden flex items-center justify-between p-4 bg-white dark:bg-[#111827] border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
                <div className="flex items-center gap-2 font-bold text-lg">
                    <Shield className="text-indigo-600" size={24} />
                    <span>Security Center</span>
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
                            <span className="block font-extrabold text-xl tracking-tight leading-none text-slate-900 dark:text-white">Security Center</span>
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
                    <div className="text-xs text-slate-400 leading-relaxed">
                        Need tailored security advice?<br />
                        <a href="mailto:chttrixchat@gmail.com" className="text-indigo-600 dark:text-indigo-400 hover:underline">Contact our dedicated team</a>
                    </div>
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
                        <section id="encryption" className="scroll-mt-24">
                            <EncryptionSection />
                        </section>
                        <section id="privacy" className="scroll-mt-24">
                            <PrivacySection />
                        </section>
                        <section id="infrastructure" className="scroll-mt-24">
                            <InfrastructureSection />
                        </section>
                        <section id="ai" className="scroll-mt-24">
                            <AiSection />
                        </section>
                        <section id="compliance" className="scroll-mt-24">
                            <ComplianceSection />
                        </section>
                    </div>

                </div>
            </main>
        </div>
    );
};

// --- Sub-Components ---

const OverviewSection = ({ scrollToSection }) => (
    <div className="space-y-12">
        <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
                Security Built Into the Core.
            </h1>
            <p className="text-xl text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">
                Chttrix is designed with security as a foundation, not an add-on.
                We use modern cryptography, strict access control, and a privacy-first architecture
                to ensure your conversations belong to you.
            </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
            <div onClick={() => scrollToSection('encryption')} className="cursor-pointer group p-8 bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all duration-300 hover:border-indigo-500/20">
                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-6 group-hover:scale-110 transition-transform">
                    <Lock size={24} />
                </div>
                <h3 className="text-xl font-bold mb-3 flex items-center gap-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    End-to-End Encryption <ChevronRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity -ml-2 group-hover:ml-0" />
                </h3>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                    Messages are encrypted on your device. We never see the plaintext.
                </p>
            </div>
            <div onClick={() => scrollToSection('privacy')} className="cursor-pointer group p-8 bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all duration-300 hover:border-emerald-500/20">
                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-6 group-hover:scale-110 transition-transform">
                    <Fingerprint size={24} />
                </div>
                <h3 className="text-xl font-bold mb-3 flex items-center gap-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    Zero-Trust Privacy <ChevronRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity -ml-2 group-hover:ml-0" />
                </h3>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                    You own your data. No ads, no tracking, no AI training on private chats.
                </p>
            </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/10 rounded-2xl p-6 border border-blue-100 dark:border-blue-900/20 flex gap-4">
            <div className="flex-shrink-0">
                <Activity className="text-blue-600 dark:text-blue-400" size={24} />
            </div>
            <div>
                <h4 className="font-bold text-blue-900 dark:text-blue-300 mb-1">Live Security Status</h4>
                <p className="text-sm text-blue-800 dark:text-blue-400">
                    All systems operational. TSL 1.3 enforced.
                    <span className="inline-block mx-2 opacity-50">|</span>
                    Last audit: <span className="font-mono">Oct 2025</span>
                </p>
            </div>
        </div>
    </div>
);

const EncryptionSection = () => (
    <div className="space-y-10 animate-fade-in">
        <div className="border-b border-slate-200 dark:border-slate-800 pb-8">
            <h2 className="text-3xl font-bold mb-4">End-to-End Encryption (E2EE)</h2>
            <p className="text-lg text-slate-600 dark:text-slate-400">
                We use a client-side key management system. Your data is encrypted before it leaves your device.
            </p>
        </div>

        <div className="grid gap-6">
            <div className="bg-white dark:bg-[#111827] p-8 rounded-3xl border border-slate-200 dark:border-slate-800">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <Key className="text-indigo-500" size={20} /> What is Encrypted?
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                    {['Workspace Channels', 'Threads & Replies', 'Direct Messages', 'Files & Media'].map(item => (
                        <div key={item} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-[#0b1121] rounded-xl">
                            <CheckCircle size={18} className="text-green-500" />
                            <span className="font-medium text-sm">{item}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white dark:bg-[#111827] p-8 rounded-3xl border border-slate-200 dark:border-slate-800">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <Eye className="text-blue-500" size={20} /> Zero Knowledge Architecture
                </h3>
                <div className="space-y-6">
                    <p className="text-slate-600 dark:text-slate-400">
                        Chttrix servers act as a blind relay. We physically cannot read your messages because we don't possess the decryption keys.
                    </p>
                    <div className="flex flex-col gap-4">
                        <div className="pl-4 border-l-2 border-indigo-500">
                            <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-1">Sender</h4>
                            <p className="text-xs text-slate-500">Encrypts with Recipient's Public Key</p>
                        </div>
                        <div className="pl-4 border-l-2 border-slate-200 dark:border-slate-700">
                            <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-1">Server (Chttrix)</h4>
                            <p className="text-xs text-slate-500">Sees only encrypted blobs</p>
                        </div>
                        <div className="pl-4 border-l-2 border-green-500">
                            <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-1">Recipient</h4>
                            <p className="text-xs text-slate-500">Decrypts with their Private Key</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
);

const PrivacySection = () => (
    <div className="space-y-10 animate-fade-in">
        <div className="border-b border-slate-200 dark:border-slate-800 pb-8">
            <h2 className="text-3xl font-bold mb-4">Data Privacy & Rights</h2>
            <p className="text-lg text-slate-600 dark:text-slate-400">
                Chttrix is built on the principle of data minimization. We only store what is absolutely necessary.
            </p>
        </div>

        <div className="bg-[#111827] text-white p-10 rounded-3xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-indigo-900/30 to-transparent pointer-events-none"></div>
            <div className="relative z-10">
                <div className="grid md:grid-cols-2 gap-12">
                    <div>
                        <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
                            <CheckCircle className="text-emerald-400" /> What We Store
                        </h3>
                        <ul className="space-y-3 text-slate-300">
                            <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Encrypted message blobs</li>
                            <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> User account identifiers</li>
                            <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Delivery status metadata</li>
                        </ul>
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
                            <X className="text-red-400" /> What We DON'T Store
                        </h3>
                        <ul className="space-y-3 text-slate-300">
                            <li className="flex items-center gap-3 opacity-90"><div className="w-1.5 h-1.5 rounded-full bg-red-500"></div> Plaintext message content</li>
                            <li className="flex items-center gap-3 opacity-90"><div className="w-1.5 h-1.5 rounded-full bg-red-500"></div> Contact lists (unhashed)</li>
                            <li className="flex items-center gap-3 opacity-90"><div className="w-1.5 h-1.5 rounded-full bg-red-500"></div> AI training data from chats</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    </div>
);

const InfrastructureSection = () => (
    <div className="space-y-10 animate-fade-in">
        <div className="border-b border-slate-200 dark:border-slate-800 pb-8">
            <h2 className="text-3xl font-bold mb-4">Infrastructure Security</h2>
            <p className="text-lg text-slate-600 dark:text-slate-400">
                Our servers are hardened against attacks and designed for resilience.
            </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
            <div className="p-6 bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800">
                <Globe className="text-indigo-500 mb-4" size={32} />
                <h3 className="text-lg font-bold mb-2">TLS 1.3 Transport</h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm">All communication between your device and our servers is secured with the latest TLS standards.</p>
            </div>
            <div className="p-6 bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800">
                <Database className="text-purple-500 mb-4" size={32} />
                <h3 className="text-lg font-bold mb-2">Encrypted at Rest</h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm">All persistent data on our servers is encrypted using AES-256 before being written to disk.</p>
            </div>
            <div className="p-6 bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800">
                <Layers className="text-orange-500 mb-4" size={32} />
                <h3 className="text-lg font-bold mb-2">Workspace Isolation</h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm">Strict logical and cryptographic separation prevents data leakage between workspaces.</p>
            </div>
            <div className="p-6 bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800">
                <Activity className="text-blue-500 mb-4" size={32} />
                <h3 className="text-lg font-bold mb-2">DDoS Protection</h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm">Built-in rate limiting and edge protection to ensure service availability.</p>
            </div>
        </div>
    </div>
);

const AiSection = () => (
    <div className="space-y-10 animate-fade-in">
        <div className="border-b border-slate-200 dark:border-slate-800 pb-8">
            <h2 className="text-3xl font-bold mb-4">AI Safety</h2>
            <p className="text-lg text-slate-600 dark:text-slate-400">
                Chttrix AI is an opt-in utility, not a surveillance tool.
            </p>
        </div>

        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/10 dark:to-purple-900/10 p-8 rounded-3xl border border-indigo-100 dark:border-indigo-900/30">
            <h3 className="text-xl font-bold mb-6 text-indigo-900 dark:text-indigo-300">Our 3 Promises</h3>
            <ul className="space-y-4">
                <li className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-white dark:bg-[#111827] flex items-center justify-center text-indigo-600 font-bold shadow-sm">1</div>
                    <div>
                        <h4 className="font-bold text-slate-900 dark:text-white">No Silent Training</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">We do not train our global models on your private conversations.</p>
                    </div>
                </li>
                <li className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-white dark:bg-[#111827] flex items-center justify-center text-indigo-600 font-bold shadow-sm">2</div>
                    <div>
                        <h4 className="font-bold text-slate-900 dark:text-white">Opt-In Context</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">AI only sees messages you explicitly mention it in or select for context.</p>
                    </div>
                </li>
                <li className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-white dark:bg-[#111827] flex items-center justify-center text-indigo-600 font-bold shadow-sm">3</div>
                    <div>
                        <h4 className="font-bold text-slate-900 dark:text-white">Local Processing</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Where possible, lightweight inference happens right in your browser.</p>
                    </div>
                </li>
            </ul>
        </div>
    </div>
);

const ComplianceSection = () => (
    <div className="space-y-10 animate-fade-in">
        <div className="border-b border-slate-200 dark:border-slate-800 pb-8">
            <h2 className="text-3xl font-bold mb-4">Trust & Transparency</h2>
            <p className="text-lg text-slate-600 dark:text-slate-400">
                Security is not a claim — it’s a commitment.
            </p>
        </div>

        <div className="prose dark:prose-invert max-w-none text-slate-600 dark:text-slate-400">
            <p className="mb-6">
                We believe in open standards and responsible disclosure. If you find a vulnerability, we want to know about it.
            </p>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
            <a href="mailto:chttrixchat@gmail.com" className="flex-1 p-6 bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 transition-colors group">
                <Mail className="text-indigo-500 mb-4 group-hover:scale-110 transition-transform" size={28} />
                <h3 className="font-bold text-slate-900 dark:text-white mb-2">Report a Vulnerability</h3>
                <p className="text-sm text-slate-500">Contact our security team securely.</p>
            </a>
            <a href="/chttrix-docs" className="flex-1 p-6 bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 transition-colors group">
                <FileText className="text-blue-500 mb-4 group-hover:scale-110 transition-transform" size={28} />
                <h3 className="font-bold text-slate-900 dark:text-white mb-2">Architecture Docs</h3>
                <p className="text-sm text-slate-500">Read the technical whitepaper.</p>
            </a>
        </div>
    </div>
);

export default Security;
