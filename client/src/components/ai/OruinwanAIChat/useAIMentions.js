import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { insertMention, mentionQueryAt, mentionsInText, peopleFromHandles, suggestPeople } from '../../../utils/aiMentions';

/**
 * @mention autocomplete for a plain <textarea> (the AI panel's composer).
 *
 *   const m = useAIMentions({ value, setValue, members, me, textRef });
 *   <textarea onChange={m.onChange} onSelect={m.onSelect} onKeyDown={(e) => { if (m.onKeyDown(e)) return; … }} />
 *   <AIMentionMenu {...m.menu} />
 *   m.peopleFor(text) → [{ id, username, name }] to send with the question.
 */
export function useAIMentions({ value, setValue, members, me, textRef }) {
    const [caret, setCaret] = useState(0);
    const [chosen, setChosen] = useState([]);
    const [index, setIndex] = useState(0);
    const [dismissed, setDismissed] = useState(null);
    const pendingCaret = useRef(null);

    const at = mentionQueryAt(value, caret);
    const open = !!at && dismissed !== `${at.start}:${value.length}`;
    const suggestions = useMemo(() => (open ? suggestPeople(members, at.query, { me }) : []), [open, members, at?.query, me]); // eslint-disable-line react-hooks/exhaustive-deps

    // Put the caret after a completed mention once the new text has rendered.
    useLayoutEffect(() => {
        if (pendingCaret.current == null || !textRef?.current) return;
        const pos = pendingCaret.current;
        pendingCaret.current = null;
        textRef.current.focus();
        textRef.current.setSelectionRange(pos, pos);
    }, [value, textRef]);

    const pick = useCallback((person) => {
        if (!at) return;
        const next = insertMention(value, at, person);
        pendingCaret.current = next.caret;
        setCaret(next.caret);
        setIndex(0);
        setChosen((list) => (list.some((p) => p.id === person.id) ? list : [...list, person]));
        setValue(next.text);
    }, [at, value, setValue]);

    const onChange = useCallback((e) => {
        setValue(e.target.value);
        setCaret(e.target.selectionStart ?? e.target.value.length);
        setIndex(0);
    }, [setValue]);

    const onSelect = useCallback((e) => setCaret(e.currentTarget.selectionStart ?? 0), []);

    /** Handles the key when the menu is open; returns true when it did. */
    const onKeyDown = useCallback((e) => {
        if (!suggestions.length) return false;
        if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => (i + 1) % suggestions.length); return true; }
        if (e.key === 'ArrowUp') { e.preventDefault(); setIndex((i) => (i - 1 + suggestions.length) % suggestions.length); return true; }
        if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Tab') { e.preventDefault(); pick(suggestions[Math.min(index, suggestions.length - 1)]); return true; }
        if (e.key === 'Escape') { e.preventDefault(); setDismissed(`${at.start}:${value.length}`); return true; }
        return false;
    }, [suggestions, index, pick, at, value.length]);

    /** People mentioned in `text`: the ones picked from the menu, plus any typed "@username" of a member. */
    const peopleFor = useCallback((text) => {
        const picked = mentionsInText(text, chosen);
        const typed = peopleFromHandles(text, members).filter((p) => !picked.some((c) => c.id === p.id) && String(p.id) !== String(me));
        return [...picked, ...typed];
    }, [chosen, members, me]);

    const reset = useCallback(() => { setChosen([]); setCaret(0); setIndex(0); }, []);

    return {
        onChange, onSelect, onKeyDown, peopleFor, reset,
        active: mentionsInText(value, chosen),
        menu: { items: suggestions, activeIndex: Math.min(index, Math.max(0, suggestions.length - 1)), onPick: pick, onHover: setIndex },
    };
}

export default useAIMentions;
