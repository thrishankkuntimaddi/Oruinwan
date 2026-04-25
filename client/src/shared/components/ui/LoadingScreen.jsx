import React, { useState, useEffect } from 'react';

const BOOT_LINES = [
    { text: '> Initializing workspace OS...', style: 'code', hold: 0 },
    { text: '> Connecting intelligence layer...', style: 'code', hold: 180 },
    { text: '> All systems operational.', style: 'code', hold: 120 },
    { text: 'Hello. Welcome to Chttrix.', style: 'warm', hold: 400 },
];

const CHAR_SPEED = 22; 

function useTypewriter(text, active, speed = CHAR_SPEED) {
    const [displayed, setDisplayed] = useState('');
    const [done, setDone] = useState(false);

    useEffect(() => {
        if (!active) { setDisplayed(''); setDone(false); return; }
        let i = 0;
        setDisplayed('');
        setDone(false);
        const iv = setInterval(() => {
            i++;
            setDisplayed(text.slice(0, i));
            if (i >= text.length) { clearInterval(iv); setDone(true); }
        }, speed);
        return () => clearInterval(iv);
    }, [active, text, speed]);

    return { displayed, done };
}

function BootLine({ item, active, onDone }) {
    const { displayed, done } = useTypewriter(item.text, active, item.style === 'warm' ? 28 : CHAR_SPEED);

    useEffect(() => {
        if (done) {
            const t = setTimeout(onDone, item.hold || 120);
            return () => clearTimeout(t);
        }
    }, [done, item.hold, onDone]);

    if (!active && displayed === '') return null;

    const isCode = item.style === 'code';
    const isWarm = item.style === 'warm';

    return (
        <div style={{
            fontFamily: isCode ? '"JetBrains Mono", "Fira Code", "Courier New", monospace' : 'Inter, system-ui, sans-serif',
            fontSize: isWarm ? '28px' : '13px',
            fontWeight: isWarm ? 700 : 400,
            color: isCode ? 'rgba(184,149,106,0.7)' : '#e4e4e4',
            letterSpacing: isCode ? '0.01em' : '-0.02em',
            lineHeight: isWarm ? 1.3 : 1.8,
            marginTop: isWarm ? '32px' : '0',
            minHeight: isWarm ? '38px' : '24px',
        }}>
            {displayed}
            {active && !done && (
                <span style={{
                    display: 'inline-block',
                    width: isWarm ? '3px' : '7px',
                    height: isWarm ? '28px' : '13px',
                    background: isWarm ? '#e4e4e4' : 'rgba(184,149,106,0.9)',
                    marginLeft: '2px',
                    verticalAlign: isWarm ? 'middle' : 'text-bottom',
                    animation: 'cursorBlink 0.7s step-end infinite',
                }} />
            )}
        </div>
    );
}

const LoadingScreen = ({ onComplete }) => {
    const [phase, setPhase] = useState('boot'); 
    const [lineIndex, setLineIndex] = useState(0);
    const [opacity, setOpacity] = useState(1);
    const [brandVisible, setBrandVisible] = useState(false);

    
    const advance = () => {
        if (lineIndex < BOOT_LINES.length - 1) {
            setLineIndex(i => i + 1);
        } else {
            
            setTimeout(() => {
                setBrandVisible(true);
                
                setTimeout(() => {
                    setPhase('fade');
                    setOpacity(0);
                    setTimeout(() => {
                        if (onComplete) onComplete();
                    }, 700);
                }, 900);
            }, 300);
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'var(--bg-base)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'opacity 650ms cubic-bezier(0.4,0,0.2,1)',
            opacity,
            pointerEvents: phase === 'fade' ? 'none' : 'all',
        }}>
            <style>{`
                @keyframes cursorBlink {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0; }
                }
                @keyframes brandStamp {
                    from { opacity: 0; transform: scale(0.92) translateY(8px); }
                    to   { opacity: 1; transform: scale(1) translateY(0); }
                }
                @keyframes lineSlideIn {
                    from { opacity: 0; transform: translateY(6px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
            `}</style>

            {}
            <div style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%,-50%)', width: '600px', height: '400px', background: 'radial-gradient(ellipse, rgba(184,149,106,0.04) 0%, transparent 70%)', pointerEvents: 'none' }} />

            <div style={{ width: '520px', padding: '0 24px' }}>
                {}
                <div style={{
                    borderLeft: '2px solid rgba(184,149,106,0.25)',
                    paddingLeft: '20px',
                    marginBottom: '8px',
                }}>
                    {BOOT_LINES.map((line, i) => (
                        <div key={i} style={{ animation: i <= lineIndex ? 'lineSlideIn 200ms ease forwards' : 'none' }}>
                            {i <= lineIndex && (
                                <BootLine
                                    item={line}
                                    active={i === lineIndex}
                                    onDone={advance}
                                />
                            )}
                        </div>
                    ))}
                </div>

                {}
                {brandVisible && (
                    <div style={{
                        marginTop: '48px',
                        display: 'flex', alignItems: 'center', gap: '14px',
                        animation: 'brandStamp 500ms cubic-bezier(0.16,1,0.3,1) forwards',
                    }}>
                        <img src="/chttrix-logo.jpg" alt="Chttrix"
                            style={{ width: '40px', height: '40px', objectFit: 'cover' }} />
                        <div>
                            <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1 }}>
                                Chttrix
                            </div>
                            <div style={{ fontSize: '11px', color: 'rgba(184,149,106,0.7)', marginTop: '3px', fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                                Workspace OS · 2026
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LoadingScreen;
