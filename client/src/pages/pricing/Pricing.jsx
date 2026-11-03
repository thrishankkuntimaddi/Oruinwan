import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Github, Mail, Tag } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { IS_APP } from '../../appMode/env';
import PublicPageShell from '../../components/layout/PublicPageShell';
import { PageHero, Block } from '../../components/public/PublicKit';
import { usePlan } from '../../features/plan/usePlan';
import PlanCards from './PlanCards';
import { FREE_LIMITS, PRO_LIMITS, SALES_EMAIL, REPO_URL, enterpriseHref } from './plans';
import './pricing.css';

const LimitsTable = ({ id, title, lead, rows }) => (
    <section className="prc-limits" data-reveal aria-labelledby={id}>
        <div className="prc-limits__head">
            <h2 id={id}>{title}</h2>
            <p>{lead}</p>
        </div>
        <dl>
            {rows.map((l) => (
                <div className="prc-limits__row" key={l.id}>
                    <dt>{l.label}</dt>
                    <dd>{l.value}</dd>
                </div>
            ))}
        </dl>
    </section>
);

export const FreeLimits = () => (
    <LimitsTable id="prc-limits-title" title="What the Free plan includes" rows={FREE_LIMITS}
        lead="Every feature is in Free: chat, huddles, tasks, notes, AI, integrations and the apps. These are the limits." />
);

export const ProLimits = () => (
    <LimitsTable id="prc-pro-title" title="What Pro raises" rows={PRO_LIMITS}
        lead="Same product, more room. Pro is billed per member, and everyone in a Pro workspace gets Pro limits inside it." />
);

const ENTERPRISE_STEPS = [
    { id: 'call', label: '1. Call', value: '30 minutes about your team, your tools and where Oruinwan should run' },
    { id: 'proposal', label: '2. Proposal', value: 'A fixed setup price and a yearly price per member, in writing' },
    { id: 'setup', label: '3. Setup', value: 'Install, single sign-on, your domain and email, workspaces and departments' },
    { id: 'rollout', label: '4. Rollout', value: 'Invites, onboarding sessions and a named contact for support' },
];

/** Enterprise: what "we set it up for you" means, and how to reach us. */
export const EnterpriseBlock = ({ site = false }) => (
    <section className="prc-limits" data-reveal aria-labelledby="prc-ent-title">
        <div className="prc-limits__head">
            <h2 id="prc-ent-title">Enterprise: we set it up for you</h2>
            <p>
                Tell us about your company and we reply within two business days. We plan the setup with you,
                install Oruinwan on your servers or cloud (or host it for you), connect your sign-in and domain,
                bring your people in and train your admins. After that you get priority support.
            </p>
        </div>
        <dl>
            {ENTERPRISE_STEPS.map((l) => (
                <div className="prc-limits__row" key={l.id}>
                    <dt>{l.label}</dt>
                    <dd>{l.value}</dd>
                </div>
            ))}
        </dl>
        <p className="prc-note">
            <a className={site ? 'orw-btn orw-btn--primary' : 'gl-btn gl-btn--primary'} href={enterpriseHref()}>
                <Building2 size={14} aria-hidden="true" /> Talk to us about Enterprise
            </a>
            {' '}or write to <a href={`mailto:${SALES_EMAIL}`}><Mail size={12} aria-hidden="true" /> {SALES_EMAIL}</a>
        </p>
    </section>
);

const Footnote = () => (
    <p className="prc-note">
        Pro is switched on by our team once payment is received, usually the same business day. Prices are in US dollars, plus tax where it applies.
        {' '}Running your own server? Every limit is configurable, see the <a href={`${REPO_URL}#configurable-limits`} target="_blank" rel="noopener noreferrer">README</a>.
        {' '}Questions: <a href={`mailto:${SALES_EMAIL}`}>{SALES_EMAIL}</a>
    </p>
);

const PLAN_NAMES = { free: 'Free', pro: 'Pro', enterprise: 'Enterprise' };

/** The caller's plan for the cards: company accounts are on Enterprise terms. */
export function currentPlanOf(info) {
    const raw = info?.userPlan || 'free';
    if (raw === 'company') return 'enterprise';
    return PLAN_NAMES[raw] ? raw : 'free';
}

/** Signed in (web) or inside an app: an app page with the app theme (light and dark). */
const AppPricing = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { plan: info } = usePlan(user ? null : false);
    const current = currentPlanOf(info);
    const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/workspaces'));
    return (
        <div className="prc-app">
            <header className="gl-page-head">
                <div>
                    <button type="button" className="gl-btn gl-btn--ghost gl-btn--sm" onClick={back}>
                        <ArrowLeft size={14} aria-hidden="true" /> Back
                    </button>
                    <h1 className="gl-page-title">Plans and pricing</h1>
                    <p className="gl-page-lead">
                        You are on {PLAN_NAMES[current]}.
                        {current === 'free' ? ' Upgrade to Pro for more room, or talk to us about Enterprise.' : ''}
                    </p>
                </div>
            </header>
            <div className="prc-app__body prc-root">
                <PlanCards currentPlan={current} />
                <FreeLimits />
                <ProLimits />
                <EnterpriseBlock />
                <Footnote />
            </div>
        </div>
    );
};

const PublicPricing = () => (
    <PublicPageShell title="Pricing">
        <PageHero
            center
            eyebrow="Pricing"
            icon={Tag}
            title={<>One workspace. <span className="orw-gloss-text">Simple pricing.</span></>}
            lead="Start free with every feature. Move to Pro when your team outgrows the limits, or let us set Oruinwan up for your whole company with Enterprise."
            actions={(
                <a className="orw-btn orw-btn--ghost" href={REPO_URL} target="_blank" rel="noopener noreferrer">
                    <Github size={15} aria-hidden="true" /> Source on GitHub
                </a>
            )}
        />
        <Block>
            <div className="prc-root">
                <PlanCards site />
                <FreeLimits />
                <ProLimits />
                <EnterpriseBlock site />
                <Footnote />
            </div>
        </Block>
    </PublicPageShell>
);

const Pricing = () => {
    const { user } = useAuth();
    return IS_APP || user ? <AppPricing /> : <PublicPricing />;
};

export default Pricing;
