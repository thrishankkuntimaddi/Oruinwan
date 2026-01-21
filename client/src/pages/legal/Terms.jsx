import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ScrollText, Scale, Gavel, AlertTriangle, FileText,
    Fingerprint, Globe, ChevronRight, Menu, X, ArrowLeft,
    XCircle, Mail, AlertOctagon
} from 'lucide-react';

const tabs = [
    { id: 'general', label: 'General Terms', icon: Scale },
    { id: 'usage', label: 'Acceptable Use', icon: AlertOctagon },
    { id: 'content', label: 'Content & IP', icon: FileText },
    { id: 'liability', label: 'Liability & Disclaimer', icon: AlertTriangle },
    { id: 'contact', label: 'Contact', icon: Mail },
];

const Terms = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('general');
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
                    <ScrollText className="text-indigo-600" size={24} />
                    <span>Terms Center</span>
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
                            <span className="block font-extrabold text-xl tracking-tight leading-none text-slate-900 dark:text-white">Terms Center</span>
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
                        Last Updated: <span className="font-bold text-slate-600 dark:text-slate-300">Jan 2026</span>
                    </p>
                    <button onClick={() => navigate('/privacy')} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline block mb-1">
                        Privacy Policy
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
                        <section id="general" className="scroll-mt-24">
                            <GeneralSection scrollToSection={scrollToSection} />
                        </section>
                        <section id="usage" className="scroll-mt-24">
                            <UsageSection />
                        </section>
                        <section id="content" className="scroll-mt-24">
                            <ContentSection />
                        </section>
                        <section id="liability" className="scroll-mt-24">
                            <LiabilitySection />
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

const GeneralSection = ({ scrollToSection }) => (
    <div className="space-y-12 animate-fade-in">
        <div className="space-y-6">
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
                Terms of Service.
            </h1>
            <p className="text-xl text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">
                Please read these terms carefully before using Chttrix. They define the rules and regulations for the use of our service, ensuring a safe environment for everyone.
            </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
            <div onClick={() => scrollToSection('usage')} className="cursor-pointer group p-8 bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all duration-300 hover:border-orange-500/20">
                <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-2xl flex items-center justify-center text-orange-600 dark:text-orange-400 mb-6 group-hover:scale-110 transition-transform">
                    <AlertOctagon size={24} />
                </div>
                <h3 className="text-xl font-bold mb-3 flex items-center gap-2 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                    Acceptable Use <ChevronRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity -ml-2 group-hover:ml-0" />
                </h3>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                    Rules about illegal activities, harassment, and security interference.
                </p>
            </div>
            <div onClick={() => scrollToSection('content')} className="cursor-pointer group p-8 bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all duration-300 hover:border-blue-500/20">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400 mb-6 group-hover:scale-110 transition-transform">
                    <FileText size={24} />
                </div>
                <h3 className="text-xl font-bold mb-3 flex items-center gap-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    Content & IP <ChevronRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity -ml-2 group-hover:ml-0" />
                </h3>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                    You own your content. We own the platform.
                </p>
            </div>
        </div>

        <div className="space-y-8 bg-slate-50 dark:bg-[#111827] p-8 rounded-3xl border border-slate-100 dark:border-slate-800">
            <div>
                <h3 className="text-lg font-bold mb-2">1. Acceptance of Terms</h3>
                <p className="text-slate-600 dark:text-slate-400">
                    By accessing or using Chttrix, you agree to be bound by these Terms of Service. If you disagree with any part of the terms, you may not access the Service.
                </p>
            </div>
            <div>
                <h3 className="text-lg font-bold mb-2">2. Eligibility</h3>
                <ul className="list-disc pl-5 text-slate-600 dark:text-slate-400 space-y-1">
                    <li>Must be of minimum legal age in your jurisdiction.</li>
                    <li>If representing an organization, you must have authority to bind it.</li>
                </ul>
            </div>
            <div>
                <h3 className="text-lg font-bold mb-2">3. Accounts & Security</h3>
                <p className="text-slate-600 dark:text-slate-400">
                    You are responsible for maintaining the confidentiality of your account credentials. Notify us immediately of any unauthorized use.
                </p>
            </div>
        </div>
    </div>
);

const UsageSection = () => (
    <div className="space-y-10 animate-fade-in">
        <header className="border-b border-slate-200 dark:border-slate-800 pb-8">
            <h2 className="text-3xl font-bold mb-4">Acceptable Use Policy</h2>
            <p className="text-lg text-slate-600 dark:text-slate-400">
                We foster a safe, secure, and respectful collaboration environment.
            </p>
        </header>

        <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-3xl p-8">
            <h3 className="text-xl font-bold text-red-900 dark:text-red-300 mb-6 flex items-center gap-2">
                <AlertOctagon size={22} /> Prohibited Activities
            </h3>
            <div className="grid sm:grid-cols-1 md:grid-cols-2 gap-4">
                <ForbiddenItem text="Illegal activities of any kind" />
                <ForbiddenItem text="Harassment, abuse, or threats" />
                <ForbiddenItem text="Malware/Virus distribution" />
                <ForbiddenItem text="Bypassing encryption/security" />
                <ForbiddenItem text="Spamming or automated abuse" />
                <ForbiddenItem text="Reverse engineering the platform" />
            </div>
        </div>
    </div>
);

