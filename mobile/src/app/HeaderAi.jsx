// Oruinwan AI's button in a screen's header, next to search: the same face as ever (eyes that
// follow your touch, moods). Tapping it opens the quick AI window, or what the screen asks for
// (a chat: "Ask AI about this chat"). It travels between headers as screens open and close
// (aiFlight.js). Hidden when the floating AI button is chosen in Settings.
import { useFlag } from '../config/flags.js';
import { useQuickAi } from './QuickAi.jsx';
import { nav } from './nav.js';
import { AiEyes } from './AiEyes.jsx';
import { pokeAi } from './aiMood.js';
import { useAiHeaderSpot } from './aiFlight.js';
import { useAiCorner } from './aiCorner.js';

export function openQuickAi() {
  const show = useQuickAi.getState().show;
  if (show) show();
  else nav.openAi();
}

export function HeaderAiButton({ onPress, label = 'Oruinwan AI' }) {
  const aiOn = useFlag('ai');
  const floating = useAiCorner((s) => s.floating);
  if (!aiOn || floating) return null;
  return <HeaderAiFace onPress={onPress} label={label} />;
}

function HeaderAiFace({ onPress, label }) {
  const [ref, style] = useAiHeaderSpot();
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      data-testid="header-ai"
      style={style}
      onClick={() => {
        // A happy face first, then it opens.
        if (pokeAi() === 'tongue') return;
        setTimeout(() => (onPress ? onPress() : openQuickAi()), 160);
      }}
      className="glass pressable mx-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--glass-border)] text-accent-ink shadow-sm"
    >
      <AiEyes size={22} />
    </button>
  );
}
