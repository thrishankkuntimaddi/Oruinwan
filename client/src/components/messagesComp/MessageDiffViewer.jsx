import React, { useState, useEffect } from 'react';
import api from '@services/api';
import { X, History } from 'lucide-react';

const FONT = 'Inter, system-ui, -apple-system, sans-serif';

function simpleDiff(oldText = '', newText = '') {
  const oldWords = oldText.split(/\s+/).filter(Boolean);
  const newWords = newText.split(/\s+/).filter(Boolean);
  const result = [];

  
  let i = 0, j = 0;
  while (i < oldWords.length || j < newWords.length) {
    if (i >= oldWords.length) {
      result.push({ text: newWords[j], type: 'added' }); j++;
    } else if (j >= newWords.length) {
      result.push({ text: oldWords[i], type: 'removed' }); i++;
    } else if (oldWords[i] === newWords[j]) {
      result.push({ text: oldWords[i], type: 'same' }); i++; j++;
    } else {
      result.push({ text: oldWords[i], type: 'removed' }); i++;
      result.push({ text: newWords[j], type: 'added' }); j++;
    }
  }
  return result;
}

export default function MessageDiffViewer({ messageId, currentText, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState(null);

  useEffect(() => {
    if (!messageId) return;
    api.get(`/api/v2/messages/${messageId}/diff`)
      .then(res => {
        setHistory(res.data?.editHistory || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [messageId]);

  const versionsToShow = [...history, { version: (history.length || 0) + 1, text: currentText, isCurrent: true }];
  const sel = selectedVersion ?? versionsToShow.length - 1; 

  const diffWords = sel > 0 && versionsToShow[sel - 1]?.text && versionsToShow[sel]?.text
    ? simpleDiff(versionsToShow[sel - 1].text, versionsToShow[sel].text)
    : versionsToShow[sel]?.text?.split(/\s+/).map(w => ({ text: w, type: 'same' })) || [];

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        backgroundColor: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1200, fontFamily: FONT,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-accent)',
        borderRadius: '2px',
        width: '90vw', maxWidth: '560px',
        maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.55)',
      }}>
        {}
        <div style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <h3 style={{
            margin: 0, fontSize: '14px', fontWeight: 600,
            color: 'var(--text-primary)',
            display: 'flex', alignItems: 'center', gap: '8px', fontFamily: FONT,
          }}>
            <History size={16} style={{ color: 'var(--accent)' }} />
            Edit History
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', outline: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', display: 'flex', padding: '4px',
              borderRadius: '2px', transition: '100ms ease',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--state-danger)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div style={{
            textAlign: 'center', padding: '40px 16px',
            color: 'var(--text-muted)', fontSize: '13px', fontFamily: FONT,
          }}>
            Loading history…
          </div>
        ) : (
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            {}
            <div style={{
              width: '140px', flexShrink: 0,
              borderRight: '1px solid var(--border-default)',
              overflowY: 'auto', padding: '6px 0',
            }}>
              {versionsToShow.map((v, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedVersion(idx)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '9px 14px',
                    backgroundColor: sel === idx ? 'rgba(184,149,106,0.10)' : 'transparent',
                    border: 'none', outline: 'none',
                    borderLeft: `2px solid ${sel === idx ? 'var(--accent)' : 'transparent'}`,
                    color: v.isCurrent ? 'var(--accent)' : sel === idx ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontSize: '12px', fontWeight: v.isCurrent ? 600 : 400,
                    cursor: 'pointer', transition: '100ms ease', fontFamily: FONT,
                  }}
                  onMouseEnter={e => { if (sel !== idx) e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
                  onMouseLeave={e => { if (sel !== idx) e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  {v.isCurrent ? '✎ Current' : `Version ${v.version}`}
                  {v.editedAt && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '10px', marginTop: '2px', fontFamily: FONT }}>
                      {new Date(v.editedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </div>
                  )}
                </button>
              ))}
            </div>

            {}
            <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>
              {versionsToShow[sel]?.isEncrypted ? (
                <p style={{
                  color: 'var(--text-muted)', fontStyle: 'italic',
                  fontSize: '13px', margin: 0, fontFamily: FONT,
                }}>
                  🔒 This version was encrypted and cannot be previewed.
                </p>
              ) : (
                <p style={{ margin: 0, lineHeight: 1.7, color: 'var(--text-primary)', fontSize: '13px', fontFamily: FONT }}>
                  {diffWords.map((token, i) => (
                    <span key={i} style={{
                      backgroundColor:
                        token.type === 'added' ? 'rgba(100,180,120,0.20)' :
                          token.type === 'removed' ? 'rgba(224,82,82,0.20)' : 'transparent',
                      color:
                        token.type === 'added' ? '#7ecf96' :
                          token.type === 'removed' ? 'var(--state-danger)' : 'inherit',
                      textDecoration: token.type === 'removed' ? 'line-through' : 'none',
                      marginRight: '0.25em',
                      borderRadius: '2px',
                      padding: token.type !== 'same' ? '0 2px' : '0',
                    }}>
                      {token.text}
                    </span>
                  ))}
                </p>
              )}
              {sel > 0 && (
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '14px', fontFamily: FONT }}>
                  Comparing version {versionsToShow[sel - 1].version} → {versionsToShow[sel].isCurrent ? 'current' : `version ${versionsToShow[sel].version}`}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
