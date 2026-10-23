// The composer's formatting row (Markdown, as the web composer sends it) and emoji sheet.
import { useState } from 'react';
import { Bold, Code, Italic, Link, List, ListOrdered, SquareCode, Strikethrough, TextQuote, X } from 'lucide-react';
import { Icon } from '../../ui/Icon.jsx';
import { Sheet } from '../../ui/Overlay.jsx';
import { COMPOSER_EMOJIS } from '../../data/constants.js';

export const FORMAT_BUTTONS = [
  { kind: 'bold', icon: Bold, label: 'Bold' },
  { kind: 'italic', icon: Italic, label: 'Italic' },
  { kind: 'strike', icon: Strikethrough, label: 'Strikethrough' },
  { kind: 'code', icon: Code, label: 'Inline code' },
  { kind: 'codeblock', icon: SquareCode, label: 'Code block' },
  { kind: 'link', icon: Link, label: 'Link' },
  { kind: 'ul', icon: List, label: 'Bulleted list' },
  { kind: 'ol', icon: ListOrdered, label: 'Numbered list' },
  { kind: 'quote', icon: TextQuote, label: 'Quote' },
];

// Taps on the row must not take focus from the message box, or its selection is lost.
const keepFocus = (e) => e.preventDefault();

/** onFormat(kind) for every format but links; onLink(url) once a URL is typed. */
export function FormatToolbar({ onFormat, onLinkOpen, onLink }) {
  const [linking, setLinking] = useState(false);
  const [url, setUrl] = useState('');
  const close = () => {
    setLinking(false);
    setUrl('');
  };
  const add = () => {
    if (!url.trim()) return;
    onLink(url);
    close();
  };

  if (linking) {
    return (
      <div className="flex items-center gap-2 px-3 pt-2" data-testid="composer-link-bar">
        <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-input px-3 focus-within:border-accent/70">
          <Icon as={Link} size={14} className="shrink-0 text-text-3" />
          <input
            autoFocus
            type="url"
            inputMode="url"
            autoCapitalize="none"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              } else if (e.key === 'Escape') close();
            }}
            placeholder="Paste or type a link"
            aria-label="Link address"
            className="w-full min-w-0 bg-transparent text-[14px] outline-none placeholder:text-text-3"
          />
        </div>
        <button type="button" onClick={add} disabled={!url.trim()} className="pressable h-9 rounded-xl bg-gold px-3 text-[13px] font-medium text-on-accent disabled:opacity-45">
          Add link
        </button>
        <button type="button" onClick={close} aria-label="Cancel link" className="pressable grid h-9 w-9 place-items-center rounded-xl text-text-2">
          <Icon as={X} size={16} />
        </button>
      </div>
    );
  }

  return (
    <div role="toolbar" aria-label="Formatting" className="flex items-center gap-0.5 overflow-x-auto px-2 pt-1.5" data-testid="composer-format-bar">
      {FORMAT_BUTTONS.map((b) => (
        <button
          key={b.kind}
          type="button"
          aria-label={b.label}
          title={b.label}
          onPointerDown={keepFocus}
          onMouseDown={keepFocus}
          onClick={() => {
            if (b.kind === 'link') {
              onLinkOpen?.();
              setLinking(true);
            } else onFormat(b.kind);
          }}
          className="pressable grid h-9 w-9 shrink-0 place-items-center rounded-lg text-text-2 active:bg-surface-2 active:text-accent-ink"
        >
          <Icon as={b.icon} size={17} />
        </button>
      ))}
    </div>
  );
}

export function EmojiSheet({ open, onClose, onPick }) {
  return (
    <Sheet open={open} onClose={onClose} title="Pick an emoji">
      <div className="grid grid-cols-8 gap-1 px-4 pb-4" data-testid="composer-emoji-grid">
        {COMPOSER_EMOJIS.map((e) => (
          <button
            key={e}
            type="button"
            aria-label={`Insert ${e}`}
            onClick={() => onPick(e)}
            className="pressable grid aspect-square place-items-center rounded-xl text-[22px] active:bg-surface-2"
          >
            {e}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
