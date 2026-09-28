import React from 'react';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');

const LABELS = {
    Mod: isMac ? '⌘' : 'Ctrl',
    Shift: isMac ? '⇧' : 'Shift',
    Alt: isMac ? '⌥' : 'Alt',
    Enter: isMac ? '↩' : 'Enter',
    Up: '↑',
    Down: '↓',
};

const NAMES = { Mod: isMac ? 'Command' : 'Control', Up: 'Up arrow', Down: 'Down arrow', Esc: 'Escape' };

/** keys: [['Mod', 'K'], ['Esc']] → ⌘ K  or  Esc. Each inner array is one combination. */
export default function ShortcutKeys({ keys }) {
    return (
        <span className="hp-kbds">
            {keys.map((combo, i) => (
                <React.Fragment key={i}>
                    {i > 0 && <span className="hp-kbds__or">or</span>}
                    <span className="hp-kbds__combo" aria-label={combo.map((k) => NAMES[k] || k).join(' + ')}>
                        {combo.map((k) => <kbd key={k} aria-hidden="true">{LABELS[k] || k}</kbd>)}
                    </span>
                </React.Fragment>
            ))}
        </span>
    );
}
