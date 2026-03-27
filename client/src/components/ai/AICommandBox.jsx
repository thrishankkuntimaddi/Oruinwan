// client/src/components/ai/AICommandBox.jsx
import React, { useState, useRef, useEffect } from 'react';

const EXAMPLES = [
    { icon: '✅', text: 'Create task for design review tomorrow' },
    { icon: '✨', text: 'Summarize this channel' },
    { icon: '📅', text: 'Schedule a meeting for Q2 planning' },
    { icon: '🔍', text: 'What are our coding standards?' },
];

async function apiCommand(command, workspaceId, token) {
    const res = await fetch('/api/ai/command', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body:    JSON.stringify({ command, workspaceId }),
    });
    if (!res.ok) throw new Error('Command failed');
    return res.json();
}

const INTENT_COLORS = {
    create_task:       { bg:'rgba(52,211,153,0.12)', border:'rgba(52,211,153,0.3)', color:'#34d399', icon:'✅' },
    generate_tasks:    { bg:'rgba(52,211,153,0.10)', border:'rgba(52,211,153,0.25)', color:'#6ee7b7', icon:'📋' },
    summarize_channel: { bg:'rgba(139,92,246,0.12)', border:'rgba(139,92,246,0.3)', color:'#a78bfa', icon:'✨' },
    schedule_meeting:  { bg:'rgba(96,165,250,0.12)', border:'rgba(96,165,250,0.3)', color:'#60a5fa', icon:'📅' },
    ask_question:      { bg:'rgba(251,191,36,0.10)', border:'rgba(251,191,36,0.25)', color:'#fbbf24', icon:'🧠' },
    unknown:           { bg:'rgba(100,116,139,0.12)', border:'rgba(100,116,139,0.25)', color:'#94a3b8', icon:'❓' },
};

