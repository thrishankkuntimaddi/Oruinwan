// Settings → Notifications: what calls need on this phone, each with a way to allow it.
// Microphone and camera (asked again, or system settings if turned down for good), and on
// Android 14+ "full-screen calls" so an incoming call can ring over the lock screen.
import { useCallback, useEffect, useState } from 'react';
import { Camera, Maximize2, Mic } from 'lucide-react';
import { Section, RowGroup, Row } from '../../ui/List.jsx';
import { Button } from '../../ui/Button.jsx';
import { onAppState } from '../../native/index.js';
import {
  fullScreenCallsAllowed,
  hasCallSession,
  openAppSettings,
  openFullScreenCallSettings,
  permissionState,
  requestPermission,
} from '../../native/callSession.js';

const LABEL = { granted: 'Allowed', prompt: 'Not asked yet', 'prompt-with-rationale': 'Not allowed', denied: 'Turned off' };

function PermissionRow({ kind, icon, title, state, onChange }) {
  const [busy, setBusy] = useState(false);
  const allowed = state === 'granted';
  return (
    <Row
      icon={icon}
      tile={allowed ? 'success' : 'neutral'}
      title={title}
      subtitle={LABEL[state] || '…'}
      trailing={
        allowed ? null : (
          <Button
            size="sm"
            variant={state === 'denied' ? 'secondary' : 'primary'}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                if (state === 'denied') await openAppSettings();
                else await requestPermission(kind);
              } finally {
                setBusy(false);
                onChange();
              }
            }}
          >
            {state === 'denied' ? 'Open settings' : 'Allow'}
          </Button>
        )
      }
    />
  );
}

export function CallReadiness() {
  const [mic, setMic] = useState(null);
  const [camera, setCamera] = useState(null);
  const [fullScreen, setFullScreen] = useState(true);
  const refresh = useCallback(async () => {
    setMic(await permissionState('microphone'));
    setCamera(await permissionState('camera'));
    setFullScreen(await fullScreenCallsAllowed());
  }, []);
  useEffect(() => {
    if (!hasCallSession()) return undefined;
    refresh();
    let off = () => {};
    onAppState((active) => active && refresh()).then((f) => (off = f));
    return () => off();
  }, [refresh]);
  if (!hasCallSession()) return null;
  return (
    <Section title="Calls">
      <RowGroup footer="Calls use the microphone, and the camera for video. Full-screen calls let an incoming call ring over the lock screen.">
        <PermissionRow kind="microphone" icon={Mic} title="Microphone" state={mic} onChange={refresh} />
        <PermissionRow kind="camera" icon={Camera} title="Camera" state={camera} onChange={refresh} />
        <Row
          icon={Maximize2}
          tile={fullScreen ? 'success' : 'neutral'}
          title="Full-screen calls"
          subtitle={fullScreen ? 'Allowed' : 'Off: calls only show as a notification'}
          trailing={
            fullScreen ? null : (
              <Button size="sm" variant="secondary" onClick={() => openFullScreenCallSettings()}>
                Open settings
              </Button>
            )
          }
        />
      </RowGroup>
    </Section>
  );
}
