import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useUpdate, skipVersion } from '../../update/updater.js';
import { useSession } from '../../data/session.js';
import { BrandMark } from '../../app/BrandMark.jsx';
import { Sheet } from '../../ui/Overlay.jsx';
import { Button } from '../../ui/Button.jsx';
import { UpdateButton, UpdateDetails, UpdateProgress } from './UpdatePanel.jsx';

/** Blocks the app when this version is below the release's minimum; otherwise offers the update once. */
export function UpdateGate() {
  const status = useUpdate((s) => s.status);
  const manifest = useUpdate((s) => s.manifest);
  const skipped = useUpdate((s) => s.skipped);
  const current = useUpdate((s) => s.currentVersion);
  const signedIn = useSession((s) => s.status === 'signed-in');
  const [dismissed, setDismissed] = useState(null);

  const offer = status === 'available' && manifest && skipped !== manifest.version && dismissed !== manifest.version;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (offer && signedIn) {
      const t = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(t);
    }
    setOpen(false);
    return undefined;
  }, [offer, signedIn]);

  if (status === 'required' && manifest) {
    return createPortal(
      <div className="fixed inset-0 z-[80] flex flex-col bg-bg px-6 pt-safe pb-safe" role="alertdialog" aria-label="Update required">
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <BrandMark size={72} glow />
          <h1 className="mt-6 text-2xl font-bold tracking-tight">Update required</h1>
          <p className="mt-2 max-w-xs text-sm text-text-2">
            Version {current} can no longer connect safely. Version {manifest.version} fixes this and keeps your data as it is.
          </p>
          <div className="mt-6 w-full max-w-sm text-left">
            <UpdateDetails manifest={manifest} compact />
            <UpdateProgress />
          </div>
        </div>
        <div className="mx-auto w-full max-w-sm pb-4">
          <UpdateButton />
        </div>
      </div>,
      document.body,
    );
  }

  return (
    <Sheet
      open={open}
      onClose={() => {
        setOpen(false);
        setDismissed(manifest?.version);
      }}
      title={`Version ${manifest?.version} is available`}
      footer={
        <div className="space-y-2">
          <UpdateButton />
          <div className="flex gap-2">
            <Button
              variant="ghost"
              block
              size="sm"
              onClick={() => {
                setOpen(false);
                setDismissed(manifest?.version);
              }}
            >
              Later
            </Button>
            <Button
              variant="ghost"
              block
              size="sm"
              onClick={() => {
                skipVersion(manifest.version);
                setOpen(false);
              }}
            >
              Skip this version
            </Button>
          </div>
        </div>
      }
    >
      <div className="px-5 pb-4">
        <p className="mb-3 text-[13px] text-text-2">You have {current}. Your data stays as it is.</p>
        <UpdateDetails manifest={manifest} compact />
        <UpdateProgress />
      </div>
    </Sheet>
  );
}
