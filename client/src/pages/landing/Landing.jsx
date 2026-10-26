import React, { useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
    ArrowRight, Play, CheckCircle2, Download, Globe, Monitor, Smartphone, ShieldCheck,
    Github, Server, Scale, SlidersHorizontal, GitPullRequest,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import BRAND from '../../shared/brand';
import LandingNav from './LandingNav';
import ProductMock from './ProductMock';
import PlatformTabs from './PlatformTabs';
import AIConsole from './AIConsole';
import FAQ from './FAQ';
import LandingFooter from './LandingFooter';
import { CAPABILITIES, FEATURES, REPO_URL, SECURITY, STEPS } from './data';
import { scrollToId, useRevealAll } from './hooks';
import AppLink from './AppLink';
import PlanCards from '../pricing/PlanCards';
import './landing.css';

// Release files keep the same names in every release (.github/workflows/apps.yml), so these
// links always fetch the newest version.
const RELEASE_DOWNLOADS = 'https://github.com/thrishankkuntimaddi/Oruinwan/releases/latest/download/';
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

    useRevealAll(rootRef);

    // Signed-in visitors still see the landing page; its calls to action open their workspaces.
    const firstName = String(user?.profile?.name || user?.username || '').trim().split(/\s+/)[0];

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
                            <span className="orw-chip" data-reveal>
                                <span className="orw-dot" aria-hidden="true" />
                                {user ? `Welcome back${firstName ? `, ${firstName}` : ''}` : 'Free · Open source · MIT licence'}
                            </span>
                            <h1 className="orw-hero__title" id="orw-hero-title" data-reveal style={{ '--d': '80ms' }}>
                                <span>One workspace.</span>
                                <span className="orw-gloss-text">Every conversation.</span>
                            </h1>
                            <p className="orw-hero__sub" data-reveal style={{ '--d': '160ms' }}>
                                Chat, tasks, notes, huddles and AI in one place with <strong>{BRAND.name}</strong>, on the web,
                                desktop, phone and tablet.
                            </p>
                            <div className="orw-hero__ctas" data-reveal style={{ '--d': '240ms' }}>
                                {user ? (
                                    <Link to="/workspaces" className="orw-btn orw-btn--primary orw-btn--lg">
                                        Open your workspaces <ArrowRight size={16} />
                                    </Link>
                                ) : (
                                    <AppLink to="/login?mode=signup" className="orw-btn orw-btn--primary orw-btn--lg">
                                        Start free <ArrowRight size={16} />
                                    </AppLink>
                                )}
                                <a className="orw-btn orw-btn--ghost orw-btn--lg" href={REPO_URL} target="_blank" rel="noopener noreferrer">
                                    <Github size={15} aria-hidden="true" /> View on GitHub
                                </a>
                                <button type="button" className="orw-btn orw-btn--text" onClick={() => scrollToId('platform')}>
                                    <Play size={14} /> See how it works
                                </button>
                            </div>
                            <ul className="orw-hero__trust" data-reveal style={{ '--d': '320ms' }}>
                                {['Encrypted messages', 'Free plan, no card', 'Host it yourself'].map(t => (
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
                        <SectionHead eyebrow="Features"
                            title={<>Everything your team needs.<br /><span style={{ color: 'var(--o-text-3)' }}>Nothing it doesn’t.</span></>}
                            lead="Chat, meetings, planning, notes, AI and automation, designed as one product rather than stitched together from five." />
                        <PlatformTabs />

                        <div className="orw-bento" data-reveal>
                            {FEATURES.map(({ icon: Icon, color, title, desc, wide }) => (
                                <div key={title} className={`orw-feat${wide ? ' orw-feat--wide' : ''}`} onMouseMove={spotlight}>
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
                            <p className="orw-eyebrow">AI assistant</p>
                            <h2 className="orw-h2">AI in your channels.<br /><span className="orw-gloss-text">Your choice of model.</span></h2>
                            <p className="orw-lead">
                                Work with Claude, ChatGPT, Gemini, Grok or a model you host, right in your conversations. An admin can
                                install an agent for the whole workspace, or you can connect one yourself with your own key.
                            </p>
                            <ul className="orw-ai__points">
                                {[
                                    'Mention @ai in a channel, or open a DM with an agent',
                                    'Summarise threads, reply in them, and turn them into tasks',
                                    'Make notes, set reminders and ask about any chat',
                                    'A recap after every meeting, from its transcript',
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
                            lead="Messages are encrypted and never shown to admins. The server keeps a sealed copy of your key so your devices unlock on their own, and we say so plainly." />
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

                {/* ── Download ─────────────────────────────────────────── */}
                <section id="download" className="orw-section orw-section--slab" aria-label="Download">
                    <div className="orw-container">
                        <SectionHead eyebrow="Apps for every platform" title="Your workspace, wherever you are."
                            lead="Use it in the browser, or install the app on your computer, phone or tablet. Everything syncs in real time, and the apps update themselves in one click." />
                        <div className="orw-dl" data-reveal>
                            <div className="orw-dl__item">
                                <div className="orw-dl__head"><span className="orw-dl__icon"><Globe size={20} aria-hidden="true" /></span><span className="orw-tag orw-tag--good">Available now</span></div>
                                <h3>Web app</h3>
                                <p>Works in any modern browser, including Safari on iPhone and iPad. Nothing to install, always up to date.</p>
                                <div className="orw-dl__actions">
                                    {user ? (
                                        <Link to="/workspaces" className="orw-btn orw-btn--primary orw-btn--block">
                                            Open {BRAND.name} web <ArrowRight size={14} />
                                        </Link>
                                    ) : (
                                        <AppLink to="/login" className="orw-btn orw-btn--primary orw-btn--block">
                                            Open {BRAND.name} web <ArrowRight size={14} />
                                        </AppLink>
                                    )}
                                </div>
                            </div>
                            <div className="orw-dl__item">
                                <div className="orw-dl__head"><span className="orw-dl__icon"><Monitor size={20} aria-hidden="true" /></span><span className="orw-tag orw-tag--good">Available now</span></div>
                                <h3>Desktop app</h3>
                                <p>The full workspace in its own window, with split view, native notifications, quick reply and a tray icon.</p>
                                <div className="orw-dl__actions">
                                    {DESKTOP_DOWNLOADS.map((d) => (
                                        <a key={d.file} className={`orw-btn orw-btn--block ${d.primary ? 'orw-btn--primary' : 'orw-btn--ghost'}`} href={`${RELEASE_DOWNLOADS}${d.file}`}>
                                            <Download size={14} aria-hidden="true" /> {d.label}
                                        </a>
                                    ))}
                                </div>
                            </div>
                            <div className="orw-dl__item">
                                <div className="orw-dl__head"><span className="orw-dl__icon"><Smartphone size={20} aria-hidden="true" /></span><span className="orw-tag orw-tag--good">Android</span></div>
                                <h3>Phone and tablet</h3>
                                <p>An app built for one hand on phones, with split and wide layouts on tablets. On iPhone and iPad, use the web app in Safari.</p>
                                <div className="orw-dl__actions">
                                    <a className="orw-btn orw-btn--primary orw-btn--block" href={`${RELEASE_DOWNLOADS}Oruinwan-Android.apk`}>
                                        <Download size={14} aria-hidden="true" /> Android phones and tablets
                                    </a>
                                </div>
                            </div>
                        </div>
                        <p className="orw-plans__note" data-reveal>
                            Every version, with checksums and release notes: <a className="orw-link" href={`${REPO_URL}/releases/latest`}>GitHub Releases</a>
                        </p>
                    </div>
                </section>

                {/* ── Open source ──────────────────────────────────────── */}
                <section id="open-source" className="orw-section" aria-label="Open source">
                    <div className="orw-container">
                        <div className="orw-oss orw-glass" data-reveal>
                            <div>
                                <p className="orw-eyebrow">Open source</p>
                                <h2 className="orw-h2">Open source on GitHub.<br /><span className="orw-gloss-text">MIT licensed.</span></h2>
                                <p className="orw-lead">
                                    Read the code, run your own server with Docker Compose, change the limits, or send a pull request.
                                    The server, web app, desktop and phone apps all live in one repository.
                                </p>
                                <div className="orw-oss__ctas">
                                    <a className="orw-btn orw-btn--primary orw-btn--lg" href={REPO_URL} target="_blank" rel="noopener noreferrer">
                                        <Github size={16} aria-hidden="true" /> Oruinwan on GitHub
                                    </a>
                                    <a className="orw-btn orw-btn--ghost orw-btn--lg" href={`${REPO_URL}#self-hosting`} target="_blank" rel="noopener noreferrer">
                                        <Server size={15} aria-hidden="true" /> Host it yourself
                                    </a>
                                </div>
                            </div>
                            <ul className="orw-oss__points">
                                {[
                                    { icon: Scale, text: 'MIT licence: use it, change it, ship it' },
                                    { icon: Server, text: 'Self-host with Docker Compose: PostgreSQL, MongoDB and S3 storage' },
                                    { icon: SlidersHorizontal, text: 'Every plan limit is configurable on your own server' },
                                    { icon: GitPullRequest, text: 'Issues and pull requests welcome' },
                                ].map(({ icon: Icon, text }) => (
                                    <li key={text}><Icon size={16} aria-hidden="true" />{text}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </section>

                {/* ── Pricing teaser ───────────────────────────────────── */}
                <section id="pricing" className="orw-section orw-section--slab" aria-label="Pricing">
                    <div className="orw-container">
                        <SectionHead center eyebrow="Pricing" title="Free for teams. Bigger plans soon."
                            lead="Every feature is in the Free plan. Pro and Enterprise, with bigger limits, longer calls, more AI and admin controls, are coming soon." />
                        <div className="prc-root">
                            <PlanCards site />
                        </div>
                        <p className="orw-plans__note" data-reveal>
                            <Link to="/pricing">See every Free plan limit</Link>
                            {' · '}Running a company? <AppLink to="/register-company">Register for the company console</AppLink>
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
                            <p className="orw-lead">Free and open source. Set up in minutes. Bring everyone into one workspace.</p>
                            <div className="orw-final__ctas">
                                {user ? (
                                    <Link to="/workspaces" className="orw-btn orw-btn--primary orw-btn--lg">
                                        Open your workspaces <ArrowRight size={16} />
                                    </Link>
                                ) : (
                                    <>
                                        <AppLink to="/login?mode=signup" className="orw-btn orw-btn--primary orw-btn--lg">
                                            Get started free <ArrowRight size={16} />
                                        </AppLink>
                                        <AppLink to="/login" className="orw-btn orw-btn--ghost orw-btn--lg">
                                            Log in
                                        </AppLink>
                                    </>
                                )}
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
