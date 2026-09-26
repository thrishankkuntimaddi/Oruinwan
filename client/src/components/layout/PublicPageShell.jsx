import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import LandingNav from '../../pages/landing/LandingNav';
import LandingFooter from '../../pages/landing/LandingFooter';
import { scrollToId } from '../../pages/landing/hooks';
import { OrwRoot, usePublicPage } from '../public/PublicKit';

// Chrome for every public page (company, resources, legal): the same nav,
// footer and ambient backdrop as the landing page. Pages compose their body
// from components/public/PublicKit.
const PublicPageShell = ({ title, children }) => {
    const { pathname, hash } = useLocation();
    usePublicPage(title);

    // New page: start at the top, or at the #section the link asked for.
    useEffect(() => {
        if (!hash) { window.scrollTo(0, 0); return undefined; }
        const t = setTimeout(() => scrollToId(decodeURIComponent(hash.slice(1))), 80);
        return () => clearTimeout(t);
    }, [pathname, hash]);

    return (
        <OrwRoot>
            <a href="#main" className="orw-skip">Skip to content</a>
            <LandingNav />
            <main id="main">{children}</main>
            <LandingFooter />
        </OrwRoot>
    );
};

export default PublicPageShell;
