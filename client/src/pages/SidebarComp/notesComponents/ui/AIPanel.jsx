import React, { useState } from 'react';
import { X, Sparkles, FileText, ListTodo, Pen, Wand2, FileCode, ChevronRight, Copy, Check, SpellCheck, Scissors, PenLine, Send, CheckSquare } from 'lucide-react';
import { aiService, aiErrorMessage } from '../../../../services/aiService';

const AI_ACTIONS = [
  { id: 'summarize', icon: FileText, label: 'Summarize note', desc: '3–5 bullet summary', iconColor: '#60a5fa' },
  { id: 'extract', icon: ListTodo, label: 'Extract action items', desc: 'Tasks & next steps as a checklist', iconColor: '#34d399' },
  { id: 'expand', icon: Wand2, label: 'Expand bullets', desc: 'Turn bullets into paragraphs', iconColor: '#a78bfa' },
  { id: 'rewrite', icon: Pen, label: 'Rewrite professionally', desc: 'Polish tone and clarity', iconColor: '#f87171' },
  { id: 'structure', icon: FileCode, label: 'Auto-structure', desc: 'Add headings and lists', iconColor: '#b8956a' },
  { id: 'proofread', icon: SpellCheck, label: 'Proofread', desc: 'Fix spelling and grammar', iconColor: '#fbbf24' },
  { id: 'shorten', icon: Scissors, label: 'Shorten', desc: 'Half the length, same points', iconColor: '#38bdf8' },
  { id: 'continue', icon: PenLine, label: 'Continue writing', desc: 'Add the next paragraphs', iconColor: '#c084fc' },
];

/** Note-level AI: runs on the note's text, results insert as a block or replace nothing until you choose. */
const AIPanel = ({ blocks, title, workspaceId, onInsertBlock, onClose }) => {
  const [loading, setLoading] = useState(null);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [custom, setCustom] = useState('');
  const [creating, setCreating] = useState(false);

  const extractText = () => (blocks || [])
    .filter(b => ['text', 'heading', 'quote', 'callout', 'code', 'list', 'todo', 'bullet', 'numbered'].includes(b.type) || typeof b.content === 'string')
    .map(b => String(b.content || '').replace(/<[^>]*>/g, ''))
    .filter(Boolean).join('\n');

  const run = async (actionId, instruction) => {
    const text = extractText();
    if (!text.trim()) {
      setResult({ type: 'error', text: 'No text content found in this note. Add some text blocks first.' });
      return;
    }
    setLoading(actionId);
    setResult(null);
    try {
      const r = await aiService.noteAssist({ workspaceId, action: actionId, text, title, instruction });
      setResult({ type: actionId, text: r.text });
    } catch (err) {
      setResult({ type: 'error', text: aiErrorMessage(err) });
    } finally {
      setLoading(null);
    }
  };

  const handleInsert = () => {
    if (!result || result.type === 'error') return;
    onInsertBlock('text', result.text, {});
    setResult(null);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateTasks = async () => {
    if (!result || !workspaceId) return;
    setCreating(true);
    try {
      const r = await aiService.extractTasks({ workspaceId, text: result.text, create: true });
      setResult(prev => ({ ...prev, created: r.created?.length || 0 }));
    } catch (err) {
      setResult(prev => ({ ...prev, text: `${prev.text}\n\n${aiErrorMessage(err, 'Could not create tasks')}` }));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-surface)', borderLeft: '1px solid var(--border-subtle)', width: '300px', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '28px', height: '28px', background: 'var(--bg-active)', border: '1px solid var(--border-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Sparkles size={13} style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font)', margin: 0 }}>Oruinwan AI</h3>
            <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: 0 }}>Works on this note</p>
          </div>
        </div>
        <button onClick={onClose} style={{ padding: '5px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={14} /></button>
      </div>

      <div style={{ padding: '12px', borderBottom: '1px solid var(--border-subtle)', overflowY: 'auto', maxHeight: '48%' }}>
        <p style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', padding: '0 4px', marginBottom: '8px' }}>Actions</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {AI_ACTIONS.map(action => {
            const Icon = action.icon;
            const isLoading = loading === action.id;
            return (
              <button key={action.id} onClick={() => run(action.id)} disabled={!!loading}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 8px', textAlign: 'left', background: 'transparent', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading && !isLoading ? 0.4 : 1, borderRadius: '2px' }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div style={{ width: '28px', height: '28px', background: 'var(--bg-active)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {isLoading
                    ? <div style={{ width: '12px', height: '12px', border: `2px solid ${action.iconColor}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    : <Icon size={13} style={{ color: action.iconColor }} />}
                </div>
                <div>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3, margin: 0, fontFamily: 'var(--font)' }}>{action.label}</p>
                  <p style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.3, margin: 0 }}>{action.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
        <form onSubmit={e => { e.preventDefault(); if (custom.trim()) run('custom', custom.trim()); }} style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
          <input value={custom} onChange={e => setCustom(e.target.value)} placeholder="Or tell AI what to do with this note…" disabled={!!loading}
            style={{ flex: 1, padding: '6px 8px', fontSize: '12px', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '2px', color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font)' }} />
          <button type="submit" disabled={!custom.trim() || !!loading} title="Run" style={{ padding: '6px 8px', background: 'var(--bg-active)', border: '1px solid var(--border-accent)', color: 'var(--accent)', cursor: 'pointer', display: 'flex' }}><Send size={12} /></button>
        </form>
      </div>

      {result && (
        <div style={{ flex: 1, padding: '12px', overflowY: 'auto', minHeight: 0 }}>
          <div style={{ background: 'var(--bg-hover)', border: `1px solid ${result.type === 'error' ? 'var(--state-danger)' : 'var(--border-default)'}`, padding: '12px', marginBottom: '10px' }}>
            <pre style={{ fontSize: '12px', color: result.type === 'error' ? 'var(--state-danger)' : 'var(--text-secondary)', whiteSpace: 'pre-wrap', fontFamily: 'var(--font)', lineHeight: 1.6, margin: 0 }}>{result.text}</pre>
          </div>
          {result.type !== 'error' && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button onClick={handleInsert} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', background: 'var(--accent)', border: 'none', color: '#0c0c0c', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                <ChevronRight size={13} /> Insert into note
              </button>
              {result.type === 'extract' && workspaceId && (
                <button onClick={handleCreateTasks} disabled={creating || result.created != null} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 10px', background: 'var(--bg-active)', border: '1px solid var(--border-accent)', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                  <CheckSquare size={13} /> {result.created != null ? `${result.created} created` : creating ? 'Creating…' : 'Create tasks'}
                </button>
              )}
              <button onClick={handleCopy} style={{ padding: '8px 10px', background: 'var(--bg-active)', border: '1px solid var(--border-default)', color: copied ? 'var(--state-success)' : 'var(--text-muted)', cursor: 'pointer' }} title="Copy">
                {copied ? <Check size={13} /> : <Copy size={13} />}
              </button>
            </div>
          )}
        </div>
      )}

      <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-subtle)' }}>
        <p style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>Results are suggestions — review before inserting.</p>
      </div>
    </div>
  );
};

export default AIPanel;
