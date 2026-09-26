import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, Zap, Shield, Settings, BookOpen, ArrowRight, X } from 'lucide-react';
import PublicPageShell from '../../components/layout/PublicPageShell';
import { PageHero, Block, Card, Callout, CTABand } from '../../components/public/PublicKit';

const CATEGORIES = [
    { icon: Zap,           color: '#c8a274', title: 'Getting Started',  faqs: [
        { q: 'How do I create a workspace?', a: 'From the home page, click "Get Started" → "Register Company HQ" for a team workspace, or "Personal Account" for individual use. Follow the setup wizard to configure your organization.' },
        { q: 'How do I invite team members?', a: 'From your Admin Dashboard → Members → Invite Members. Enter email addresses or share an invite link. Members will receive an onboarding email with setup instructions.' },
        { q: 'Can I migrate from Slack or Microsoft Teams?', a: 'Oruinwan currently does not have an automated migration tool, but we support bulk member import via CSV. Export your member list from your existing tool and upload it to Admin Dashboard → Members → Import.' },
    ]},
    { icon: MessageSquare, color: '#6ea8fe', title: 'Messaging', faqs: [
        { q: 'How do I create a private channel?', a: 'Click the + icon next to Channels in the sidebar, select "Private", and invite specific members. Private channel content is hidden from non-members, including admins by default.' },
        { q: 'Can I edit or delete sent messages?', a: 'Yes — hover any message you sent and click the ··· menu. You can edit the message (an "edited" label will appear) or delete it entirely. Deleted messages cannot be recovered.' },
        { q: 'How do threads work?', a: 'Hover any message and click "Reply in thread." The thread opens in the right panel. Thread participants receive notifications, and the thread is tracked in your Threads inbox.' },
    ]},
    { icon: Shield,        color: '#5aba8a', title: 'Security & Privacy',  faqs: [
        { q: 'Is my data encrypted?', a: 'Yes. All data is encrypted at rest using AES-256 and in transit using TLS 1.3. We use per-workspace key isolation — your data never crosses tenant boundaries.' },
        { q: 'Can admins read my DMs?', a: 'No. Direct messages are private by design and not accessible to workspace admins unless a legal hold has been placed on the account by authorized legal process.' },
        { q: 'How do I enable two-factor authentication?', a: 'Go to Settings → Security → Two-Factor Authentication. We support authenticator apps (TOTP) and SMS-based 2FA. Enterprise plans can enforce 2FA for all workspace members.' },
    ]},
    { icon: Settings,      color: '#a78bfa', title: 'Account & Settings', faqs: [
        { q: 'How do I change my username or email?', a: 'Settings → Profile → Edit Profile. You can update your display name, job title, bio, and avatar. Email changes require verification of your new address.' },
        { q: 'How do I reset my password?', a: 'From the login page, click "Forgot password?" and enter your email address. You\'ll receive a reset link valid for 1 hour.' },
        { q: 'How do I delete my account?', a: 'Settings → Account → Delete Account. Note: deleting your account removes all personal data from Oruinwan within 30 days. Workspace content you created may remain visible to other members.' },
    ]},
];

const normalize = (t) => t.toLowerCase().replace(/\s+/g, ' ').trim();

// Accessible accordion (same pattern as the landing FAQ). `openKey` is shared
// across categories so only one answer is expanded at a time.
const FaqList = ({ catIndex, faqs, openKey, setOpenKey }) => (
    <div className="orw-faq" style={{ marginTop: 18 }}>
        {faqs.map(({ faq, index }) => {
            const key = `${catIndex}-${index}`;
            const isOpen = openKey === key;
            return (
                <div className="orw-faq__item" key={faq.q}>
                    <h4>
                        <button type="button" className="orw-faq__q" id={`help-q-${key}`}
                            aria-expanded={isOpen} aria-controls={`help-a-${key}`}
                            onClick={() => setOpenKey(isOpen ? null : key)}
                            style={{ fontSize: 14.5, padding: '18px 2px' }}>
                            {faq.q}
                            <span className="orw-faq__sign" aria-hidden="true" />
                        </button>
                    </h4>
                    <div className={`orw-faq__a${isOpen ? ' is-open' : ''}`} id={`help-a-${key}`}
                        role="region" aria-labelledby={`help-q-${key}`} inert={!isOpen}>
                        <div><p style={{ marginTop: 0, paddingLeft: 2 }}>{faq.a}</p></div>
                    </div>
                </div>
            );
        })}
    </div>
);

