import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowUp } from 'lucide-react';
import BrandMark from '../../shared/components/ui/BrandMark';
import BRAND from '../../shared/brand';
import { useFlag } from '../../contexts/FeatureFlagsContext';
import { scrollToId } from './hooks';

const LandingFooter = () => {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const onHome = pathname === '/' || pathname === '/features';
    const toSection = (id) => (onHome ? scrollToId(id) : navigate(id === 'top' ? '/' : `/#${id}`));
    const communityEnabled = useFlag('community');

    const columns = [
        {
            title: 'Product', links: [
                { label: 'Platform', section: 'platform' },
                { label: BRAND.ai, section: 'ai' },
                { label: 'Plans', section: 'plans' },
                { label: 'Download', section: 'download' },
                { label: 'Security', to: '/security' },
            ],
        },
        {
            title: 'Company', links: [
                { label: 'About', to: '/about' },
                { label: 'Careers', to: '/careers' },
                { label: 'Blog', to: '/blog' },
                { label: 'Brand & media', to: '/brand' },
                { label: 'Contact', to: '/contact' },
            ],
        },
        {
            title: 'Resources', links: [
                { label: 'Documentation', to: '/docs' },
                { label: 'Help center', to: '/help' },
                ...(communityEnabled ? [{ label: 'Community', to: '/community' }] : []),
                { label: 'Partners', to: '/partners' },
                { label: 'Status', to: '/status' },
            ],
        },
        {
            title: 'Legal', links: [
                { label: 'Privacy policy', to: '/privacy' },
                { label: 'Terms of service', to: '/terms' },
                { label: 'Cookie settings', to: '/cookies' },
            ],
        },
    ];

    const onLink = (l) => (e) => {
        e.preventDefault();
        if (l.section) toSection(l.section);
        else navigate(l.to);
    };

    return (
        <footer className="orw-footer">
            <div className="orw-container">
                <div className="orw-footer__grid">
                    <div className="orw-footer__brand">
                        <a href={onHome ? '#top' : '/'} className="orw-logo" onClick={(e) => { e.preventDefault(); toSection('top'); }}>
                            <BrandMark size={28} />
                            <span className="orw-logo__word">{BRAND.name}</span>
                        </a>
                        <p>{BRAND.tagline} Chat, huddles, tasks, notes and AI in one encrypted workspace.</p>
                    </div>
                    {columns.map(col => (
                        <nav key={col.title} aria-label={col.title}>
                            <h4>{col.title}</h4>
                            <ul>
                                {col.links.map(l => (
                                    <li key={l.label}>
                                        <a className="orw-footer__link" href={l.to || (onHome ? `#${l.section}` : `/#${l.section}`)} onClick={onLink(l)}>{l.label}</a>
                                    </li>
                                ))}
                            </ul>
                        </nav>
                    ))}
                </div>

                <div className="orw-footer__wordmark" aria-hidden="true">{BRAND.name.toLowerCase()}</div>

                <div className="orw-footer__bottom">
                    <span>© {BRAND.year} {BRAND.company} All rights reserved.</span>
                    <button type="button" className="orw-btn orw-btn--ghost" onClick={() => scrollToId('top')}>
                        Back to top <ArrowUp size={14} aria-hidden="true" />
                    </button>
                </div>
            </div>
        </footer>
    );
};

export default LandingFooter;
