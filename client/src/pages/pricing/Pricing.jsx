import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Github, Tag } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { IS_APP } from '../../appMode/env';
import PublicPageShell from '../../components/layout/PublicPageShell';
import { PageHero, Block } from '../../components/public/PublicKit';
import PlanCards from './PlanCards';
import { FREE_LIMITS, NOTIFY_EMAIL, REPO_URL } from './plans';
import './pricing.css';

export const FreeLimits = () => (
    <section className="prc-limits" data-reveal aria-labelledby="prc-limits-title">
        <div className="prc-limits__head">
            <h2 id="prc-limits-title">What the Free plan includes</h2>
            <p>Every feature is in Free: chat, huddles, tasks, notes, AI, integrations and the apps. These are the limits.</p>
        </div>
        <dl>
            {FREE_LIMITS.map((l) => (
                <div className="prc-limits__row" key={l.id}>
                    <dt>{l.label}</dt>
                    <dd>{l.value}</dd>
                </div>
            ))}
        </dl>
    </section>
);

const Footnote = () => (
    <p className="prc-note">
        Running your own server? Every limit is configurable, see the <a href={`${REPO_URL}#configurable-limits`} target="_blank" rel="noopener noreferrer">README</a>.
        {' '}Questions: <a href={`mailto:${NOTIFY_EMAIL}`}>{NOTIFY_EMAIL}</a>
    </p>
);

/** Signed in (web) or inside an app: an app page with the app theme (light and dark). */
const AppPricing = () => {
    const navigate = useNavigate();
    const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/workspaces'));
    return (
        <div className="prc-app">
            <header className="gl-page-head">
                <div>
                    <button type="button" className="gl-btn gl-btn--ghost gl-btn--sm" onClick={back}>
                        <ArrowLeft size={14} aria-hidden="true" /> Back
                    </button>
                    <h1 className="gl-page-title">Plans and pricing</h1>
                    <p className="gl-page-lead">You are on Free. Pro and Enterprise are coming soon.</p>
                </div>
            </header>
            <div className="prc-app__body prc-root">
                <PlanCards currentPlan="free" />
                <FreeLimits />
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
            title={<>Free for teams. <span className="orw-gloss-text">Bigger plans soon.</span></>}
            lead="Oruinwan is free to use. Pro and Enterprise plans with bigger limits and admin controls are on the way."
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
