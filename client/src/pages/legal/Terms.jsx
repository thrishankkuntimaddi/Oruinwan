import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const Terms = () => {
    const navigate = useNavigate();

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

            <header className="pt-32 pb-20 container mx-auto px-6 max-w-4xl text-center">
                <h1 className="text-4xl md:text-5xl font-black mb-4">Terms of Service</h1>
                <p className="text-slate-500 dark:text-slate-400">Last updated: January 1, 2026</p>
            </header>

            <section className="pb-20 container mx-auto px-6 max-w-4xl">
                <div className="prose dark:prose-invert prose-lg max-w-none">
                    <p>
                        Please read these Terms of Service ("Terms", "Terms of Service") carefully before using the Chttrix website and platform operated by Chttrix Inc. ("us", "we", or "our").
                    </p>

                    <h3>1. Conditions of Use</h3>
                    <p>
                        We will provide their services to you, which are subject to the conditions stated below in this document. Every time you visit this website, use its services or make a purchase, you accept the following conditions. This is why we urge you to read them carefully.
                    </p>

                    <h3>2. Privacy Policy</h3>
                    <p>
                        Before you continue using our website we advise you to read our privacy policy regarding our user data collection. It will help you better understand our practices.
                    </p>

                    <h3>3. Copyright</h3>
                    <p>
                        Content published on this website (digital downloads, images, texts, graphics, logos) is the property of Chttrix Inc. and/or its content creators and protected by international copyright laws. The entire compilation of the content found on this website is the exclusive property of Chttrix Inc., with copyright authorship for this compilation by Chttrix Inc.
                    </p>

                    <h3>4. Communications</h3>
                    <p>
                        The entire communication with us is electronic. Every time you send us an email or visit our website, you are going to be communicating with us. You hereby consent to receive communications from us. If you subscribe to the news on our website, you are going to receive regular emails from us. We will continue to communicate with you by posting news and notices on our website and by sending you emails. You also agree that all notices, disclosures, agreements, and other communications we provide to you electronically meet the legal requirements that such communications be in writing.
                    </p>

                    <h3>5. Applicable Law</h3>
                    <p>
                        By visiting this website, you agree that the laws of the United States, without regard to principles of conflict laws, will govern these terms of service, or any dispute of any sort that might come between Chttrix Inc. and you, or its business partners and associates.
                    </p>
                </div>
            </section>
            <footer className="py-12 border-t border-slate-200 dark:border-white/5 text-center text-slate-500 dark:text-slate-400">
                <p>© 2026 Chttrix Inc.</p>
            </footer>
        </div>
    );
};

export default Terms;
