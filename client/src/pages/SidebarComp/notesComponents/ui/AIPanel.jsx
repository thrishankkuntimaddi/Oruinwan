import React, { useState } from 'react';
import { X, Sparkles, FileText, ListTodo, Pen, Wand2, FileCode, ChevronRight, Copy, Check } from 'lucide-react';

// Dark-themed Monolith Flow AI action colors
const AI_ACTIONS = [
  { id: 'summarize', icon: FileText, label: 'Summarize Note', desc: 'Get a 3–5 bullet summary', iconColor: '#60a5fa', bg: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.2)' },
  { id: 'extract', icon: ListTodo, label: 'Extract Action Items', desc: 'Find all tasks & next steps', iconColor: '#34d399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.2)' },
  { id: 'expand', icon: Wand2, label: 'Expand Bullets', desc: 'Turn bullets into full paragraphs', iconColor: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.2)' },
  { id: 'rewrite', icon: Pen, label: 'Rewrite Professionally', desc: 'Polish tone and clarity', iconColor: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.2)' },
  { id: 'structure', icon: FileCode, label: 'Auto-Structure', desc: 'Add headings to organize content', iconColor: '#b8956a', bg: 'rgba(184,149,106,0.1)', border: 'rgba(184,149,106,0.2)' },
];

const AIPanel = ({ blocks, title, onInsertBlock, onClose }) => {
  const [loading, setLoading] = useState(null);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const extractText = () => blocks
    .filter(b => b.type === 'text' || b.type === 'heading')
    .map(b => b.content?.replace(/<[^>]*>/g, '') || '')
    .filter(Boolean).join('\n');

  const handleAction = async (actionId) => {
    const text = extractText();
    if (!text.trim()) {
      setResult({ type: 'error', text: 'No text content found in this note. Add some text blocks first.' });
      return;
    }
    setLoading(actionId);
    setResult(null);
    await new Promise(r => setTimeout(r, 1400));
    const wordCount = text.trim().split(/\s+/).length;
    const results = {
      summarize: `**Summary of "${title}"**\n\n• This note covers ${wordCount} words of content\n• Key themes detected in the document\n• Main ideas are organized and structured\n• Action items may be present\n• Connect real AI API (OpenAI/Gemini) to get live summaries`,
      extract: `**Action Items extracted from "${title}"**\n\n☐ Review the note content thoroughly\n☐ Identify key decisions needed\n☐ Assign owners to each item\n☐ Set deadlines for completion\n\n_Connect real AI API to extract actual items from your text_`,
      expand: `_Expansion of your bullet points:_\n\nYour note contains ${wordCount} words. When connected to a real AI model, each bullet point will be expanded into full paragraphs.\n\n_Connect real AI API (OpenAI/Gemini) to enable live expansion_`,
      rewrite: `_Professional rewrite ready:_\n\nYour content (${wordCount} words) has been analyzed. When connected to a real AI model, it will be rewritten with improved clarity and professional tone.\n\n_Connect real AI API to enable live rewriting_`,
      structure: `_Suggested structure for "${title}":_\n\n**H1: Introduction**\n**H2: Main Content**\n**H2: Key Points**\n**H2: Conclusion / Next Steps**\n\n_Connect real AI API to auto-apply headings to your note_`,
    };
    setLoading(null);
    setResult({ type: actionId, text: results[actionId] });
  };

  const handleInsert = () => {
    if (!result) return;
    onInsertBlock('callout', result.text, { variant: 'info' });
    setResult(null);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: '#111111', borderLeft: '1px solid rgba(255,255,255,0.07)',
      width: '288px', flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '28px', height: '28px', background: 'linear-gradient(135deg, #b8956a, #a07850)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Sparkles size={13} style={{ color: '#0c0c0c' }} />
          </div>
          <div>
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#e4e4e4', fontFamily: 'Inter, system-ui, sans-serif', marginBottom: '1px' }}>AI Assistant</h3>
            <p style={{ fontSize: '10px', color: 'rgba(228,228,228,0.35)', fontFamily: 'monospace' }}>Note intelligence</p>
          </div>
        </div>
        <button onClick={onClose}
          style={{ padding: '5px', background: 'transparent', border: 'none', color: 'rgba(228,228,228,0.35)', cursor: 'pointer', transition: 'all 150ms ease' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#e4e4e4'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(228,228,228,0.35)'; e.currentTarget.style.background = 'transparent'; }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Actions */}
      <div style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <p style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(228,228,228,0.3)', padding: '0 4px', marginBottom: '8px', fontFamily: 'monospace' }}>Actions</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {AI_ACTIONS.map(action => {
            const Icon = action.icon;
            const isLoading = loading === action.id;
            return (
              <button key={action.id} onClick={() => handleAction(action.id)} disabled={!!loading}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', textAlign: 'left', background: 'transparent', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading && !isLoading ? 0.4 : 1, transition: 'background 150ms ease' }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ width: '32px', height: '32px', background: action.bg, border: `1px solid ${action.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {isLoading
                    ? <div style={{ width: '14px', height: '14px', border: `2px solid ${action.iconColor}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    : <Icon size={14} style={{ color: action.iconColor }} />
                  }
                </div>
                <div>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: '#e4e4e4', lineHeight: 1.3, fontFamily: 'Inter, system-ui, sans-serif' }}>{action.label}</p>
                  <p style={{ fontSize: '10px', color: 'rgba(228,228,228,0.35)', lineHeight: 1.3 }}>{action.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Result area */}
      {result && (
        <div style={{ flex: 1, padding: '12px', overflowY: 'auto' }}>
          <div style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.08)', padding: '12px', marginBottom: '10px' }}>
            <pre style={{ fontSize: '11px', color: 'rgba(228,228,228,0.7)', whiteSpace: 'pre-wrap', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: 1.6 }}>{result.text}</pre>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleInsert}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', background: '#b8956a', border: 'none', color: '#0c0c0c', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}
            >
              <ChevronRight size={13} /> Insert into note
            </button>
            <button onClick={handleCopy}
              style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: copied ? '#34d399' : 'rgba(228,228,228,0.5)', cursor: 'pointer', transition: 'all 150ms ease' }}
              title="Copy to clipboard"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <p style={{ fontSize: '10px', color: 'rgba(228,228,228,0.25)', textAlign: 'center', fontFamily: 'monospace' }}>
          Powered by Chttrix AI · Connect API for live results
        </p>
      </div>
    </div>
  );
};

export default AIPanel;
