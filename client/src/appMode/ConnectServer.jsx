// First screen of the desktop and tablet apps: which Oruinwan server to use. Oruinwan is
// self-hosted, so the address is the one the team opens in the browser.
import React, { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ArrowRight, TriangleAlert } from 'lucide-react';
import AuthShell from '../components/public/AuthShell';
import { getServer, normalizeServer, serverLabel, setServer } from './env';
import { forgetSession } from './network';

async function isOruinwanServer(url) {
  const res = await fetch(`${url}/api/health`, { cache: 'no-store' });
  if (!res.ok) return false;
  const data = await res.json().catch(() => null);
  return Boolean(data && typeof data.status === 'string');
}

export default function ConnectServer() {
  const previous = getServer();
  const [value, setValue] = useState(previous ? serverLabel(previous) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const connect = async (e) => {
    e.preventDefault();
    const url = normalizeServer(value);
    if (!url) {
      setError('Enter the address your team uses for Oruinwan, for example chat.example.com.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (!(await isOruinwanServer(url))) throw new Error('not oruinwan');
    } catch {
      setBusy(false);
      setError(`Can't reach an Oruinwan server at ${serverLabel(url)}. Check the address and your connection.`);
      return;
    }
    if (url !== previous) forgetSession();
    setServer(url);
    // Start fresh so every module reads the new address.
    window.location.replace('/login');
  };

  return (
    <MemoryRouter>
      <AuthShell
        title="Connect to your server"
        aside={
          <>
            <h1 className="orw-auth__title">Your team&apos;s workspace,<br /><span className="orw-gloss-text">on your own server.</span></h1>
            <p className="orw-auth__lead">Oruinwan is self-hosted. Enter the address your team uses for Oruinwan on the web, then sign in as usual.</p>
          </>
        }
      >
        <div className="orw-auth__panel-head">
          <h2>Connect to your server</h2>
          <p>The address you open Oruinwan at in the browser, like <span className="orw-code">chat.example.com</span>.</p>
        </div>
        <form onSubmit={connect} className="orw-form" noValidate>
          <div className="orw-field">
            <label className="orw-label" htmlFor="oruinwan-server">Server address</label>
            <input
              id="oruinwan-server"
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
              aria-describedby={error ? 'oruinwan-server-error' : undefined}
            />
          </div>
          {error && (
            <div id="oruinwan-server-error" className="orw-auth__alert" role="alert">
              <TriangleAlert size={16} aria-hidden="true" />
              <div>{error}</div>
            </div>
          )}
          <button type="submit" className="orw-btn orw-btn--primary orw-btn--lg orw-btn--block" disabled={busy || !value.trim()} aria-busy={busy}>
            {busy ? 'Connecting…' : <>Continue <ArrowRight size={15} /></>}
          </button>
        </form>
      </AuthShell>
    </MemoryRouter>
  );
}
