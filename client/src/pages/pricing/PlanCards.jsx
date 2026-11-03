import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Sparkles, Building2, Leaf, Mail } from 'lucide-react';
import AppLink from '../landing/AppLink';
import { PLANS, upgradeHref, enterpriseHref } from './plans';
import './pricing.css';

const ICONS = { free: Leaf, pro: Sparkles, enterprise: Building2 };

/**
 * The three plan cards. `site` renders them for the public pages (orw buttons, links open the
 * app); otherwise for the signed-in app (gl buttons, the Free card is the current plan).
 */
const PlanCards = ({ site = false, currentPlan = null }) => {
    const btn = (primary) => (site
        ? `orw-btn orw-btn--lg orw-btn--block ${primary ? 'orw-btn--primary' : 'orw-btn--ghost'}`
        : `gl-btn gl-btn--lg gl-btn--block${primary ? ' gl-btn--primary' : ''}`);

    return (
        <div className="prc-grid">
            {PLANS.map((plan, i) => {
                const Icon = ICONS[plan.id] || Leaf;
                const available = plan.status === 'available';
                const current = currentPlan === plan.id;
                const featured = plan.id === 'pro';
                return (
                    <article key={plan.id} className={`prc-card${featured ? ' prc-card--featured' : ''}`} data-reveal style={{ '--d': `${i * 90}ms` }}
                        aria-labelledby={`prc-${plan.id}`}>
                        <div className="prc-card__top">
                            <span className="prc-card__icon"><Icon size={19} aria-hidden="true" /></span>
                            {current && <span className="prc-tag prc-tag--good">Your plan</span>}
                            {!current && available && <span className="prc-tag prc-tag--good">Available now</span>}
                            {!current && plan.id === 'pro' && <span className="prc-tag prc-tag--good">Most popular</span>}
                            {!current && plan.id === 'enterprise' && <span className="prc-tag">Set up for you</span>}
                        </div>
                        <h3 id={`prc-${plan.id}`} className="prc-card__name">{plan.name}</h3>
                        <p className="prc-card__tagline">{plan.tagline}</p>
                        <div className="prc-card__price">
                            <b>{plan.price}</b>
                            <span>{plan.priceNote}</span>
                        </div>
                        <ul className="prc-card__list">
                            {plan.features.map((f) => (
                                <li key={f}><Check size={15} aria-hidden="true" />{f}</li>
                            ))}
                        </ul>
                        <div className="prc-card__cta">
                            {available && site && plan.cta && (
                                <AppLink to={plan.cta.to} className={btn(true)}>{plan.cta.label} <ArrowRight size={15} aria-hidden="true" /></AppLink>
                            )}
                            {available && !site && (
                                current
                                    ? <span className={btn(false)} aria-disabled="true">Your current plan</span>
                                    : <Link to="/workspaces" className={btn(true)}>Open your workspaces <ArrowRight size={15} aria-hidden="true" /></Link>
                            )}
                            {plan.status === 'request' && !current && (
                                <a href={upgradeHref()} className={btn(true)}>
                                    {plan.cta.label} <ArrowRight size={15} aria-hidden="true" />
                                </a>
                            )}
                            {plan.status === 'contact' && !current && (
                                <a href={enterpriseHref()} className={btn(false)}>
                                    <Mail size={14} aria-hidden="true" /> {plan.cta.label}
                                </a>
                            )}
                            {!available && current && <span className={btn(false)} aria-disabled="true">Your current plan</span>}
                        </div>
                    </article>
                );
            })}
        </div>
    );
};

export default PlanCards;
