// Product website only (vite --mode site, GitHub Pages): it has no server behind it, so "Log in",
// "Get started" and the other app links continue to the same page on the Oruinwan web app
// (VITE_WEB_APP_URL; a local web app until the production one exists).
import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import AuthShell from '../components/public/AuthShell';
import { normalizeServer } from './env';

export const WEB_APP_URL = normalizeServer(import.meta.env.VITE_WEB_APP_URL || 'http://localhost:3000');

export default function OpenWebApp() {
  const { pathname, search } = useLocation();
  const target = `${WEB_APP_URL}${pathname}${search}`;
  const signup = new URLSearchParams(search).get('mode') === 'signup' || pathname === '/register-company';

  useEffect(() => {
    window.location.replace(target);
  }, [target]);

  return (
    <AuthShell title={signup ? 'Create your account' : 'Sign in'}>
      <div className="orw-auth__panel-head">
        <h2>{signup ? 'Create your account' : 'Sign in'}</h2>
        <p>Taking you to Oruinwan…</p>
      </div>
      <a className="orw-btn orw-btn--primary orw-btn--lg orw-btn--block" href={target}>
        Continue <ArrowRight size={15} />
      </a>
    </AuthShell>
  );
}
