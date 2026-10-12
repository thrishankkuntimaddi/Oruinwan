import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    ArrowRight, Play, Check, CheckCircle2, User, Building2, Download, Globe, Monitor, Smartphone, ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import LoadingScreen from '../../shared/components/ui/LoadingScreen';
import BRAND from '../../shared/brand';
import LandingNav from './LandingNav';
import ProductMock from './ProductMock';
import PlatformTabs from './PlatformTabs';
import AIConsole from './AIConsole';
import FAQ from './FAQ';
import LandingFooter from './LandingFooter';
import { CAPABILITIES, FEATURES, SECURITY, STEPS } from './data';
import { prefersReducedMotion, scrollToId, useRevealAll } from './hooks';
import './landing.css';

// Release files keep the same names in every release (.github/workflows/apps.yml), so these
// links always fetch the newest version.
const RELEASE_DOWNLOADS = 'https://github.com/thrishankkuntimaddi/Oruniwan/releases/latest/download/';
const DESKTOP_DOWNLOADS = [
    { label: 'Mac · Apple Silicon', file: 'Oruinwan-Mac-AppleSilicon.dmg', primary: true },
    { label: 'Mac · Intel', file: 'Oruinwan-Mac-Intel.dmg' },
    { label: 'Windows', file: 'Oruinwan-Windows-Setup.exe' },
    { label: 'Linux · AppImage', file: 'Oruinwan-Linux.AppImage' },
    { label: 'Linux · .deb', file: 'Oruinwan-Linux.deb' },
];

const VISITED_KEY = 'oruinwan_visited';

// Plays the boot animation once per browser; storage can throw in private mode.
function useFirstVisit() {
    const [first] = useState(() => {
        if (prefersReducedMotion()) return false;
        try {
            if (localStorage.getItem(VISITED_KEY) || localStorage.getItem('chttrix_visited')) return false;
            localStorage.setItem(VISITED_KEY, '1');
            return true;
        } catch {
            return false;
        }
    });
    return first;
}

const spotlight = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
};

const SectionHead = ({ eyebrow, title, lead, center }) => (
    <div className={`orw-section__head${center ? ' orw-section__head--center' : ''}`} data-reveal>
        <p className="orw-eyebrow">{eyebrow}</p>
        <h2 className="orw-h2">{title}</h2>
        {lead && <p className="orw-lead">{lead}</p>}
    </div>
);

