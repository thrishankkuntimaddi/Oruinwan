import React, { useEffect, useRef, useState } from 'react';
import { Check, X, Zap, Bell, ListChecks, Headphones, MessageSquareReply } from 'lucide-react';
import { PLATFORM_TABS, PEOPLE } from './data';
import { prefersReducedMotion } from './hooks';

const ROTATE_MS = 7000;

const ThreadVisual = () => (
    <div className="orw-v-thread">
        <div className="orw-v-row"><b>#launch</b> Maya: Release branch is cut. QA by 3pm.</div>
        <div className="orw-v-row orw-v-row--indent"><MessageSquareReply size={13} style={{ color: 'var(--o-cool)' }} /> <b>Arjun</b> Dry-run passed on staging ✅</div>
        <div className="orw-v-row orw-v-row--indent"><MessageSquareReply size={13} style={{ color: 'var(--o-cool)' }} /> <b>Lena</b> Copy review pending on pricing</div>
        <div className="orw-v-row"><b>#design</b> Sam reacted 🔥 to “Onboarding v3”</div>
        <div className="orw-v-huddle">
            <Headphones size={16} style={{ color: '#8fe0b8' }} />
            <span><b style={{ color: 'var(--o-text)' }}>Huddle in #launch</b><br /><span style={{ color: 'var(--o-text-3)' }}>Maya, Arjun +1</span></span>
            <span className="orw-v-wave">{[0, 1, 2, 3, 4, 5].map(i => <i key={i} style={{ animationDelay: `${i * 0.1}s` }} />)}</span>
        </div>
    </div>
);

