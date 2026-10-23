import { useEffect, useState } from 'react';
import { BellRing, PhoneCall } from 'lucide-react';
import { Button } from '../../ui/Button.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { toast } from '../../lib/bus.js';
import { onAppState } from '../../native/index.js';
import { dismissFullScreen, dismissPrompt, fullScreenDismissed, promptDismissed, usePushState } from './usePushState.js';

function Card({ icon, title, body, primary, onPrimary, busy, onLater, testId }) {
  return (
    <div className="flex gap-3 rounded-card border border-accent/30 bg-accent/10 p-4" data-testid={testId}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent-ink">
        <Icon as={icon} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold">{title}</p>
        <p className="mt-0.5 text-[13px] text-text-2">{body}</p>
        <div className="mt-3 flex gap-2">
          <Button size="sm" loading={busy} onClick={onPrimary}>
            {primary}
          </Button>
          <Button size="sm" variant="ghost" onClick={onLater}>
            Not now
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Home card: "Turn on notifications" while the system prompt hasn't been answered, then (Android
 * 14+) "Let calls ring full screen" while that is off.
 */
export function PushPrompt({ className }) {
  const { state, turnOn, refresh, fullScreen, allowFullScreen } = usePushState();
  const [hidden, setHidden] = useState(promptDismissed);
  const [fsHidden, setFsHidden] = useState(fullScreenDismissed);
  const [busy, setBusy] = useState(false);
  // Back from the system's settings: show the new state.
  useEffect(() => {
    let off = () => {};
    onAppState((active) => active && refresh()).then((f) => (off = f));
    return () => off();
  }, [refresh]);

  if (state === 'prompt' && !hidden) {
    return (
      <div className={className || ''}>
        <Card
          testId="push-prompt"
          icon={BellRing}
          title="Turn on notifications"
          body="Know when someone messages, mentions or calls you, even when the app is closed."
          primary="Turn on"
          busy={busy}
          onPrimary={async () => {
            setBusy(true);
            const result = await turnOn();
            setBusy(false);
            if (result === 'on') toast('Notifications are on', 'success');
            setHidden(true);
          }}
          onLater={() => {
            dismissPrompt();
            setHidden(true);
          }}
        />
      </div>
    );
  }
  if (state === 'on' && !fullScreen && !fsHidden) {
    return (
      <div className={className || ''}>
        <Card
          testId="fullscreen-prompt"
          icon={PhoneCall}
          title="Let calls ring full screen"
          body="Android asks you to allow this, so an incoming call can ring over the lock screen like a phone call."
          primary="Open settings"
          onPrimary={() => allowFullScreen()}
          onLater={() => {
            dismissFullScreen();
            setFsHidden(true);
          }}
        />
      </div>
    );
  }
  return null;
}
