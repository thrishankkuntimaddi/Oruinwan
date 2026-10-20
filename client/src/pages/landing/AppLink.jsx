// "Log in", "Get started" and the other calls to action on the public pages. They open the app
// in a new tab, so the page the visitor was reading stays open:
//  - web build (served by an Oruinwan server): /login, /register-company… on the same origin.
//    Sessions are shared between tabs (localStorage token + httpOnly refresh cookie).
//  - product website (vite --mode site): the web app at VITE_WEB_APP_URL. Without it, the
//    link stays in this tab and /login explains where to go (OpenWebApp).
//  - desktop/tablet app (vite --mode app): there is no landing page, so same window.
import React from 'react';
import { Link } from 'react-router-dom';
import { IS_APP, IS_SITE, normalizeServer } from '../../appMode/env';

const SITE_WEB_APP = IS_SITE ? normalizeServer(import.meta.env.VITE_WEB_APP_URL) : null;

/** True when app links open in a new tab in this build. */
export const APP_LINKS_IN_NEW_TAB = !IS_APP && (!IS_SITE || Boolean(SITE_WEB_APP));

/** Absolute or root-relative address of an app page, e.g. appHref('/login?mode=signup'). */
export const appHref = (to) => (IS_SITE && SITE_WEB_APP ? `${SITE_WEB_APP}${to}` : to);

/** A link to an app page: a new tab on the web, the same window in the apps. */
const AppLink = ({ to, children, ...rest }) => {
    if (!APP_LINKS_IN_NEW_TAB) return <Link to={to} {...rest}>{children}</Link>;
    return <a href={appHref(to)} target="_blank" rel="noopener" {...rest}>{children}</a>;
};

export default AppLink;