export default function HelpCenter() {
    const [search, setSearch] = useState('');
    const [openKey, setOpenKey] = useState(null);
    const query = normalize(search);

    // Filter by question + answer text; keep each FAQ's original index so
    // accordion ids stay stable while searching.
    const results = useMemo(() => CATEGORIES.map((cat, catIndex) => ({
        cat,
        catIndex,
        faqs: cat.faqs
            .map((faq, index) => ({ faq, index }))
            .filter(({ faq }) => !query || normalize(`${faq.q} ${faq.a}`).includes(query)),
    })).filter(r => r.faqs.length > 0), [query]);

    const matchCount = results.reduce((n, r) => n + r.faqs.length, 0);

    return (
        <PublicPageShell title="Help Center">
            <PageHero
                crumb="Help Center"
                eyebrow="Help Center"
                icon={BookOpen}
                title={<>How can we <span className="orw-gloss-text">help?</span></>}
                lead="Search our knowledge base or browse by topic below."
                actions={
                    <form role="search" className="orw-field" style={{ width: '100%', maxWidth: 520 }} onSubmit={e => e.preventDefault()}>
                        <label className="orw-label" htmlFor="help-search">Search help articles</label>
                        <div className="orw-input-wrap">
                            <input id="help-search" type="search" className="orw-input" value={search}
                                onChange={e => setSearch(e.target.value)} placeholder="e.g. invite, password, threads"
                                autoComplete="off" aria-describedby="help-search-count" />
                            {search && (
                                <button type="button" className="orw-input-wrap__btn" aria-label="Clear search" onClick={() => setSearch('')}>
                                    <X size={16} aria-hidden="true" />
                                </button>
                            )}
                        </div>
                        <p className="orw-hint" id="help-search-count" aria-live="polite">
                            {query ? `${matchCount} ${matchCount === 1 ? 'answer matches' : 'answers match'} “${search.trim()}”` : `${CATEGORIES.reduce((n, c) => n + c.faqs.length, 0)} answers across ${CATEGORIES.length} topics`}
                        </p>
                    </form>
                }
            />

            <Block eyebrow="Browse by topic" title={query ? 'Search results' : 'Common questions'}>
                {results.length > 0 ? (
                    <div className="orw-grid" style={{ '--min': 'min(440px, 100%)' }} data-reveal>
                        {results.map(({ cat, catIndex, faqs }) => (
                            <Card key={cat.title} icon={cat.icon} color={cat.color} title={cat.title}
                                kicker={`${faqs.length} ${faqs.length === 1 ? 'question' : 'questions'}`}>
                                <FaqList catIndex={catIndex} faqs={faqs} openKey={openKey} setOpenKey={setOpenKey} />
                            </Card>
                        ))}
                    </div>
                ) : (
                    <div data-reveal>
                        <Callout type="warn">
                            <strong>No answers match “{search.trim()}”.</strong> Try a different word, or{' '}
                            <button type="button" className="orw-link" onClick={() => setSearch('')}>clear the search</button>{' '}
                            to browse every topic. You can also <Link className="orw-link" to="/contact">contact support</Link>.
                        </Callout>
                    </div>
                )}
            </Block>

            <CTABand
                eyebrow="Support"
                title="Still need help?"
                lead="Send us a message and our support team will get back to you."
                actions={
                    <Link to="/contact" className="orw-btn orw-btn--primary orw-btn--lg">
                        Contact support <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                }
            />
        </PublicPageShell>
    );
}
