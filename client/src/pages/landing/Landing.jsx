import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    ArrowRight, Play, Check, CheckCircle2, User, Building2, Download, Globe, Monitor, Smartphone, ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import BRAND from '../../shared/brand';
import LandingNav from './LandingNav';
import ProductMock from './ProductMock';
import PlatformTabs from './PlatformTabs';
import AIConsole from './AIConsole';
import FAQ from './FAQ';
import LandingFooter from './LandingFooter';
import { CAPABILITIES, FEATURES, SECURITY, STEPS } from './data';
import { scrollToId, useRevealAll } from './hooks';
import AppLink from './AppLink';
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
        if (!hash) return undefined;
        const t = setTimeout(() => scrollToId(decodeURIComponent(hash.slice(1))), 60);
        return () => clearTimeout(t);
    }, [hash]);

    useEffect(() => {
        if (user) navigate('/workspaces', { replace: true });
    }, [user, navigate]);

    useRevealAll(rootRef);

    if (user) return null;

    return (
        <div className="orw" ref={rootRef} id="top">
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
                            <span className="orw-chip" data-reveal><span className="orw-dot" aria-hidden="true" />Now available · Free to start</span>
                            <h1 className="orw-hero__title" id="orw-hero-title" data-reveal style={{ '--d': '80ms' }}>
                                <span>One workspace.</span>
                                <span className="orw-gloss-text">Every conversation.</span>
                            </h1>
                            <p className="orw-hero__sub" data-reveal style={{ '--d': '160ms' }}>
                                <strong>{BRAND.name}</strong> brings channels, DMs, threads, huddles, tasks, notes and AI agents into one
                                encrypted workspace, on the web, desktop, tablet and phone.
                            </p>
                            <div className="orw-hero__ctas" data-reveal style={{ '--d': '240ms' }}>
                                <AppLink to="/login?mode=signup" className="orw-btn orw-btn--primary orw-btn--lg">
                                    Start free <ArrowRight size={16} />
                                </AppLink>
                                <button type="button" className="orw-btn orw-btn--ghost orw-btn--lg" onClick={() => scrollToId('platform')}>
                                    <Play size={14} /> See how it works
                                </button>
                            </div>
                            <ul className="orw-hero__trust" data-reveal style={{ '--d': '320ms' }}>
                                {['End-to-end encrypted messages', 'Admins never see messages', 'Passkeys and 2FA'].map(t => (
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
                <section id="ai" className="orw-section orw-section--slab" aria-label="Agents">
                    <div className="orw-container orw-ai">
                        <div data-reveal>
                            <p className="orw-eyebrow">Agents</p>
                            <h2 className="orw-h2">AI agents in your channels.<br /><span className="orw-gloss-text">Always in context.</span></h2>
                            <p className="orw-lead">
                                Work with Claude, ChatGPT, Gemini or Grok right in your conversations. An admin can install an agent
                                for the whole workspace, or you can connect one yourself with your own key.
                            </p>
                            <ul className="orw-ai__points">
                                {[
                                    'Mention an agent in a channel, or open a DM with it',
                                    'Summarise threads and turn them into tasks',
                                    'Answers work in encrypted conversations',
                                    'Draft, rewrite and translate messages',
                                ].map(p => <li key={p}><span aria-hidden="true" />{p}</li>)}
                            </ul>
                            <div style={{ marginTop: 32 }}>
                                <button type="button" className="orw-btn orw-btn--ghost" onClick={() => navigate('/docs')}>
                                    Read the agents docs <ArrowRight size={14} />
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
                            lead="Messages are end-to-end encrypted and never shown to admins. Admins get the access controls and audit trail a company needs." />
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
                                    {['Channels, DMs, threads and huddles', 'Tasks, notes and files', 'Agents and integrations', 'End-to-end encrypted messages'].map(f => (
                                        <li key={f}><Check size={15} aria-hidden="true" />{f}</li>
                                    ))}
                                </ul>
                                <AppLink to="/login?mode=signup" className="orw-btn orw-btn--ghost orw-btn--lg orw-btn--block">
                                    Create free account <ArrowRight size={15} />
                                </AppLink>
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
                                    {['Everything in Personal, for your whole company', 'Company console for owners and admins', 'Departments, roles and employee directory', 'Permission matrix and audit logs'].map(f => (
                                        <li key={f}><Check size={15} aria-hidden="true" />{f}</li>
                                    ))}
                                </ul>
                                <AppLink to="/register-company" className="orw-btn orw-btn--primary orw-btn--lg orw-btn--block">
                                    Register your company <ArrowRight size={15} />
                                </AppLink>
                            </article>
                        </div>
                        <p className="orw-plans__note" data-reveal>
                            Already on {BRAND.name}? <AppLink to="/login">Log in to your workspace</AppLink>
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
                                    <AppLink to="/login" className="orw-btn orw-btn--primary orw-btn--block">
                                        Open {BRAND.name} web <ArrowRight size={14} />
                                    </AppLink>
                                </div>
                            </div>
                            <div className="orw-dl__item">
                                <div className="orw-dl__head"><span className="orw-dl__icon"><Monitor size={20} aria-hidden="true" /></span><span className="orw-tag orw-tag--good">Available now</span></div>
                                <h3>Desktop app</h3>
                                <p>The full workspace in its own window, with split view, native notifications and an unread badge.</p>
                                <div className="orw-dl__actions">
                                    {DESKTOP_DOWNLOADS.map((d) => (
                                        <a key={d.file} className={`orw-btn orw-btn--block ${d.primary ? 'orw-btn--primary' : 'orw-btn--ghost'}`} href={`${RELEASE_DOWNLOADS}${d.file}`}>
                                            <Download size={14} aria-hidden="true" /> {d.label}
                                        </a>
                                    ))}
                                </div>
                            </div>
                            <div className="orw-dl__item">
                                <div className="orw-dl__head"><span className="orw-dl__icon"><Smartphone size={20} aria-hidden="true" /></span><span className="orw-tag orw-tag--good">Android and iOS</span></div>
                                <h3>Phone and tablet</h3>
                                <p>A phone app built for one hand, and the full workspace with split view on tablets.</p>
                                <div className="orw-dl__actions">
                                    <a className="orw-btn orw-btn--primary orw-btn--block" href={`${RELEASE_DOWNLOADS}Oruinwan-Android.apk`}>
                                        <Download size={14} aria-hidden="true" /> Android phones and tablets
                                    </a>
                                    <span className="orw-btn orw-btn--ghost orw-btn--block" aria-disabled="true">iPhone and iPad · via TestFlight</span>
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
                                <AppLink to="/login?mode=signup" className="orw-btn orw-btn--primary orw-btn--lg">
                                    Get started free <ArrowRight size={16} />
                                </AppLink>
                                <AppLink to="/login" className="orw-btn orw-btn--ghost orw-btn--lg">
                                    Log in
                                </AppLink>
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
