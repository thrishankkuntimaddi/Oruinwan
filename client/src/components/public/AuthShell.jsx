import React from 'react';
import { Link } from 'react-router-dom';
import { MessagesSquare, Headphones, Sparkles, Lock } from 'lucide-react';
import BrandMark from '../../shared/components/ui/BrandMark';
import BRAND from '../../shared/brand';
import { OrwRoot, usePublicPage } from './PublicKit';

const POINTS = [
    { icon: MessagesSquare, text: 'Channels, DMs and threads' },
    { icon: Headphones, text: 'One-click voice huddles' },
    { icon: Sparkles, text: `${BRAND.ai}, aware of your workspace` },
    { icon: Lock, text: 'End-to-end encrypted messages' },
];

const Logo = () => (
    <Link to="/" className="orw-logo" aria-label={`${BRAND.name} home`}>
        <BrandMark size={30} />
        <span className="orw-logo__word">{BRAND.name}</span>
    </Link>
);

/**
 * Layout for sign-in, sign-up and password screens.
 * `title` sets the tab title; `aside` overrides the left-hand headline.
 */
const AuthShell = ({ title, aside, children }) => {
    usePublicPage(title);
    return (
        <OrwRoot>
            <div className="orw-auth">
                <aside className="orw-auth__aside">
                    <Logo />
                    <div data-reveal>
                        {aside || (
                            <>
                                <h1 className="orw-auth__title">One workspace.<br /><span className="orw-gloss-text">Every conversation.</span></h1>
                                <p className="orw-auth__lead">Chat, huddles, tasks, notes and {BRAND.ai}, together in one end-to-end encrypted workspace.</p>
                            </>
                        )}
                        <ul className="orw-auth__points">
                            {POINTS.map(({ icon: Icon, text }) => (
                                <li key={text}><span><Icon size={15} aria-hidden="true" /></span>{text}</li>
                            ))}
                        </ul>
                    </div>
                    <div className="orw-auth__foot">
                        <span>© {BRAND.year} {BRAND.company}</span>
                        <Link to="/privacy">Privacy</Link>
                        <Link to="/terms">Terms</Link>
                        <Link to="/security">Security</Link>
                        <Link to="/help">Help</Link>
                    </div>
                </aside>

                <main className="orw-auth__main" id="main">
                    <div className="orw-auth__mobile-brand"><Logo /></div>
                    <div className="orw-auth__panel orw-glass" data-reveal>
                        {children}
                    </div>
                </main>
            </div>
        </OrwRoot>
    );
};

export default AuthShell;
