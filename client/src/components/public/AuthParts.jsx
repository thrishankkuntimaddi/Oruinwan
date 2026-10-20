import React from 'react';
import { OrwRoot, usePublicPage } from './PublicKit';
import './authParts.css';

/*
 * Small pieces shared by the standalone screens around sign-in (invites, email
 * verification, registration, password set-up). Use them inside <AuthShell>.
 */

/** Icon tile above a panel head. tone: undefined (accent) | 'good' | 'bad' | 'warn'. */
export const AuthMark = ({ icon: Icon, tone, spin, children }) => (
    <span className={`orw-auth-mark${tone ? ` orw-auth-mark--${tone}` : ''}`} aria-hidden="true">
        {children || <Icon size={19} className={spin ? 'orw-spin' : undefined} />}
    </span>
);

/** Head of a panel: optional eyebrow, the title and one line of lead text. */
export const AuthHead = ({ eyebrow, title, children }) => (
    <div className="orw-auth__panel-head">
        {eyebrow && <p className="orw-eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
        {children && <p>{children}</p>}
    </div>
);

/**
 * A complete status panel: mark, head, optional body and a stack of actions.
 * Used for loading, success and error states so they all read the same way.
 */
export const AuthStatus = ({ icon, tone, spin, eyebrow, title, lead, children, actions, role }) => (
    <div role={role || (tone === 'bad' ? 'alert' : 'status')} aria-live="polite">
        <AuthMark icon={icon} tone={tone} spin={spin} />
        <AuthHead eyebrow={eyebrow} title={title}>{lead}</AuthHead>
        {children}
        {actions && <div className="orw-auth-actions">{actions}</div>}
    </div>
);

/** "What happens next" list. items: array of nodes. */
export const AuthNext = ({ title = 'What happens next', items }) => (
    <div className="orw-auth-next">
        <p className="orw-auth-next__title">{title}</p>
        <ol>{items.map((it, i) => <li key={i}>{it}</li>)}</ol>
    </div>
);

/** Thin bar that fills while we wait to move the person on. */
export const AuthProgress = ({ ms = 3000, label }) => (
    <div className="orw-auth-progress" role="progressbar" aria-label={label} style={{ '--dur': `${ms}ms` }}><span /></div>
);

/** Full-page loading in the public look (before a panel has anything to show). */
export const AuthLoading = ({ label = 'Loading…', title }) => {
    usePublicPage(title);
    return (
        <OrwRoot>
            <div className="orw-auth-loading" aria-busy="true">
                <div className="orw-auth-loading__inner" role="status">
                    <div className="orw-auth-loading__bar" />
                    <span>{label}</span>
                </div>
            </div>
        </OrwRoot>
    );
};
