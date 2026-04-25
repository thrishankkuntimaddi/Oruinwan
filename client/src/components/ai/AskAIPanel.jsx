import React, { useState } from 'react';

async function apiPost(path, body, token) {
    const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Request failed');
    return res.json();
}

const Spinner = () => (
    <div style={{ display:'flex', justifyContent:'center', padding:16 }}>
        <div style={{
            width:22, height:22,
            border:'2px solid rgba(99,102,241,0.3)', borderTopColor:'#6366f1',
            borderRadius:'50%', animation:'spin 0.8s linear infinite',
        }}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
);

const RefBadge = ({ ref: r }) => (
    <span style={{
        display:'inline-block', margin:'2px 4px 2px 0',
        padding:'2px 8px', borderRadius:10, fontSize:11,
        background: r.type==='knowledge' ? 'rgba(52,211,153,0.12)' : 'rgba(96,165,250,0.12)',
        color: r.type==='knowledge' ? '#34d399' : '#60a5fa',
        border: `1px solid ${r.type==='knowledge' ? 'rgba(52,211,153,0.25)' : 'rgba(96,165,250,0.25)'}`,
    }}>
        {r.type==='knowledge' ? '📄' : '📅'} {r.title}
    </span>
);

export default function AskAIPanel({ workspaceId, token, onClose }) {
    const [tab, setTab]         = useState('ask');   
    const [question, setQ]      = useState('');
    const [answer, setAnswer]   = useState(null);
    const [references, setRefs] = useState([]);
    const [meetings, setMeetings] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState(null);

    const handleAsk = async () => {
        if (!question.trim()) return;
        setLoading(true); setError(null); setAnswer(null); setRefs([]); setMeetings([]);
        try {
            const endpoint = tab === 'ask' ? '/api/ai/ask' : '/api/ai/meetings/query';
            const field    = tab === 'ask' ? 'question' : 'question';
            const data = await apiPost(endpoint, { [field]: question, workspaceId }, token);
            if (tab === 'ask') {
                setAnswer(data.answer); setRefs(data.references || []);
            } else {
                setAnswer(data.answer); setMeetings(data.meetings || []);
            }
        } catch (e) { setError('AI service unavailable. Please try again.'); }
        finally { setLoading(false); }
    };

    const QUICK = ['What is the company leave policy?', 'Who is leading the Q2 project?', 'What was discussed in the last all-hands?'];

    const panelStyle = {
        position:'fixed', right:0, top:60, bottom:0, width:380, zIndex:500,
        background:'var(--bg-secondary, #1a1333)',
        borderLeft:'1px solid rgba(99,102,241,0.2)',
        display:'flex', flexDirection:'column',
        boxShadow:'-4px 0 24px rgba(0,0,0,0.35)',
        fontFamily:'Inter, system-ui, sans-serif',
    };

    return (
        <div style={panelStyle}>
            {}
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'14px 16px', borderBottom:'1px solid rgba(99,102,241,0.15)', background:'rgba(99,102,241,0.06)' }}>
                <span style={{fontSize:18}}>🧠</span>
                <h3 style={{margin:0, fontSize:15, fontWeight:700, color:'#e2e8f0', flex:1}}>Ask AI</h3>
                {onClose && <button onClick={onClose} style={{background:'none', border:'none', color:'#94a3b8', cursor:'pointer', fontSize:18}}>×</button>}
            </div>

            {}
            <div style={{ display:'flex', borderBottom:'1px solid rgba(99,102,241,0.1)' }}>
                {[['ask','💬 Ask Anything'],['meetings','📅 Past Meetings']].map(([t,l]) => (
                    <button key={t} onClick={() => { setTab(t); setAnswer(null); setRefs([]); setMeetings([]); }} style={{
                        flex:1, padding:'10px 0', border:'none', cursor:'pointer',
                        background: tab===t ? 'rgba(99,102,241,0.15)' : 'transparent',
                        color: tab===t ? '#818cf8' : '#64748b',
                        fontWeight: tab===t ? 600 : 400, fontSize:12,
                        borderBottom: tab===t ? '2px solid #6366f1' : '2px solid transparent',
                        fontFamily:'inherit', transition:'all 0.15s',
                    }}>{l}</button>
                ))}
            </div>

            {}
            <div style={{ flex:1, overflowY:'auto', padding:16, display:'flex', flexDirection:'column', gap:12 }}>
                {}
                {!answer && !loading && (
                    <div>
                        <p style={{margin:'0 0 8px 0', fontSize:12, color:'#64748b', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em'}}>Try asking</p>
                        <div style={{display:'flex', flexDirection:'column', gap:4}}>
                            {QUICK.map(q => (
                                <button key={q} onClick={() => setQ(q)} style={{
                                    textAlign:'left', background:'rgba(99,102,241,0.08)',
                                    border:'1px solid rgba(99,102,241,0.18)', borderRadius:7,
                                    padding:'7px 10px', fontSize:12, color:'#a5b4fc', cursor:'pointer',
                                    fontFamily:'inherit',
                                }}>{q}</button>
                            ))}
                        </div>
                    </div>
                )}

                {}
                {error && <div style={{ background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:8, padding:'10px 12px', fontSize:13, color:'#fca5a5' }}>⚠️ {error}</div>}

                {}
                {loading && <Spinner />}

                {}
                {answer && (
                    <div style={{ background:'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.08))', border:'1px solid rgba(99,102,241,0.25)', borderRadius:10, padding:'12px 14px' }}>
                        <p style={{margin:'0 0 6px 0', fontSize:11, fontWeight:700, color:'#818cf8', textTransform:'uppercase', letterSpacing:'0.05em'}}>🧠 AI Answer</p>
                        <p style={{margin:0, fontSize:13, lineHeight:1.65, color:'#e2e8f0'}}>{answer}</p>
                        {references.length > 0 && (
                            <div style={{marginTop:10}}>
                                <p style={{margin:'0 0 4px 0', fontSize:11, color:'#64748b', fontWeight:600}}>Sources</p>
                                {references.map((r,i) => <RefBadge key={i} ref={r} />)}
                            </div>
                        )}
                    </div>
                )}

                {}
                {meetings.length > 0 && (
                    <div>
                        <p style={{margin:'0 0 6px 0', fontSize:12, color:'#64748b', fontWeight:600}}>Relevant Meetings</p>
                        {meetings.map(m => (
                            <div key={m._id} style={{
                                background:'rgba(96,165,250,0.08)', border:'1px solid rgba(96,165,250,0.2)',
                                borderRadius:8, padding:'10px 12px', marginBottom:6,
                            }}>
                                <div style={{fontSize:13, fontWeight:600, color:'#93c5fd', marginBottom:2}}>{m.title}</div>
                                <div style={{fontSize:11, color:'#64748b', marginBottom:4}}>
                                    {m.startTime ? new Date(m.startTime).toLocaleDateString() : 'N/A'} · {m.status}
                                </div>
                                {m.summary && <p style={{margin:0, fontSize:12, color:'#cbd5e1', lineHeight:1.5}}>{m.summary.substring(0,200)}{m.summary.length>200?'…':''}</p>}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {}
            <div style={{ padding:'12px 16px', borderTop:'1px solid rgba(99,102,241,0.15)', background:'rgba(99,102,241,0.04)' }}>
                <div style={{ display:'flex', gap:8 }}>
                    <input
                        type="text"
                        value={question}
                        onChange={e => setQ(e.target.value)}
                        onKeyDown={e => e.key==='Enter' && handleAsk()}
                        placeholder={tab==='ask' ? 'Ask anything about your workspace…' : 'Query past meetings…'}
                        style={{
                            flex:1, background:'rgba(255,255,255,0.06)',
                            border:'1px solid rgba(99,102,241,0.25)', borderRadius:8,
                            color:'#f1f5f9', fontSize:13, padding:'8px 12px',
                            outline:'none', fontFamily:'inherit',
                        }}
                    />
                    <button onClick={handleAsk} disabled={loading || !question.trim()} style={{
                        padding:'0 16px', borderRadius:8,
                        background:'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        border:'none', color:'#fff', cursor: loading ? 'wait' : 'pointer',
                        fontSize:18, opacity: (!question.trim()||loading) ? 0.5 : 1,
                        transition:'opacity 0.15s',
                    }}>→</button>
                </div>
            </div>
        </div>
    );
}
