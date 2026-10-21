import React, { useState } from 'react';
import { X } from 'lucide-react';
import { normalizeTag } from '../../hooks/useFiles';

/**
 * Chip-style tag editor: type a tag and press Enter, comma or Tab to add it; Backspace in an
 * empty box removes the last one. `suggestions` (tags already used in the workspace) are offered
 * as one-click chips. Controlled: `value` is the tag array, `onChange` gets the next array.
 */
export default function FileTagsInput({ value = [], onChange, suggestions = [], disabled = false, label = 'Tags', placeholder = 'Add a tag' }) {
    const [draft, setDraft] = useState('');

    const add = (raw) => {
        const parts = String(raw).split(',').map(normalizeTag).filter(Boolean);
        const next = [...value];
        parts.forEach((t) => { if (!next.includes(t)) next.push(t); });
        if (next.length !== value.length) onChange(next);
        setDraft('');
    };
    const remove = (tag) => onChange(value.filter((t) => t !== tag));

    const onKeyDown = (e) => {
        if ((e.key === 'Enter' || e.key === ',' || (e.key === 'Tab' && draft.trim())) && draft.trim()) {
            e.preventDefault();
            add(draft);
        } else if (e.key === 'Backspace' && !draft && value.length) {
            remove(value[value.length - 1]);
        }
    };

    const offered = suggestions.filter((t) => !value.includes(t)).slice(0, 8);

    return (
        <div className="fl-tags-edit">
            <div className="gl-input fl-tags-box" data-disabled={disabled ? 'true' : undefined}>
                {value.map((tag) => (
                    <span key={tag} className="fl-tag">
                        #{tag}
                        {!disabled && (
                            <button type="button" onClick={() => remove(tag)} aria-label={`Remove tag ${tag}`} title={`Remove #${tag}`}>
                                <X size={10} />
                            </button>
                        )}
                    </span>
                ))}
                {!disabled && (
                    <input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={onKeyDown}
                        onBlur={() => draft.trim() && add(draft)}
                        placeholder={value.length ? '' : placeholder}
                        aria-label={label}
                    />
                )}
            </div>
            {!disabled && offered.length > 0 && (
                <div className="fl-tag-suggest" aria-label="Tags used in this workspace">
                    {offered.map((t) => (
                        <button key={t} type="button" className="fl-tag-chip" onClick={() => add(t)}>#{t}</button>
                    ))}
                </div>
            )}
        </div>
    );
}

export const FILE_TAGS_CSS = `
.fl-tags-edit { display: flex; flex-direction: column; gap: 6px; }
.fl-tags-box { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; height: auto; min-height: 36px; padding: 5px 8px; cursor: text; }
.fl-tags-box[data-disabled='true'] { cursor: default; }
.fl-tags-box input { flex: 1; min-width: 90px; border: 0; outline: none; background: transparent; color: var(--text-primary); font: inherit; font-size: 12.5px; padding: 2px 0; }
.fl-tags-box input::placeholder { color: var(--text-muted); }
.fl-tag { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; font-size: 11px; font-weight: 600; color: var(--accent); background: var(--gl-accent-soft); border: 1px solid var(--gl-accent-line); border-radius: var(--gl-radius); }
.fl-tag button { display: flex; padding: 0; background: none; border: 0; color: var(--text-muted); cursor: pointer; }
.fl-tag button:hover { color: var(--state-danger); }
.fl-tag-suggest { display: flex; flex-wrap: wrap; gap: 4px; }
.fl-tag-chip { padding: 2px 8px; font: inherit; font-size: 11px; color: var(--text-secondary); background: var(--bg-hover); border: 1px solid var(--border-subtle); border-radius: var(--gl-radius); cursor: pointer; }
.fl-tag-chip:hover { color: var(--accent); border-color: var(--gl-accent-line); }
`;