const KanbanVisual = () => {
    const cols = [
        { t: 'To do', cards: [{ x: 'Pricing page copy', who: 'lena', w: '10%' }, { x: 'Launch post draft', who: 'sam', w: '0%' }] },
        { t: 'In progress', cards: [{ x: 'Rollback runbook', who: 'arjun', w: '55%' }, { x: 'Onboarding v3 specs', who: 'lena', w: '70%' }] },
        { t: 'Done', cards: [{ x: 'Cut release branch', who: 'maya', w: '100%' }] },
    ];
    return (
        <div className="orw-v-kanban">
            {cols.map(c => (
                <div className="orw-v-col" key={c.t}>
                    <h5>{c.t}<span>{c.cards.length}</span></h5>
                    {c.cards.map(k => (
                        <div className="orw-v-card" key={k.x}>
                            {k.x}
                            <i style={{ '--w': k.w }} />
                            <small>
                                <span>{PEOPLE[k.who].name.split(' ')[0]}</span>
                                <span style={{ width: 14, height: 14, background: PEOPLE[k.who].color, display: 'inline-block' }} />
                            </small>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
};

const FlowVisual = () => (
    <div className="orw-v-flow">
        <div className="orw-v-node"><span><Zap size={14} /></span><div>When a message in <b>#support</b> contains “urgent”<small>Trigger</small></div></div>
        <div className="orw-v-link" />
        <div className="orw-v-node"><span><ListChecks size={14} /></span><div>Create a task on the <b>Support</b> board<small>Action · assign to on-call</small></div></div>
        <div className="orw-v-link" />
        <div className="orw-v-node"><span><Bell size={14} /></span><div>Notify <b>@oncall</b> and post in thread<small>Action</small></div></div>
    </div>
);

const MatrixVisual = () => {
    const rows = [
        ['Manage billing', 1, 0, 0, 0],
        ['Create channels', 1, 1, 1, 1],
        ['Manage departments', 1, 1, 0, 0],
        ['View audit log', 1, 1, 0, 0],
        ['Invite members', 1, 1, 1, 0],
    ];
    return (
        <>
            <table className="orw-v-matrix">
                <thead><tr><th scope="col">Permission</th><th scope="col">Owner</th><th scope="col">Admin</th><th scope="col">Manager</th><th scope="col">Member</th></tr></thead>
                <tbody>
                    {rows.map(([label, ...vals]) => (
                        <tr key={label}>
                            <td>{label}</td>
                            {vals.map((v, i) => (
                                <td key={i}>{v
                                    ? <Check size={14} className="orw-v-yes" aria-label="allowed" />
                                    : <X size={14} className="orw-v-no" aria-label="not allowed" />}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
            <div className="orw-v-log" aria-hidden="true">
                <div><b>09:12</b> admin.role.updated · Lena → Manager</div>
                <div><b>09:14</b> channel.private.created · #finance</div>
            </div>
        </>
    );
};

const VISUALS = { thread: ThreadVisual, kanban: KanbanVisual, flow: FlowVisual, matrix: MatrixVisual };

// Accessible tablist (arrow keys, Home/End) that auto-advances while visible
// until the visitor picks a tab.
const PlatformTabs = () => {
    const [index, setIndex] = useState(0);
    const [auto, setAuto] = useState(() => !prefersReducedMotion());
    const [hover, setHover] = useState(false);
    const [inView, setInView] = useState(false);
    const rootRef = useRef(null);
    const tabRefs = useRef([]);

    useEffect(() => {
        const el = rootRef.current;
        if (!el || !('IntersectionObserver' in window)) return undefined;
        const ob = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 });
        ob.observe(el);
        return () => ob.disconnect();
    }, []);

    const running = auto && !hover && inView;
    useEffect(() => {
        if (!running) return undefined;
        const t = setTimeout(() => setIndex(i => (i + 1) % PLATFORM_TABS.length), ROTATE_MS);
        return () => clearTimeout(t);
    }, [index, running]);

    const pick = (i, focus = false) => {
        setAuto(false);
        setIndex(i);
        if (focus) tabRefs.current[i]?.focus();
    };

    const onKeyDown = (e) => {
        const n = PLATFORM_TABS.length;
        const map = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
        if (e.key in map) { e.preventDefault(); pick((index + map[e.key] + n) % n, true); }
        else if (e.key === 'Home') { e.preventDefault(); pick(0, true); }
        else if (e.key === 'End') { e.preventDefault(); pick(n - 1, true); }
    };

    const tab = PLATFORM_TABS[index];
    const Visual = VISUALS[tab.visual];

    return (
        <div className="orw-tabs" ref={rootRef} data-reveal
            onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
            <div className="orw-tabs__list" role="tablist" aria-label="Platform areas" aria-orientation="vertical" onKeyDown={onKeyDown}>
                {PLATFORM_TABS.map((t, i) => {
                    const Icon = t.icon;
                    const selected = i === index;
                    return (
                        <button key={t.id} ref={el => { tabRefs.current[i] = el; }}
                            type="button" role="tab" id={`orw-tab-${t.id}`} aria-selected={selected}
                            aria-controls={`orw-panel-${t.id}`} tabIndex={selected ? 0 : -1}
                            className="orw-tab" onClick={() => pick(i)}>
                            <span className="orw-tab__icon"><Icon size={17} aria-hidden="true" /></span>
                            <span>
                                <span className="orw-tab__title">{t.title}</span>
                                <span className="orw-tab__desc" style={{ display: 'block' }}>{t.blurb}</span>
                            </span>
                            <span key={`${index}-${running}`} className={`orw-tab__bar${selected && running ? ' is-running' : ''}`}
                                style={{ '--t': `${ROTATE_MS}ms` }} aria-hidden="true" />
                        </button>
                    );
                })}
            </div>

            <div className="orw-panel" key={tab.id} role="tabpanel" id={`orw-panel-${tab.id}`} aria-labelledby={`orw-tab-${tab.id}`}>
                <div>
                    <h3>{tab.heading}</h3>
                    <p>{tab.body}</p>
                    <ul className="orw-panel__list">
                        {tab.points.map(p => <li key={p}><Check size={15} aria-hidden="true" />{p}</li>)}
                    </ul>
                </div>
                <div className="orw-panel__visual orw-glass" aria-hidden="true">
                    <Visual />
                </div>
            </div>
        </div>
    );
};

export default PlatformTabs;
