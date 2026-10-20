import { useState } from 'react';
import { BellRing } from 'lucide-react';
import { Button } from '../../ui/Button.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { toast } from '../../lib/bus.js';
import { dismissPrompt, promptDismissed, usePushState } from './usePushState.js';

/** Home card: "Turn on notifications". Shown only when the system prompt hasn't been answered. */
export function PushPrompt({ className }) {
  const { state, turnOn } = usePushState();
  const [hidden, setHidden] = useState(promptDismissed);
  const [busy, setBusy] = useState(false);
  if (hidden || state !== 'prompt') return null;
  return (
    <div className={`flex gap-3 rounded-card border border-accent/30 bg-accent/10 p-4 ${className || ''}`} data-testid="push-prompt">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent-ink">
        <Icon as={BellRing} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold">Turn on notifications</p>
        <p className="mt-0.5 text-[13px] text-text-2">Know when someone messages or mentions you, even when the app is closed.</p>
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              const result = await turnOn();
              setBusy(false);
              if (result === 'on') toast('Notifications are on', 'success');
              setHidden(true);
            }}
          >
            Turn on
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              dismissPrompt();
              setHidden(true);
            }}
          >
            Not now
          </Button>
        </div>
      </div>
    </div>
  );
}
