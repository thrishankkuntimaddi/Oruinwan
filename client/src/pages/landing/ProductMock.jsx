import React, { useEffect, useRef, useState } from 'react';
import { Hash, Sparkles, Headphones, Lock, MessageSquareReply, Plus } from 'lucide-react';
import BRAND from '../../shared/brand';
import { MOCK_CHANNELS, PEOPLE } from './data';
import { prefersReducedMotion } from './hooks';

const CYCLE_MS = 6500;

const Avatar = ({ person, size = 28, className = 'orw-msg__av' }) => (
    <span className={className} style={{ width: size, height: size, background: person.color }} aria-hidden="true">
        {person.initials}
    </span>
);

// Renders `code` spans written with backticks in mock copy.
const withCode = (text) => text.split(/(`[^`]+`)/g).map((part, i) =>
    part.startsWith('`') ? <code key={i}>{part.slice(1, -1)}</code> : <React.Fragment key={i}>{part}</React.Fragment>);

const Message = ({ m, delay }) => {
    if (m.who === 'ai') {
        return (
            <div className="orw-msg orw-msg--ai" style={{ '--d': `${delay}ms` }}>
                <span className="orw-msg__av" style={{ background: 'linear-gradient(180deg,#ecd6b0,#c8a274)' }} aria-hidden="true"><Sparkles size={14} /></span>
                <div>
                    <div className="orw-msg__meta">{BRAND.ai} <time>{m.at}</time></div>
                    <div className="orw-msg__card">
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--o-accent-hi)', marginBottom: 6 }}>{m.title}</div>
                        <ul>{m.points.map(p => <li key={p}>{p}</li>)}</ul>
                    </div>
                </div>
            </div>
        );
    }
    if (m.who === 'huddle') {
        return (
            <div className="orw-v-huddle orw-msg" style={{ '--d': `${delay}ms`, display: 'flex' }}>
                <Headphones size={16} style={{ color: '#8fe0b8' }} aria-hidden="true" />
                <span style={{ color: 'var(--o-text)' }}>{m.text}</span>
                <span className="orw-v-wave" aria-hidden="true">
                    {[0, 1, 2, 3, 4].map(i => <i key={i} style={{ animationDelay: `${i * 0.12}s` }} />)}
                </span>
            </div>
        );
    }
    const p = PEOPLE[m.who];
    return (
        <div className="orw-msg" style={{ '--d': `${delay}ms` }}>
            <Avatar person={p} />
            <div>
                <div className="orw-msg__meta">{p.name} <time>{m.at}</time></div>
                <p className="orw-msg__text">{withCode(m.text)}</p>
                {m.thread && <span className="orw-msg__thread"><MessageSquareReply size={12} aria-hidden="true" /> {m.thread}</span>}
            </div>
        </div>
    );
};

const ChannelButton = ({ c, active, onSelect }) => (
    <button type="button" className={`orw-mock__item${active ? ' is-active' : ''}`}
        onClick={() => onSelect(c.id)} aria-pressed={active}>
        {c.kind === 'channel'
            ? <Hash size={13} aria-hidden="true" />
            : <Avatar person={PEOPLE[c.id]} size={18} className="orw-mock__avatar" />}
        <span>{c.name}</span>
        {c.unread && !active ? <span className="orw-mock__badge">{c.unread}</span> : null}
        {c.presence && <span className="orw-mock__presence" aria-label="online" />}
    </button>
);

