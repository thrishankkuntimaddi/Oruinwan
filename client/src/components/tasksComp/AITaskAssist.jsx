import React, { useState } from 'react';
import { Sparkles, Loader2, Check, Copy, ArrowDownToLine } from 'lucide-react';
import { aiService, aiErrorMessage } from '../../services/aiService';
import { statusLabel, priorityLabel } from '../../utils/taskMeta';

const ACTIONS = [
  { id: 'describe', label: 'Write description' },
  { id: 'subtasks', label: 'Suggest subtasks' },
  { id: 'acceptance', label: 'Acceptance criteria' },
  { id: 'estimate', label: 'Estimate effort' },
];

/**
 * AI helpers inside a task: description, subtasks, acceptance criteria,
 * estimate. `onApplyDescription(text)` saves text as the task description.
 */
export default function AITaskAssist({ task, workspaceId, onApplyDescription }) {
  const [loading, setLoading] = useState(null);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const run = async (action) => {
    setLoading(action);
    setResult(null);
    try {
      const r = await aiService.taskAssist({
        workspaceId, action,
        task: { title: task.title, description: task.description, status: statusLabel(task.status), priority: priorityLabel(task.priority), dueDate: task.dueDate, subtasks: (task.subtasks || []).map(s => s.title || s) },
      });
      setResult({ action, text: r.text });
    } catch (err) {
      setResult({ action, text: aiErrorMessage(err), error: true });
    } finally {
      setLoading(null);
    }
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(result.text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };

  const chip = (active) => ({
    padding: '3px 9px', fontSize: '11px', fontWeight: 600, borderRadius: '2px', cursor: loading ? 'wait' : 'pointer',
    background: active ? 'var(--accent-dim)' : 'var(--bg-active)', border: `1px solid ${active ? 'var(--accent)' : 'var(--border-default)'}`,
    color: active ? 'var(--accent)' : 'var(--text-secondary)', fontFamily: 'var(--font)', display: 'inline-flex', alignItems: 'center', gap: '4px',
  });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <Sparkles size={12} style={{ color: 'var(--accent)' }} />
        {ACTIONS.map(a => (
          <button key={a.id} disabled={!!loading} onClick={() => run(a.id)} style={chip(loading === a.id)}>
            {loading === a.id && <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} />}{a.label}
          </button>
        ))}
      </div>
      {result && (
        <div style={{ marginTop: '8px', background: 'var(--bg-surface)', border: `1px solid ${result.error ? 'var(--state-danger)' : 'var(--border-default)'}`, padding: '10px', borderRadius: '2px' }}>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '12px', lineHeight: 1.6, color: result.error ? 'var(--state-danger)' : 'var(--text-secondary)', fontFamily: 'var(--font)' }}>{result.text}</pre>
          {!result.error && (
            <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
              {onApplyDescription && (
                <button onClick={() => { onApplyDescription(result.action === 'describe' ? result.text : `${task.description ? `${task.description}\n\n` : ''}${result.text}`); setResult(null); }}
                  style={{ ...chip(true), cursor: 'pointer' }}>
                  <ArrowDownToLine size={11} /> {result.action === 'describe' ? 'Use as description' : 'Append to description'}
                </button>
              )}
              <button onClick={copy} style={chip(false)}>{copied ? <Check size={11} /> : <Copy size={11} />} {copied ? 'Copied' : 'Copy'}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
