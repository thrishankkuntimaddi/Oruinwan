import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles, Check, RotateCcw, FileText } from 'lucide-react';
import BRAND from '../../shared/brand';
import { AI_PROMPTS } from './data';
import { prefersReducedMotion } from './hooks';

const THINK_MS = 650;
const CHARS_PER_TICK = 3;
const TICK_MS = 16;

// Scripted demo of the assistant: pick a prompt, watch it "think", then stream
// the answer. Generated tasks can be ticked off. Starts itself once visible.
const AIConsole = () => {
    const [promptId, setPromptId] = useState(null);
    const [phase, setPhase] = useState('idle'); // idle | thinking | streaming | done
    const [shown, setShown] = useState(0);
    const [done, setDone] = useState({});
    const rootRef = useRef(null);
    const startedRef = useRef(false);

    const prompt = AI_PROMPTS.find(p => p.id === promptId);

    const run = useCallback((id) => {
        setPromptId(id);
        setDone({});
        setShown(0);
        setPhase(prefersReducedMotion() ? 'done' : 'thinking');
    }, []);

    // Auto-run the first prompt the first time the console scrolls into view.
    useEffect(() => {
        const el = rootRef.current;
        if (!el || !('IntersectionObserver' in window)) return undefined;
        const ob = new IntersectionObserver(([e]) => {
            if (e.isIntersecting && !startedRef.current) {
                startedRef.current = true;
                run(AI_PROMPTS[0].id);
                ob.disconnect();
            }
        }, { threshold: 0.45 });
        ob.observe(el);
        return () => ob.disconnect();
    }, [run]);

    useEffect(() => {
        if (phase !== 'thinking') return undefined;
        const t = setTimeout(() => setPhase('streaming'), THINK_MS);
        return () => clearTimeout(t);
    }, [phase, promptId]);

    useEffect(() => {
        if (phase !== 'streaming' || !prompt) return undefined;
        const total = prompt.answer.length;
        const iv = setInterval(() => setShown(s => Math.min(total, s + CHARS_PER_TICK)), TICK_MS);
        return () => clearInterval(iv);
    }, [phase, prompt]);

    useEffect(() => {
        if (phase === 'streaming' && prompt && shown >= prompt.answer.length) setPhase('done');
    }, [phase, prompt, shown]);

    const text = prompt ? (phase === 'done' ? prompt.answer : prompt.answer.slice(0, shown)) : '';
    const busy = phase === 'thinking' || phase === 'streaming';

    return (
        <div className="orw-console orw-glass" ref={rootRef} data-reveal>
            <div className="orw-console__head">
                <div className="orw-console__title"><span><Sparkles size={15} aria-hidden="true" /></span>{BRAND.ai}</div>
                <span className="orw-tag">Demo · sample workspace</span>
            </div>

            <div className="orw-console__prompts" role="group" aria-label="Try a prompt">
                {AI_PROMPTS.map(p => (
                    <button key={p.id} type="button" className="orw-prompt" aria-pressed={p.id === promptId}
                        onClick={() => run(p.id)}>
                        {p.label}
                    </button>
                ))}
            </div>

            <div className="orw-console__out" aria-live="polite" aria-busy={busy}>
                {!prompt && <p className="orw-console__thinking">Pick a prompt above to see {BRAND.ai} work.</p>}
                {prompt && (
                    <>
                        <div className="orw-console__q"><p>{prompt.question}</p></div>
                        <div className="orw-console__a">
                            <span aria-hidden="true"><Sparkles size={14} /></span>
                            <div>
                                {phase === 'thinking' ? (
                                    <span className="orw-console__thinking">
                                        <span className="orw-typing" style={{ padding: 0 }}><i><b /><b /><b /></i></span>
                                        Reading {prompt.sources[0]}…
                                    </span>
                                ) : (
                                    <p className="orw-console__text">
                                        {text}
                                        {phase === 'streaming' && <span className="orw-caret" aria-hidden="true" />}
                                    </p>
                                )}

                                {phase === 'done' && prompt.tasks && (
                                    <div className="orw-console__tasks" role="group" aria-label="Generated tasks">
                                        {prompt.tasks.map((t, i) => (
                                            <button key={t.label} type="button" role="checkbox" aria-checked={!!done[i]}
                                                className="orw-task" onClick={() => setDone(d => ({ ...d, [i]: !d[i] }))}>
                                                <span className="orw-task__box">{done[i] && <Check size={11} strokeWidth={3} />}</span>
                                                <span className="orw-task__label">{t.label}</span>
                                                <small>{t.who}</small>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {phase === 'done' && (
                                    <div className="orw-console__sources">
                                        {prompt.sources.map(s => (
                                            <span key={s} className="orw-tag"><FileText size={10} style={{ marginRight: 5 }} aria-hidden="true" />{s}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>

            <div className="orw-console__foot">
                <span>Answers cite the channels, threads and notes they came from.</span>
                <button type="button" className="orw-btn orw-btn--text" style={{ fontSize: 11 }}
                    onClick={() => run(promptId || AI_PROMPTS[0].id)} disabled={busy}>
                    <RotateCcw size={12} aria-hidden="true" /> Replay
                </button>
            </div>
        </div>
    );
};

export default AIConsole;
