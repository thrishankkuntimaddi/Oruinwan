// client/src/components/messagesComp/MessageDiffViewer.jsx
// Phase-8: Modal showing edit history with diff highlighting
import React, { useState, useEffect } from 'react';
import api from '../../services/api';

const API = import.meta.env.VITE_API_URL || '';

/**
 * Simple word-level diff between two strings.
 * Returns array of { text, type: 'same' | 'added' | 'removed' }
 */
function simpleDiff(oldText = '', newText = '') {
  const oldWords = oldText.split(/\s+/).filter(Boolean);
  const newWords = newText.split(/\s+/).filter(Boolean);
  const result = [];

  // Naive LCS-based diff — good enough for message edits
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
  const sel = selectedVersion ?? versionsToShow.length - 1; // default to latest

  const diffWords = sel > 0 && versionsToShow[sel - 1]?.text && versionsToShow[sel]?.text
    ? simpleDiff(versionsToShow[sel - 1].text, versionsToShow[sel].text)
    : versionsToShow[sel]?.text?.split(/\s+/).map(w => ({ text: w, type: 'same' })) || [];

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200,
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: '#1e2124', borderRadius: 12, width: '90vw', maxWidth: 560,
        maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        border: '1px solid #2d3035', fontFamily: 'Inter, sans-serif',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px', borderBottom: '1px solid #2d3035',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#fff' }}>
            Edit History
          </h3>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#a0a5b0',
            cursor: 'pointer', fontSize: 20,
          }}>✕</button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#a0a5b0' }}>Loading history…</div>
        ) : (
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            {/* Version sidebar */}
            <div style={{
              width: 140, borderRight: '1px solid #2d3035',
              overflowY: 'auto', padding: '8px 0',
            }}>
              {versionsToShow.map((v, idx) => (
                <button key={idx} onClick={() => setSelectedVersion(idx)} style={{
                  width: '100%', textAlign: 'left', padding: '10px 16px',
                  background: sel === idx ? '#5865f220' : 'none',
                  border: 'none', borderLeft: sel === idx ? '3px solid #5865f2' : '3px solid transparent',
                  color: v.isCurrent ? '#5865f2' : '#d1d5db',
                  fontSize: 12, cursor: 'pointer',
                }}>
                  {v.isCurrent ? '✎ Current' : `Version ${v.version}`}
                  {v.editedAt && (
                    <div style={{ color: '#6b7280', fontSize: 10, marginTop: 2 }}>
                      {new Date(v.editedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* Diff view */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              {versionsToShow[sel]?.isEncrypted ? (
                <p style={{ color: '#a0a5b0', fontStyle: 'italic' }}>
                  🔒 This version was encrypted and cannot be previewed.
                </p>
              ) : (
                <p style={{ margin: 0, lineHeight: 1.7, color: '#e5e7eb', fontSize: 14 }}>
                  {diffWords.map((token, i) => (
                    <span key={i} style={{
                      background:
                        token.type === 'added' ? 'rgba(34,197,94,0.25)' :
                          token.type === 'removed' ? 'rgba(239,68,68,0.25)' : 'transparent',
                      color:
                        token.type === 'added' ? '#86efac' :
                          token.type === 'removed' ? '#fca5a5' : 'inherit',
                      textDecoration: token.type === 'removed' ? 'line-through' : 'none',
                      marginRight: '0.25em',
                    }}>
                      {token.text}
                    </span>
                  ))}
                </p>
              )}
              {sel > 0 && (
                <p style={{ fontSize: 11, color: '#6b7280', marginTop: 12 }}>
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
