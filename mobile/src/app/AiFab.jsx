// Oruinwan AI's floating button, bottom right above the tab bar. On Chats, Tasks and Notes it is
// small and sits just above the tab's own + button; on Home and Activity (no + button) it takes
// that spot at full size. Switching tabs animates it between the two.
import { Sparkles } from 'lucide-react';
import { nav } from './nav.js';
import { useFlag } from '../config/flags.js';
import { useKeyboard } from '../native/keyboard.js';
import { Icon } from '../ui/Icon.jsx';
import { cx } from '../ui/cx.js';

/** Tabs whose main screen has its own + button (ui/Button.jsx Fab) bottom right. */
export const TABS_WITH_FAB = new Set(['chats', 'tasks', 'notes']);

const BIG = 56;
const SMALL = 40;

export function AiFab({ tab, hidden = false }) {
  const aiOn = useFlag('ai');
  const keyboardOpen = useKeyboard((s) => s.open);
  if (!aiOn || tab === 'ai') return null;
  const small = TABS_WITH_FAB.has(tab);
  const size = small ? SMALL : BIG;
  const off = hidden || keyboardOpen;
  return (
    <button
      type="button"
      aria-label="Oruinwan AI"
      title="Oruinwan AI"
      data-tour="ai"
      data-size={small ? 'small' : 'big'}
      onClick={nav.openAi}
      tabIndex={off ? -1 : 0}
      aria-hidden={off || undefined}
      className={cx(
        'pressable absolute z-[15] grid place-items-center border border-[var(--glass-border)] text-accent-ink shadow-lg',
        small ? 'glass rounded-xl' : 'rounded-2xl bg-gold text-on-accent',
        off && 'pointer-events-none opacity-0',
      )}
      style={{
        width: size,
        height: size,
        right: small ? 16 + (BIG - SMALL) / 2 : 16,
        bottom: small ? `calc(var(--sab) + 76px + ${BIG + 12}px)` : 'calc(var(--sab) + 76px)',
        transition: 'width 260ms var(--ease-out-soft), height 260ms var(--ease-out-soft), bottom 260ms var(--ease-out-soft), right 260ms var(--ease-out-soft), opacity 160ms ease-out, border-radius 260ms',
      }}
    >
      <Icon as={Sparkles} size={small ? 18 : 24} />
    </button>
  );
}