const ContentSection = () => (
    <div className="space-y-10 animate-fade-in">
        <header className="border-b border-slate-200 dark:border-slate-800 pb-8">
            <h2 className="text-3xl font-bold mb-4">Content & Intellectual Property</h2>
        </header>

        <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-[#111827] p-8 rounded-3xl border border-slate-200 dark:border-slate-800">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Fingerprint size={20} className="text-indigo-500" /> Your Content
                </h3>
                <p className="text-slate-600 dark:text-slate-400 mb-4">
                    <strong>You retain full ownership</strong> of all content you submit, post, or display.
                </p>
                <p className="text-sm text-slate-500">
                    You grant Chttrix a limited license strictly to process encrypted content for the purpose of operating the service (e.g., routing messages).
                </p>
            </div>

            <div className="bg-white dark:bg-[#111827] p-8 rounded-3xl border border-slate-200 dark:border-slate-800">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Globe size={20} className="text-blue-500" /> Our IP
                </h3>
                <p className="text-slate-600 dark:text-slate-400 mb-4">
                    <strong>9. Intellectual Property</strong>
                </p>
                <p className="text-sm text-slate-500">
                    All Chttrix software, branding, design, and original content remain the exclusive property of Chttrix Inc.
                </p>
            </div>
        </div>
    </div>
);

const LiabilitySection = () => (
    <div className="space-y-10 animate-fade-in">
        <header className="border-b border-slate-200 dark:border-slate-800 pb-8">
            <h2 className="text-3xl font-bold mb-4">Liability, Disclaimers & Termination</h2>
        </header>

        <div className="space-y-8">
            <div className="bg-orange-50 dark:bg-orange-900/10 p-8 rounded-3xl border border-orange-100 dark:border-orange-900/30">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-orange-800 dark:text-orange-300">
                    <AlertTriangle size={20} /> 6. Encryption Disclaimer
                </h3>
                <p className="text-slate-700 dark:text-slate-300 font-medium">
                    Important: We cannot recover encrypted messages if your keys are lost.
                </p>
                <p className="text-slate-600 dark:text-slate-400 text-sm mt-2">
                    Because we use end-to-end encryption with client-side keys, we do not have a "master key". You are solely responsible for your device security and recovery codes.
                </p>
            </div>

            <div className="bg-white dark:bg-[#111827] p-8 rounded-3xl border border-slate-200 dark:border-slate-800">
                <div className="grid gap-6">
                    <div>
                        <h4 className="font-bold text-slate-900 dark:text-white mb-2">7. Service Availability</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Provided "as is" and "as available". We do not warrant uninterrupted uptime.</p>
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-900 dark:text-white mb-2">8. Termination</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400">We may suspend accounts for TOS violations. You may terminate your account at any time.</p>
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-900 dark:text-white mb-2">10. Limitation of Liability</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400">We are not liable for indirect damages, lost profits, or data loss to the extent permitted by law.</p>
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-900 dark:text-white mb-2">11. Indemnification</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400">You agree to indemnify Chttrix against claims arising from your use of the service.</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
);

const ContactSection = () => (
    <div className="space-y-10 animate-fade-in">
        <header className="border-b border-slate-200 dark:border-slate-800 pb-8">
            <h2 className="text-3xl font-bold mb-4">Contact & Updates</h2>
        </header>

        <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-[#111827] p-8 rounded-3xl border border-slate-200 dark:border-slate-800">
                <h3 className="text-lg font-bold mb-4">13. Changes to Terms</h3>
                <p className="text-slate-600 dark:text-slate-400">
                    We reserve the right to modify these terms. Continued use of the Service constitutes acceptance.
                </p>
                <h3 className="text-lg font-bold mt-8 mb-4">12. Governing Law</h3>
                <p className="text-slate-600 dark:text-slate-400">
                    Governed by applicable laws without regard to conflict of law principles.
                </p>
            </div>

            <div className="bg-slate-900 dark:bg-indigo-900 text-white p-8 rounded-3xl shadow-xl flex flex-col justify-between">
                <div>
                    <Gavel size={32} className="mb-4 opacity-80" />
                    <h3 className="text-2xl font-bold mb-2">Legal Questions?</h3>
                    <p className="opacity-90 mb-6">Contact our Legal Team.</p>
                </div>
                <a href="mailto:kthrishank.9@gmail.com" className="bg-white text-slate-900 px-6 py-3 rounded-xl font-bold text-center hover:bg-slate-100 transition-colors">
                    kthrishank.9@gmail.com
                </a>
            </div>
        </div>
    </div>
);

// --- Helpers ---

const ForbiddenItem = ({ text }) => (
    <div className="flex items-center gap-3 bg-white dark:bg-black/20 p-3 rounded-xl">
        <XCircle size={18} className="text-red-500 shrink-0" />
        <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">{text}</span>
    </div>
);

export default Terms;
