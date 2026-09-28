import React, { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, ExternalLink, ListTodo, Loader2, CheckCircle2, RotateCcw } from 'lucide-react';

/** A textarea that grows with its text. */
function AutoText({ value, onChange, onKeyDown, onBlur, disabled, placeholder, label, inputRef }) {
    const ref = useRef(null);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight + 2}px`;
    }, [value]);
    return (
        <textarea
            ref={(el) => { ref.current = el; if (inputRef) inputRef(el); }}
            rows={1}
            value={value}
            placeholder={placeholder}
            aria-label={label}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={onBlur}
        />
    );
}

/**
 * Live shared notes for the huddle. Everyone in the call types into the same
 * Note (it stays in Notes afterwards); "Action item" lines feed the Tasks tab.
 */
export default function NotesTab({ notes, live, notesHref, onOpenNotes, onCreateTask }) {
    const [draft, setDraft] = useState('');
    const focusRefs = useRef({});
    const focusNext = useRef(null);

    useEffect(() => {
        const id = focusNext.current;
        if (id && focusRefs.current[id]) {
            focusRefs.current[id].focus();
            focusNext.current = null;
        }
    });

    if (notes.status === 'loading' || notes.status === 'idle') {
        return <div className="hw-muted hw-row"><Loader2 size={14} className="animate-spin" /> Opening the huddle notes…</div>;
    }
    if (notes.status === 'error') {
        return (
            <div>
                <p className="hw-error" role="alert">{notes.error}</p>
                <button type="button" className="gl-btn gl-btn--sm" onClick={notes.reload}><RotateCcw size={12} /> Try again</button>
            </div>
        );
    }

    const addAction = async (e) => {
        e?.preventDefault?.();
        const text = draft.trim();
        if (!text) return;
        setDraft('');
        try { await notes.upsertAction({ text }); } catch { setDraft(text); }
    };

    const onParaKey = (e, p) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            notes.flushParagraph(p.id);
            const id = notes.addParagraph(p.id);
            focusNext.current = id;
        } else if (e.key === 'Backspace' && !p.text && notes.paragraphs.length > 1) {
            e.preventDefault();
            const i = notes.paragraphs.findIndex((x) => x.id === p.id);
            const prev = notes.paragraphs[i - 1] || notes.paragraphs[i + 1];
            notes.removeParagraph(p.id);
            if (prev) focusNext.current = prev.id;
        }
    };

    return (
        <div data-testid="huddle-notes">
            <div className="hw-row" style={{ marginBottom: 10 }}>
                <p className="hw-muted hw-grow" style={{ margin: 0 }}>
                    {live
                        ? 'Everyone in the huddle edits these notes live. They stay in Notes after the call.'
                        : 'The call has ended. These notes are in Notes.'}
                </p>
                {notesHref && (
                    <a className="gl-btn gl-btn--sm gl-btn--ghost" href={notesHref} onClick={onOpenNotes} title="Open in Notes">
                        <ExternalLink size={12} /> Notes
                    </a>
                )}
            </div>

            <div className="hw-section"><span>Discussion</span>{notes.saving ? <span className="hw-muted" style={{ textTransform: 'none', letterSpacing: 0 }}>Saving…</span> : null}</div>
            {notes.paragraphs.length === 0 && !live && <p className="hw-muted">No notes were taken.</p>}
            {notes.paragraphs.map((p) => {
                const typing = notes.remote[p.id];
                return (
                    <div key={p.id} className={`hw-para${typing ? ' is-remote' : ''}`} data-testid="huddle-note-paragraph">
                        {typing && <span className="hw-typing">{typing.username} is typing</span>}
                        <AutoText
                            value={p.text}
                            disabled={!live}
                            label="Note paragraph"
                            placeholder="Type notes… (Enter for a new line)"
                            inputRef={(el) => { focusRefs.current[p.id] = el; }}
                            onChange={(text) => notes.editParagraph(p.id, text)}
                            onKeyDown={(e) => onParaKey(e, p)}
                            onBlur={() => notes.flushParagraph(p.id)}
                        />
                        {live && notes.paragraphs.length > 1 && (
                            <button type="button" className="gl-icon-btn hw-para-remove" title="Remove paragraph" aria-label="Remove paragraph" onClick={() => notes.removeParagraph(p.id)}>
                                <Trash2 size={12} />
                            </button>
                        )}
                    </div>
                );
            })}
            {live && (
                <button type="button" className="gl-btn gl-btn--sm gl-btn--ghost" data-testid="huddle-note-add"
                    onClick={() => { focusNext.current = notes.addParagraph(notes.paragraphs[notes.paragraphs.length - 1]?.id || null); }}>
                    <Plus size={12} /> Add paragraph
                </button>
            )}

            <div className="hw-section"><span>Action items</span><span className="gl-count">{notes.actions.length}</span></div>
            {notes.actions.length === 0 && <p className="hw-muted">Nothing yet. Add who does what next.</p>}
            {notes.actions.map((a) => (
                <div key={a.id} className={`hw-action${a.done ? ' is-done' : ''}`} data-testid="huddle-action-item">
                    <input type="checkbox" checked={!!a.done} disabled={!live} aria-label={`Done: ${a.text}`}
                        onChange={() => notes.upsertAction({ ...a, done: !a.done }).catch(() => {})} />
                    <span className="hw-action-text">{a.text || <em className="hw-muted">(empty)</em>}</span>
                    {a.taskId
                        ? <span className="hw-badge hw-badge--accent" title="A task was created for this"><CheckCircle2 size={10} /> Task</span>
                        : onCreateTask && (
                            <button type="button" className="gl-btn gl-btn--sm" onClick={() => onCreateTask(a)} title="Create a task from this action item">
                                <ListTodo size={12} /> Task
                            </button>
                        )}
                    {live && (
                        <button type="button" className="gl-icon-btn" title="Remove action item" aria-label="Remove action item" onClick={() => notes.removeAction(a.id)}>
                            <Trash2 size={12} />
                        </button>
                    )}
                </div>
            ))}
            {live && (
                <form onSubmit={addAction} className="hw-row" style={{ marginTop: 6 }}>
                    <input className="gl-input" value={draft} onChange={(e) => setDraft(e.target.value)}
                        placeholder="Action item, e.g. Bob: send the draft by Friday" aria-label="New action item" />
                    <button type="submit" className="gl-btn gl-btn--sm gl-btn--primary" disabled={!draft.trim()}>
                        <Plus size={12} /> Add
                    </button>
                </form>
            )}
            {notes.saveError && <p className="hw-error" role="alert" style={{ marginTop: 8 }}>{notes.saveError}</p>}
        </div>
    );
}