const Landing = () => {
    const navigate = useNavigate();
    const { hash } = useLocation();
    const { user } = useAuth();
    const rootRef = useRef(null);
    const firstVisit = useFirstVisit();
    const [booting, setBooting] = useState(firstVisit);

    useEffect(() => {
        document.documentElement.classList.add('public-scroll');
        const prevTitle = document.title;
        document.title = `${BRAND.name} · Team chat, tasks and AI in one workspace`;
        if (!window.location.hash) window.scrollTo(0, 0);
        return () => {
            document.documentElement.classList.remove('public-scroll');
            document.title = prevTitle;
        };
    }, []);

    // Arriving from another page via /#section: wait for layout, then scroll there.
    useEffect(() => {
        if (!hash || booting) return undefined;
        const t = setTimeout(() => scrollToId(decodeURIComponent(hash.slice(1))), 60);
        return () => clearTimeout(t);
    }, [hash, booting]);

    useEffect(() => {
        if (user) navigate('/workspaces', { replace: true });
    }, [user, navigate]);

    useRevealAll(rootRef);

    if (user) return null;

    const signup = () => navigate('/login?mode=signup');

    return (
        <div className="orw" ref={rootRef} id="top">
            {booting && <LoadingScreen onComplete={() => setBooting(false)} />}
            <a href="#main" className="orw-skip">Skip to content</a>

            <div className="orw-backdrop" aria-hidden="true">
                <div className="orw-backdrop__grid" />
                <div className="orw-backdrop__aurora orw-backdrop__aurora--a" />
                <div className="orw-backdrop__aurora orw-backdrop__aurora--b" />
            </div>

            <LandingNav />

            <main id="main">
                {/* ── Hero ─────────────────────────────────────────────── */}
                <section className="orw-hero" aria-labelledby="orw-hero-title">
                    <div className="orw-container orw-hero__grid">
                        <div>
                            <span className="orw-chip" data-reveal><span className="orw-dot" aria-hidden="true" />Early access · Free to start</span>
                            <h1 className="orw-hero__title" id="orw-hero-title" data-reveal style={{ '--d': '80ms' }}>
                                <span>One workspace.</span>
                                <span className="orw-gloss-text">Every conversation.</span>
                            </h1>
                            <p className="orw-hero__sub" data-reveal style={{ '--d': '160ms' }}>
                                <strong>{BRAND.name}</strong> brings channels, DMs, voice huddles, tasks, notes and <strong>{BRAND.ai}</strong> into
                                one end-to-end encrypted workspace. Less tab-switching, no lost context, more work done.
                            </p>
                            <div className="orw-hero__ctas" data-reveal style={{ '--d': '240ms' }}>
                                <button type="button" className="orw-btn orw-btn--primary orw-btn--lg" onClick={signup}>
                                    Start free <ArrowRight size={16} />
                                </button>
                                <button type="button" className="orw-btn orw-btn--ghost orw-btn--lg" onClick={() => scrollToId('platform')}>
                                    <Play size={14} /> See how it works
                                </button>
                            </div>
                            <ul className="orw-hero__trust" data-reveal style={{ '--d': '320ms' }}>
                                {['End-to-end encrypted', 'No credit card', 'Role-based access'].map(t => (
                                    <li key={t}><CheckCircle2 size={14} aria-hidden="true" />{t}</li>
                                ))}
                            </ul>
                        </div>
                        <div data-reveal style={{ '--d': '200ms' }}>
                            <ProductMock />
                        </div>
                    </div>
                </section>

                {/* ── Capabilities marquee ─────────────────────────────── */}
                <div className="orw-marquee" aria-label="Capabilities">
                    <ul className="orw-marquee__track">
                        {[...CAPABILITIES, ...CAPABILITIES].map(({ icon: Icon, label }, i) => (
                            <li key={i} className="orw-marquee__item" aria-hidden={i >= CAPABILITIES.length}>
                                <Icon size={16} aria-hidden="true" />{label}
                            </li>
                        ))}
                    </ul>
                </div>

                {/* ── Platform ─────────────────────────────────────────── */}
                <section id="platform" className="orw-section" aria-label="Platform">
                    <div className="orw-container">
                        <SectionHead eyebrow="Platform"
                            title={<>Everything your team needs.<br /><span style={{ color: 'var(--o-text-3)' }}>Nothing it doesn’t.</span></>}
                            lead="Communication, planning, automation and governance, designed as one product rather than stitched together from five." />
                        <PlatformTabs />

                        <div className="orw-bento" data-reveal>
                            {FEATURES.map(({ icon: Icon, color, title, desc }) => (
                                <div key={title} className="orw-feat" onMouseMove={spotlight}>
                                    <div className="orw-feat__icon" style={{ '--c': color }}><Icon size={19} aria-hidden="true" /></div>
                                    <h3>{title}</h3>
                                    <p>{desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── AI ───────────────────────────────────────────────── */}
                <section id="ai" className="orw-section orw-section--slab" aria-label={BRAND.ai}>
                    <div className="orw-container orw-ai">
                        <div data-reveal>
                            <p className="orw-eyebrow">{BRAND.ai}</p>
                            <h2 className="orw-h2">Your AI teammate.<br /><span className="orw-gloss-text">Always in context.</span></h2>
                            <p className="orw-lead">
                                {BRAND.ai} doesn’t just chat. It reads the threads, notes and tasks you already have access to,
                                so its answers are about <em>your</em> work, and it shows you where they came from.
                            </p>
                            <ul className="orw-ai__points">
                                {[
                                    'Summarise any channel or thread in seconds',
                                    'Turn conversations into assigned tasks',
                                    'Ask questions and get answers with sources',
                                    'Draft, rewrite and translate messages',
                                ].map(p => <li key={p}><span aria-hidden="true" />{p}</li>)}
                            </ul>
                            <div style={{ marginTop: 32 }}>
                                <button type="button" className="orw-btn orw-btn--ghost" onClick={() => navigate('/docs')}>
                                    Read the AI docs <ArrowRight size={14} />
                                </button>
                            </div>
                        </div>
                        <AIConsole />
                    </div>
                </section>

                {/* ── Security ─────────────────────────────────────────── */}
                <section id="security" className="orw-section" aria-label="Security">
                    <div className="orw-container">
                        <SectionHead center eyebrow="Security & trust"
                            title={<>Private by design.<br />Governed by you.</>}
                            lead="Encryption happens on your device, and admins get the controls and audit trail a company needs." />
                        <div className="orw-sec" data-reveal>
                            {SECURITY.map(({ icon: Icon, title, desc }) => (
                                <div className="orw-sec__item" key={title}>
                                    <div className="orw-sec__icon"><Icon size={20} aria-hidden="true" /></div>
                                    <h3>{title}</h3>
                                    <p>{desc}</p>
                                </div>
                            ))}
                        </div>
                        <div className="orw-sec__cta" data-reveal>
                            <button type="button" className="orw-btn orw-btn--ghost" onClick={() => navigate('/security')}>
                                <ShieldCheck size={15} aria-hidden="true" /> How we protect your data <ArrowRight size={14} />
                            </button>
                        </div>
                    </div>
                </section>

                {/* ── How it works ─────────────────────────────────────── */}
                <section className="orw-section orw-section--slab" aria-label="How it works">
                    <div className="orw-container">
                        <SectionHead eyebrow="How it works" title="Up and running in minutes." />
                        <ol className="orw-steps">
                            {STEPS.map((s, i) => (
                                <li className="orw-step" key={s.n} data-reveal style={{ '--d': `${i * 100}ms` }}>
                                    <span className="orw-step__n">{s.n}</span>
                                    <h3>{s.title}</h3>
                                    <p>{s.desc}</p>
                                </li>
                            ))}
                        </ol>
                    </div>
                </section>

                {/* ── Plans ────────────────────────────────────────────── */}
                <section id="plans" className="orw-section" aria-label="Plans">
                    <div className="orw-container">
                        <SectionHead center eyebrow="Plans" title="Choose your HQ."
                            lead="Start on your own for free, or set up your whole organisation with Company HQ." />
                        <div className="orw-plans">
                            <article className="orw-plan" data-reveal>
                                <div className="orw-plan__top">
                                    <span className="orw-plan__icon"><User size={20} aria-hidden="true" /></span>
                                    <span className="orw-tag">Personal</span>
                                </div>
                                <h3>Personal workspace</h3>
                                <p className="orw-plan__for">For freelancers, students, side projects and small groups.</p>
                                <div className="orw-plan__price"><b>Free</b><span>no card required</span></div>
                                <ul>
                                    {['Channels, DMs, threads and huddles', 'Tasks, notes and updates', `${BRAND.ai} included`, 'End-to-end encrypted messaging'].map(f => (
                                        <li key={f}><Check size={15} aria-hidden="true" />{f}</li>
                                    ))}
                                </ul>
                                <button type="button" className="orw-btn orw-btn--ghost orw-btn--lg orw-btn--block" onClick={signup}>
                                    Create free account <ArrowRight size={15} />
                                </button>
                            </article>

                            <article className="orw-plan orw-plan--featured" data-reveal style={{ '--d': '100ms' }}>
                                <div className="orw-plan__top">
                                    <span className="orw-plan__icon"><Building2 size={20} aria-hidden="true" /></span>
                                    <span className="orw-tag orw-tag--accent">For organisations</span>
                                </div>
                                <h3>Company HQ</h3>
                                <p className="orw-plan__for">For teams that need structure, oversight and scale.</p>
                                <div className="orw-plan__price"><b>Early access</b><span>verified onboarding</span></div>
                                <ul>
                                    {['Everything in Personal, for your whole company', 'Admin, owner and manager dashboards', 'Departments, org chart and employee directory', 'Permission matrix, analytics and audit logs'].map(f => (
                                        <li key={f}><Check size={15} aria-hidden="true" />{f}</li>
                                    ))}
                                </ul>
                                <button type="button" className="orw-btn orw-btn--primary orw-btn--lg orw-btn--block" onClick={() => navigate('/register-company')}>
                                    Register your company <ArrowRight size={15} />
                                </button>
                            </article>
                        </div>
                        <p className="orw-plans__note" data-reveal>
                            Already on {BRAND.name}? <button type="button" onClick={() => navigate('/login')}>Log in to your workspace</button>
                        </p>
                    </div>
                </section>

                {/* ── Download ─────────────────────────────────────────── */}
                <section id="download" className="orw-section orw-section--slab" aria-label="Download">
                    <div className="orw-container">
                        <SectionHead eyebrow="Available everywhere" title="Your workspace, wherever you are."
                            lead="Use it in the browser, or install the app on your computer, phone or tablet. Everything syncs in real time." />
                        <div className="orw-dl" data-reveal>
                            <div className="orw-dl__item">
                                <div className="orw-dl__head"><span className="orw-dl__icon"><Globe size={20} aria-hidden="true" /></span><span className="orw-tag orw-tag--good">Available now</span></div>
                                <h3>Web app</h3>
                                <p>Works in any modern browser, including Safari on iPad. Nothing to install, always up to date.</p>
                                <div className="orw-dl__actions">
                                    <button type="button" className="orw-btn orw-btn--primary orw-btn--block" onClick={() => navigate('/login')}>
                                        Open {BRAND.name} web <ArrowRight size={14} />
                                    </button>
                                </div>
                            </div>
                            <div className="orw-dl__item">
                                <div className="orw-dl__head"><span className="orw-dl__icon"><Monitor size={20} aria-hidden="true" /></span><span className="orw-tag orw-tag--good">Available now</span></div>
                                <h3>Desktop app</h3>
                                <p>The full workspace in its own window, with native notifications and an unread badge.</p>
                                <div className="orw-dl__actions">
                                    {DESKTOP_DOWNLOADS.map((d) => (
                                        <a key={d.file} className={`orw-btn orw-btn--block ${d.primary ? 'orw-btn--primary' : 'orw-btn--ghost'}`} href={`${RELEASE_DOWNLOADS}${d.file}`}>
                                            <Download size={14} aria-hidden="true" /> {d.label}
                                        </a>
                                    ))}
                                </div>
                            </div>
                            <div className="orw-dl__item">
                                <div className="orw-dl__head"><span className="orw-dl__icon"><Smartphone size={20} aria-hidden="true" /></span><span className="orw-tag orw-tag--good">Android now</span></div>
                                <h3>Mobile and tablet</h3>
                                <p>A phone app built for one hand, and the full workspace on tablets. Updates itself.</p>
                                <div className="orw-dl__actions">
                                    <a className="orw-btn orw-btn--primary orw-btn--block" href={`${RELEASE_DOWNLOADS}Oruinwan-Android.apk`}>
                                        <Download size={14} aria-hidden="true" /> Android phones and tablets
                                    </a>
                                    <button type="button" className="orw-btn orw-btn--ghost orw-btn--block" disabled>iPhone and iPad · coming soon</button>
                                </div>
                            </div>
                        </div>
                        <p className="orw-plans__note" data-reveal>
                            Every version, with checksums and release notes: <a className="orw-link" href="https://github.com/thrishankkuntimaddi/Oruniwan/releases">GitHub Releases</a>
                        </p>
                    </div>
                </section>

                {/* ── FAQ ──────────────────────────────────────────────── */}
                <section id="faq" className="orw-section" aria-label="Frequently asked questions">
                    <div className="orw-container">
                        <SectionHead center eyebrow="FAQ" title="Questions, answered." />
                        <FAQ />
                    </div>
                </section>

                {/* ── Final CTA ────────────────────────────────────────── */}
                <section className="orw-section" style={{ paddingTop: 0 }} aria-label="Get started">
                    <div className="orw-container">
                        <div className="orw-final orw-glass" data-reveal>
                            <p className="orw-eyebrow" style={{ justifyContent: 'center' }}>Get started</p>
                            <h2 className="orw-h2">Build your team’s HQ on <span className="orw-gloss-text">{BRAND.name}</span>.</h2>
                            <p className="orw-lead">Free to start. Set up in minutes. Bring everyone into one workspace.</p>
                            <div className="orw-final__ctas">
                                <button type="button" className="orw-btn orw-btn--primary orw-btn--lg" onClick={signup}>
                                    Get started free <ArrowRight size={16} />
                                </button>
                                <button type="button" className="orw-btn orw-btn--ghost orw-btn--lg" onClick={() => navigate('/login')}>
                                    Log in
                                </button>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            <LandingFooter />
        </div>
    );
};

export default Landing;