// Interactive, self-contained preview of the app. Cycles through channels
// until the visitor interacts, then stays where they clicked.
const ProductMock = () => {
    const [activeId, setActiveId] = useState(MOCK_CHANNELS[0].id);
    const [auto, setAuto] = useState(() => !prefersReducedMotion());
    const [paused, setPaused] = useState(false);
    const rootRef = useRef(null);
    const [inView, setInView] = useState(true);

    useEffect(() => {
        const el = rootRef.current;
        if (!el || !('IntersectionObserver' in window)) return undefined;
        const ob = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.3 });
        ob.observe(el);
        return () => ob.disconnect();
    }, []);

    useEffect(() => {
        if (!auto || paused || !inView) return undefined;
        const t = setTimeout(() => {
            const i = MOCK_CHANNELS.findIndex(c => c.id === activeId);
            setActiveId(MOCK_CHANNELS[(i + 1) % MOCK_CHANNELS.length].id);
        }, CYCLE_MS);
        return () => clearTimeout(t);
    }, [activeId, auto, paused, inView]);

    const select = (id) => { setAuto(false); setActiveId(id); };
    const ch = MOCK_CHANNELS.find(c => c.id === activeId);
    const channels = MOCK_CHANNELS.filter(c => c.kind === 'channel');
    const dms = MOCK_CHANNELS.filter(c => c.kind === 'dm');

    return (
        <div className="orw-hero__stage" ref={rootRef}
            onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
            <div className="orw-mock orw-glass" role="group" aria-label={`${BRAND.name} app preview`}>
                <div className="orw-mock__bar">
                    <span className="orw-mock__lights" aria-hidden="true"><i /><i /><i /></span>
                    <span className="orw-mock__url">app.oruinwan.com</span>
                    <span style={{ width: 39 }} aria-hidden="true" />
                </div>

                <div className="orw-mock__switch" role="group" aria-label="Conversations">
                    {MOCK_CHANNELS.map(c => <ChannelButton key={c.id} c={c} active={c.id === activeId} onSelect={select} />)}
                </div>

                <div className="orw-mock__body">
                    <aside className="orw-mock__side" aria-label="Conversations">
                        <div className="orw-mock__ws"><b>N</b> Northwind</div>
                        <div className="orw-mock__label">Channels</div>
                        {channels.map(c => <ChannelButton key={c.id} c={c} active={c.id === activeId} onSelect={select} />)}
                        <span className="orw-mock__item" style={{ cursor: 'default' }} aria-hidden="true"><Plus size={13} /> Add channel</span>
                        <div className="orw-mock__label">Direct messages</div>
                        {dms.map(c => <ChannelButton key={c.id} c={c} active={c.id === activeId} onSelect={select} />)}
                        <span className="orw-mock__item" style={{ cursor: 'default' }} aria-hidden="true">
                            <Avatar person={PEOPLE.lena} size={18} className="orw-mock__avatar" /> Lena Ortiz
                        </span>
                    </aside>

                    <div className="orw-mock__main">
                        <div className="orw-mock__head">
                            <div>
                                <h4>{ch.kind === 'channel' ? <Hash size={14} aria-hidden="true" /> : <Lock size={13} aria-hidden="true" />}{ch.name}</h4>
                                <p>{ch.topic}</p>
                            </div>
                            <span className="orw-tag orw-tag--accent"><Sparkles size={11} style={{ marginRight: 5 }} aria-hidden="true" />AI</span>
                        </div>
                        <div className="orw-mock__stream" key={ch.id} aria-live="polite">
                            {ch.messages.map((m, i) => <Message key={i} m={m} delay={i * 260} />)}
                            <div className="orw-typing" style={{ '--d': `${ch.messages.length * 260 + 200}ms` }}>
                                <i aria-hidden="true"><b /><b /><b /></i>{ch.typing}
                            </div>
                        </div>
                        <div className="orw-mock__composer" aria-hidden="true">
                            <span>Message {ch.kind === 'channel' ? `#${ch.name}` : ch.name}</span>
                            <kbd>@ai</kbd><kbd>↵</kbd>
                        </div>
                    </div>
                </div>
            </div>

            <div className="orw-float orw-float--a orw-glass" aria-hidden="true">
                <span className="orw-float__icon"><Sparkles size={15} /></span>
                <span>Summary ready<small>23 messages → 3 points</small></span>
            </div>
            <div className="orw-float orw-float--b orw-glass" aria-hidden="true">
                <span className="orw-float__icon orw-float__icon--good"><Lock size={14} /></span>
                <span>End-to-end encrypted<small>X25519 · AES-GCM</small></span>
            </div>
            <p className="orw-mock__hint">Interactive preview. Click a channel to explore.</p>
        </div>
    );
};

export default ProductMock;
