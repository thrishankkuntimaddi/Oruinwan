// Oruinwan AI's floating button, bottom right above the tab bar, with a face that follows your
// touch (AiEyes). The same look on every tab; on Chats, Tasks and Notes it is smaller and sits just
// above the tab's own button ("New task"…); on Home and Activity it takes that spot. Tapping it
// opens the quick AI window (QuickAi.jsx) right there.
import { nav } from './nav.js';
import { useFlag } from '../config/flags.js';
import { useKeyboard } from '../native/keyboard.js';
import { cx } from '../ui/cx.js';
import { AiEyes } from './AiEyes.jsx';
import { useQuickAi } from './QuickAi.jsx';

/** Tabs whose main screen has its own button (ui/Button.jsx Fab) bottom right. */
export const TABS_WITH_FAB = new Set(['chats', 'tasks', 'notes']);

const BIG = 56;
const SMALL = 44;

export function AiFab({ tab, hidden = false }) {
  const aiOn = useFlag('ai');
  const keyboardOpen = useKeyboard((s) => s.open);
  const quickOpen = useQuickAi((s) => s.open);
  if (!aiOn || tab === 'ai') return null;
  const small = TABS_WITH_FAB.has(tab);
  const size = small ? SMALL : BIG;
  const off = hidden || keyboardOpen || quickOpen;
  return (
    <button
      type="button"
      aria-label="Oruinwan AI"
      title="Oruinwan AI"
      data-tour="ai"
      data-size={small ? 'small' : 'big'}
      onClick={() => (useQuickAi.getState().show ? useQuickAi.getState().show() : nav.openAi())}
      tabIndex={off ? -1 : 0}
      aria-hidden={off || undefined}
      className={cx(
        'pressable glass absolute z-[15] grid place-items-center rounded-2xl border border-[var(--glass-border)] text-accent-ink shadow-lg',
        off && 'pointer-events-none opacity-0',
      )}
      style={{
        width: size,
        height: size,
        right: 16,
        bottom: small ? `calc(var(--sab) + 76px + ${BIG + 12}px)` : 'calc(var(--sab) + 76px)',
        transition: 'width 260ms var(--ease-out-soft), height 260ms var(--ease-out-soft), bottom 260ms var(--ease-out-soft), opacity 160ms ease-out',
      }}
    >
      <AiEyes size={small ? 24 : 30} />
    </button>
  );
}
