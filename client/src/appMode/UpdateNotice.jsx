// "A new version is available" for the desktop app and Android tablets. Reads latest.json from
// the newest GitHub release (the same manifest the phone app uses, mobile/scripts/write-manifest.mjs).
// Desktop: opens the installer for this computer. Android: downloads, verifies and installs the
// APK through the app's AppUpdater plugin. iPads update through the App Store.
import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { appPlatform } from './env';

const MANIFEST_URL = 'https://github.com/thrishankkuntimaddi/Oruniwan/releases/latest/download/latest.json';
const CHECK_EVERY = 6 * 60 * 60 * 1000;
const DISMISSED_KEY = 'oruinwan.update.dismissed';

const button = (primary) => ({
  border: primary ? 0 : '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '6px 12px', fontSize: 13, fontWeight: 600,
  cursor: 'pointer', color: primary ? '#120e08' : '#e4e4e4',
  background: primary ? 'linear-gradient(180deg, #d9b98f 0%, #b8956a 55%, #a5835a 100%)' : 'transparent',
});

const parts = (v) => String(v || '').replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
export function isNewer(candidate, current) {
  const a = parts(candidate);
  const b = parts(current);
  for (let i = 0; i < 3; i += 1) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
  }
  return false;
}

/** The installer for this computer, or the release page. */
export function desktopDownload(manifest, { platform, arch } = {}) {
  const d = (manifest && manifest.downloads) || {};
  const key = platform === 'darwin' ? (arch === 'arm64' ? 'mac-arm64' : 'mac-x64') : platform === 'win32' ? 'win-x64' : null;
  const url = (key && d[key]) || manifest?.pageUrl;
  return typeof url === 'string' && url.startsWith('https://') ? url : 'https://github.com/thrishankkuntimaddi/Oruniwan/releases/latest';
}

function currentVersion() {
  return window.oruinwanDesktop?.version || import.meta.env.VITE_ORUINWAN_APP_VERSION || '0.0.0';
}

export default function UpdateNotice() {
  const platform = appPlatform();
  const [manifest, setManifest] = useState(null);
  const [state, setState] = useState(''); // '' | 'working' | message
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (platform === 'ios') return undefined;
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(`${MANIFEST_URL}?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data && isNewer(data.version, currentVersion())) setManifest(data);
      } catch {
        /* offline or GitHub unreachable: try again later */
      }
    };
    const first = setTimeout(check, 4000);
    const timer = setInterval(check, CHECK_EVERY);
    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [platform]);

  if (!manifest || hidden) return null;
  let dismissed = null;
  try {
    dismissed = localStorage.getItem(DISMISSED_KEY);
  } catch {
    /* ignore */
  }
  if (dismissed === manifest.version) return null;

  const install = async () => {
    if (platform === 'desktop') {
      window.oruinwanDesktop?.openExternal(desktopDownload(manifest, window.oruinwanDesktop));
      return;
    }
    const updater = window.Capacitor?.Plugins?.AppUpdater;
    if (!updater || !manifest.apkUrl) {
      window.open(manifest.pageUrl || 'https://github.com/thrishankkuntimaddi/Oruniwan/releases/latest', '_blank');
      return;
    }
    try {
      const { granted } = await updater.canInstallPackages();
      if (!granted) {
        setState('Allow Oruinwan to install updates, then tap Update again.');
        await updater.openInstallPermissionSettings();
        return;
      }
      setState('working');
      await updater.downloadAndInstall({ url: manifest.apkUrl, version: manifest.version, sha256: manifest.sha256 || '' });
      setState('');
    } catch (err) {
      setState(err?.code === 'CHECKSUM' ? 'The download was damaged, so it was not installed. Try again.' : 'The update could not be downloaded. Try again.');
    }
  };

  const later = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, manifest.version);
    } catch {
      /* ignore */
    }
    setHidden(true);
  };

  return (
    <div
      role="status"
      style={{
        position: 'fixed', right: 16, bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))', zIndex: 9999, width: 320, maxWidth: 'calc(100vw - 32px)',
        background: '#151517', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '14px 16px',
        boxShadow: '0 24px 60px -24px rgba(0,0,0,0.8)', color: '#e4e4e4', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 13,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <Download size={16} style={{ color: '#c9a87c', marginTop: 2, flexShrink: 0 }} aria-hidden="true" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Oruinwan {manifest.version} is available</div>
          <div style={{ color: '#8c8c8c', marginTop: 2 }}>
            {state && state !== 'working' ? state : platform === 'desktop' ? 'Install it over this version. Your data is kept.' : 'Updates keep your data.'}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="button" style={button(true)} onClick={install} disabled={state === 'working'}>
              {state === 'working' ? 'Downloading…' : platform === 'desktop' ? 'Download' : 'Update'}
            </button>
            <button type="button" style={button(false)} onClick={later}>
              Later
            </button>
          </div>
        </div>
        <button type="button" onClick={() => setHidden(true)} aria-label="Close" style={{ background: 'none', border: 0, color: '#8c8c8c', cursor: 'pointer', padding: 2 }}>
          <X size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
