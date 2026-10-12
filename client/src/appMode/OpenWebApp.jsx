// Product website only (vite --mode site, GitHub Pages): "Log in", "Get started" and the other
// app links can't sign in here, because every team runs its own Oruinwan server. This page asks
// for that server and continues to the same page (sign-in, sign-up, …) on it.
import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowRight, TriangleAlert } from 'lucide-react';
import AuthShell from '../components/public/AuthShell';
import { normalizeServer, serverLabel } from './env';

const LAST_KEY = 'oruinwan.site.server';

function lastServer() {
  try {
    return localStorage.getItem(LAST_KEY) || '';
  } catch {
    return '';
  }
}

export default function OpenWebApp() {
  const { pathname, search } = useLocation();
  const signup = new URLSearchParams(search).get('mode') === 'signup' || pathname === '/register-company';
  const [value, setValue] = useState(() => (lastServer() ? serverLabel(lastServer()) : ''));
  const [error, setError] = useState('');

  const open = (e) => {
    e.preventDefault();
    const url = normalizeServer(value);
    if (!url) {
      setError('Enter the address your team uses for Oruinwan, for example chat.example.com.');
      return;
    }
    try {
      localStorage.setItem(LAST_KEY, url);
    } catch {
      /* not remembered: fine */
    }
    window.location.href = `${url}${pathname}${search}`;
  };

  return (
    <AuthShell
      title="Open your workspace"
      aside={
        <>
          <h1 className="orw-auth__title">Your workspace lives<br /><span className="orw-gloss-text">on your team&apos;s server.</span></h1>
          <p className="orw-auth__lead">Oruinwan is self-hosted: each team runs its own server, and that&apos;s where you sign in. Or install the app for your computer, phone or tablet.</p>
        </>
      }
    >
      <div className="orw-auth__panel-head">
        <h2>{signup ? 'Create your account' : 'Open your workspace'}</h2>
        <p>Enter your team&apos;s Oruinwan address. We&apos;ll take you to {signup ? 'sign-up' : 'sign-in'} there.</p>
      </div>
      <form onSubmit={open} className="orw-form" noValidate>
        <div className="orw-field">
          <label className="orw-label" htmlFor="oruinwan-site-server">Server address</label>
          <input
            id="oruinwan-site-server"
            name="server"
            type="url"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
            placeholder="chat.example.com"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError('');
            }}
            className="orw-input"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'oruinwan-site-server-error' : undefined}
          />
        </div>
        {error && (
          <div id="oruinwan-site-server-error" className="orw-auth__alert" role="alert">
            <TriangleAlert size={16} aria-hidden="true" />
            <div>{error}</div>
          </div>
        )}
        <button type="submit" className="orw-btn orw-btn--primary orw-btn--lg orw-btn--block" disabled={!value.trim()}>
          Continue <ArrowRight size={15} />
        </button>
      </form>
      <p className="orw-auth__note">
        Don&apos;t have a server yet? <a className="orw-link" href="https://github.com/thrishankkuntimaddi/Oruniwan#readme">Run your own</a> in a few minutes.
      </p>
    </AuthShell>
  );
}
