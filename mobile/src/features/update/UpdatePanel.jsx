// The update card used by the launch sheet, the blocking gate and Settings → Updates.
import { Download, ExternalLink, RefreshCw, ShieldCheck } from 'lucide-react';
import { useUpdate, installUpdate } from '../../update/updater.js';
import { installerReason } from '../../update/bundle.js';
import { isAndroid, isDesktop, isNative, isPlayStore } from '../../native/index.js';
import { Button } from '../../ui/Button.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { Markdown } from '../../ui/Markdown.jsx';

const STATE_TEXT = {
  downloading: 'Downloading',
  verifying: 'Checking the signature',
  unpacking: 'Unpacking',
  restarting: 'Restarting Oruinwan…',
  installing: 'Opening the installer…',
  permission: 'Waiting for permission',
  failed: 'Update failed',
};

export function UpdateProgress() {
  const download = useUpdate((s) => s.download);
  if (!download) return null;
  return (
    <div className="mt-4" aria-live="polite">
      <div className="mb-1.5 flex justify-between text-xs text-text-2">
        <span>{STATE_TEXT[download.state] || download.state}</span>
        {download.state === 'downloading' && <span>{Math.round(download.percent)}%</span>}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
        <div
          className={download.state === 'failed' ? 'h-full bg-danger' : 'h-full bg-accent transition-[width] duration-300'}
          style={{ width: `${download.state === 'failed' ? 100 : Math.max(4, download.percent)}%` }}
        />
      </div>
      {download.message && <p className="mt-2 text-xs text-text-2">{download.message}</p>}
    </div>
  );
}

export function UpdateDetails({ manifest, compact }) {
  const plan = useUpdate((s) => s.plan);
  if (!manifest) return null;
  const quick = plan?.mode === 'bundle';
  const why = plan?.mode === 'installer' ? installerReason(plan.reason) : null;
  return (
    <div>
      {manifest.notes ? (
        <div className={compact ? 'max-h-48 overflow-y-auto' : ''}>
          <Markdown text={manifest.notes} className="text-sm text-text-2" />
        </div>
      ) : (
        <p className="text-sm text-text-2">Bug fixes and improvements.</p>
      )}
      {quick ? (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-text-2">
          <Icon as={ShieldCheck} size={14} className="text-success" />
          Quick update: signed by Oruinwan, checked, then the app restarts. No reinstall.
        </p>
      ) : (
        manifest.sha256 &&
        isNative &&
        isAndroid && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-text-2">
            <Icon as={ShieldCheck} size={14} className="text-success" />
            The download is checked before it is installed.
          </p>
        )
      )}
      {why && <p className="mt-2 text-xs text-text-2">{why}</p>}
    </div>
  );
}

export function UpdateButton({ block = true }) {
  const download = useUpdate((s) => s.download);
  const quick = useUpdate((s) => s.plan?.mode === 'bundle');
  const busy = download && ['downloading', 'verifying', 'unpacking', 'restarting', 'installing'].includes(download.state);
  const inApp = isNative && isAndroid && (quick || !isPlayStore);
  const failed = download?.state === 'failed';
  let label;
  if (quick) label = failed ? 'Try again' : 'Update and restart';
  else if (inApp) label = failed ? 'Try again' : 'Update now';
  else if (isPlayStore) label = 'Update on Google Play';
  else label = isDesktop ? 'Download the update' : 'Open download page';
  return (
    <Button block={block} size="lg" icon={quick ? RefreshCw : inApp ? Download : ExternalLink} loading={busy} onClick={installUpdate}>
      {label}
    </Button>
  );
}
