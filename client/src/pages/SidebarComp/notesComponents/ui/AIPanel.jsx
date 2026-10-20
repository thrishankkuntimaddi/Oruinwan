import React, { useState } from 'react';
import { Sparkles, Loader2, FileText, ListTodo, Pen, Wand2, FileCode, ChevronRight, Copy, Check, SpellCheck, Scissors, PenLine, Send, CheckSquare } from 'lucide-react';
import { aiService, aiErrorMessage } from '../../../../services/aiService';
import SidePanelHead from './SidePanelHead';

const AI_ACTIONS = [
  { id: 'summarize', icon: FileText, label: 'Summarize note', desc: '3–5 bullet summary' },
  { id: 'extract', icon: ListTodo, label: 'Extract action items', desc: 'Tasks & next steps as a checklist' },
  { id: 'expand', icon: Wand2, label: 'Expand bullets', desc: 'Turn bullets into paragraphs' },
  { id: 'rewrite', icon: Pen, label: 'Rewrite professionally', desc: 'Polish tone and clarity' },
  { id: 'structure', icon: FileCode, label: 'Add structure', desc: 'Add headings and lists' },
  { id: 'proofread', icon: SpellCheck, label: 'Proofread', desc: 'Fix spelling and grammar' },
  { id: 'shorten', icon: Scissors, label: 'Shorten', desc: 'Half the length, same points' },
  { id: 'continue', icon: PenLine, label: 'Continue writing', desc: 'Add the next paragraphs' },
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
    <aside className="nt-side" aria-label="AI for this note">
      <SidePanelHead icon={Sparkles} title="Oruinwan AI" sub="Works on this note's text" onClose={onClose} />

      <div style={{ padding: '12px', borderBottom: '1px solid var(--border-subtle)', overflowY: 'auto', maxHeight: result ? '48%' : 'none', flex: result ? 'none' : 1 }}>
        <p className="gl-x-menu-label" style={{ margin: '0 0 4px' }}>Do something with this note</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {AI_ACTIONS.map(action => {
            const Icon = action.icon;
            const isLoading = loading === action.id;
            return (
              <button key={action.id} type="button" className="gl-item" onClick={() => run(action.id)} disabled={!!loading}
                style={{ width: '100%', margin: 0, gap: '10px', padding: '7px 8px', height: 'auto', opacity: loading && !isLoading ? 0.45 : 1 }}>
                <span className="gl-empty-mark" style={{ margin: 0, width: 28, height: 28 }}>
                  {isLoading ? <Loader2 size={13} className="cd-spin" /> : <Icon size={13} />}
                </span>
                <span style={{ minWidth: 0, textAlign: 'left' }}>
                  <span style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>{action.label}</span>
                  <span style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.3 }}>{action.desc}</span>
                </span>
              </button>
            );
          })}
        </div>
        <form onSubmit={e => { e.preventDefault(); if (custom.trim()) run('custom', custom.trim()); }} style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
          <input className="gl-input" value={custom} onChange={e => setCustom(e.target.value)} placeholder="Or say what to do, e.g. “make a FAQ”" aria-label="Ask AI to do something with this note" disabled={!!loading}
            style={{ flex: 1, minWidth: 0 }} />
          <button type="submit" className="gl-icon-btn" disabled={!custom.trim() || !!loading} title="Run" aria-label="Run"><Send size={13} /></button>
        </form>
      </div>

      {result && (
        <div style={{ flex: 1, padding: '12px', overflowY: 'auto', minHeight: 0 }}>
          <div className="gl-card" style={{ padding: '12px', marginBottom: '10px', borderColor: result.type === 'error' ? 'var(--state-danger)' : undefined }}>
            <pre style={{ fontSize: '12.5px', color: result.type === 'error' ? 'var(--state-danger)' : 'var(--text-primary)', whiteSpace: 'pre-wrap', fontFamily: 'var(--font)', lineHeight: 1.6, margin: 0 }}>{result.text}</pre>
          </div>
          {result.type !== 'error' && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button type="button" className="gl-btn gl-btn--primary gl-btn--sm" style={{ flex: 1 }} onClick={handleInsert}>
                <ChevronRight size={13} /> Insert into note
              </button>
              {result.type === 'extract' && workspaceId && (
                <button type="button" className="gl-btn gl-btn--sm" onClick={handleCreateTasks} disabled={creating || result.created != null}>
                  <CheckSquare size={13} /> {result.created != null ? `${result.created} tasks created` : creating ? 'Creating…' : 'Create tasks'}
                </button>
              )}
              <button type="button" className="gl-icon-btn" onClick={handleCopy} title={copied ? 'Copied' : 'Copy'} aria-label="Copy result"
                style={copied ? { color: 'var(--state-success)' } : undefined}>
                {copied ? <Check size={13} /> : <Copy size={13} />}
              </button>
            </div>
          )}
        </div>
      )}

      <p style={{ padding: '10px 16px', borderTop: '1px solid var(--border-subtle)', fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'center', margin: 0 }}>
        Results are suggestions. Nothing changes until you insert it.
      </p>
    </aside>
  );
};

export default AIPanel;