export default function AICommandBox({ workspaceId, token, isOpen, onClose }) {
    const [command, setCommand] = useState('');
    const [result, setResult]   = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState(null);
    const inputRef = useRef(null);

    useEffect(() => { if (isOpen) { inputRef.current?.focus(); setCommand(''); setResult(null); setError(null); } }, [isOpen]);

    useEffect(() => {
        const handler = e => { if (e.key === 'Escape') onClose?.(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    const handleSubmit = async () => {
        if (!command.trim() || loading) return;
        setLoading(true); setError(null); setResult(null);
        try {
            const data = await apiCommand(command.trim(), workspaceId, token);
            setResult(data);
        } catch (e) { setError('Command execution failed. Please try again.'); }
        finally { setLoading(false); }
    };

    if (!isOpen) return null;

    const intent = result?.intent || 'unknown';
    const style = INTENT_COLORS[intent] || INTENT_COLORS.unknown;

    return (
        <div style={{
            position:'fixed', inset:0, zIndex:9001,
            background:'rgba(0,0,0,0.65)', backdropFilter:'blur(4px)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontFamily:'Inter, system-ui, sans-serif',
        }}
            onClick={e => e.target===e.currentTarget && onClose?.()}
        >
            <div style={{
                width:'100%', maxWidth:560,
                background:'var(--bg-secondary, #1e1b35)',
                border:'1px solid rgba(139,92,246,0.4)',
                borderRadius:14, boxShadow:'0 24px 80px rgba(0,0,0,0.6)',
                overflow:'hidden',
            }}>
                {/* Input Row */}
                <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 16px', borderBottom:result||loading||error?'1px solid rgba(139,92,246,0.15)':'none' }}>
                    <span style={{fontSize:20}}>⚡</span>
                    <input
                        ref={inputRef}
                        type="text" value={command}
                        onChange={e => { setCommand(e.target.value); setResult(null); setError(null); }}
                        onKeyDown={e => e.key==='Enter' && handleSubmit()}
                        placeholder="Type a command… (e.g. 'Create task for code review')"
                        style={{
                            flex:1, background:'none', border:'none', outline:'none',
                            color:'#f1f5f9', fontSize:15, fontFamily:'inherit',
                        }}
                    />
                    {loading && <div style={{ width:18, height:18, border:'2px solid rgba(139,92,246,0.3)', borderTopColor:'#8b5cf6', borderRadius:'50%', animation:'spin 0.8s linear infinite', flexShrink:0 }}/>}
                    <button onClick={handleSubmit} disabled={loading || !command.trim()} style={{
                        padding:'6px 14px', borderRadius:7,
                        background:'linear-gradient(135deg,#7c3aed,#6366f1)',
                        border:'none', color:'#fff', cursor:loading?'wait':'pointer',
                        fontSize:13, fontWeight:600, opacity:(!command.trim()||loading)?0.5:1,
                        fontFamily:'inherit', transition:'opacity 0.15s',
                    }}>Run</button>
                </div>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

                {/* Error */}
                {error && <div style={{ padding:'10px 16px', fontSize:13, color:'#f87171', background:'rgba(239,68,68,0.08)' }}>⚠️ {error}</div>}

                {/* Result */}
                {result && (
                    <div style={{ padding:16 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
                            <span style={{fontSize:16}}>{style.icon}</span>
                            <span style={{
                                fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em',
                                color:style.color, padding:'2px 8px',
                                background:style.bg, border:`1px solid ${style.border}`, borderRadius:4,
                            }}>{result.intent?.replace(/_/g,' ')}</span>
                        </div>
                        <p style={{ margin:0, fontSize:13, color:'#cbd5e1', lineHeight:1.6 }}>
                            {result.result?.message || 'Done!'}
                        </p>
                        {result.result?.task && (
                            <div style={{ marginTop:10, padding:'8px 12px', background:'rgba(52,211,153,0.08)', borderRadius:7, border:'1px solid rgba(52,211,153,0.2)' }}>
                                <span style={{fontSize:12, color:'#6ee7b7', fontWeight:600}}>Task: </span>
                                <span style={{fontSize:12, color:'#d1fae5'}}>{result.result.task.title}</span>
                            </div>
                        )}
                        {result.result?.tasks?.length > 0 && (
                            <ul style={{ margin:'10px 0 0 0', padding:0, listStyle:'none' }}>
                                {result.result.tasks.map((t,i) => (
                                    <li key={i} style={{ padding:'5px 0', fontSize:13, color:'#e2e8f0', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', gap:6 }}>
                                        <span style={{color:'#6ee7b7'}}>•</span>{t}
                                    </li>
                                ))}
                            </ul>
                        )}
                        {result.result?.suggested && (
                            <div style={{ marginTop:10, padding:'8px 12px', background:'rgba(96,165,250,0.08)', borderRadius:7, border:'1px solid rgba(96,165,250,0.2)' }}>
                                <div style={{fontSize:12, color:'#93c5fd', fontWeight:600, marginBottom:4}}>Suggested Time</div>
                                <div style={{fontSize:12, color:'#bfdbfe'}}>
                                    Start: {new Date(result.result.suggested.suggestedStart).toLocaleString()}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Examples */}
                {!result && !loading && !command && (
                    <div style={{ padding:'8px 16px 12px' }}>
                        <p style={{ margin:'0 0 8px 0', fontSize:11, color:'#475569', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>Quick commands</p>
                        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                            {EXAMPLES.map(ex => (
                                <button key={ex.text} onClick={() => { setCommand(ex.text); inputRef.current?.focus(); }} style={{
                                    display:'flex', alignItems:'center', gap:8,
                                    textAlign:'left', background:'rgba(255,255,255,0.04)',
                                    border:'1px solid rgba(255,255,255,0.08)', borderRadius:7,
                                    padding:'7px 10px', fontSize:12, color:'#94a3b8', cursor:'pointer',
                                    fontFamily:'inherit', transition:'background 0.1s',
                                }}
                                    onMouseEnter={e => e.currentTarget.style.background='rgba(139,92,246,0.1)'}
                                    onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.04)'}
                                >
                                    <span>{ex.icon}</span>{ex.text}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
