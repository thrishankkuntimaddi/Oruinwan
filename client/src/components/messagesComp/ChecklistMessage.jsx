import React, { useState, useCallback } from 'react';
import api from '@services/api';

const API = import.meta.env.VITE_API_URL || '';

export default function ChecklistMessage({ messageId, checklist: initialChecklist = [], disabled = false }) {
  const [items, setItems] = useState(initialChecklist);
  const [loading, setLoading] = useState(null); 

  const toggle = useCallback(async (idx) => {
    if (disabled || loading !== null) return;
    const optimistic = items.map((item, i) =>
      i === idx ? { ...item, checked: !item.checked } : item
    );
    setItems(optimistic);
    setLoading(idx);
    try {
      const res = await api.post(`/api/v2/messages/${messageId}/checklist/${idx}`, {});
      
      if (res.data?.checklist) setItems(res.data.checklist);
    } catch {
      
      setItems(items);
    } finally {
      setLoading(null);
    }
  }, [messageId, items, disabled, loading]);

  const doneCount = items.filter(i => i.checked).length;
  const progress  = items.length > 0 ? (doneCount / items.length) * 100 : 0;

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', minWidth: 200, maxWidth: 360 }}>
      {}
      {items.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: '#a0a5b0' }}>Checklist</span>
            <span style={{ fontSize: 11, color: doneCount === items.length ? '#43b581' : '#a0a5b0' }}>
              {doneCount}/{items.length}
            </span>
          </div>
          <div style={{ height: 4, background: '#3a3d42', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${progress}%`, borderRadius: 2,
              background: progress === 100 ? '#43b581' : '#5865f2',
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>
      )}

      {}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((item, idx) => (
          <label
            key={item._id || idx}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 8, cursor: disabled ? 'default' : 'pointer',
              padding: '4px 0', opacity: loading === idx ? 0.6 : 1,
            }}
          >
            <input
              type="checkbox"
              checked={item.checked}
              onChange={() => toggle(idx)}
              disabled={disabled || loading === idx}
              style={{ marginTop: 2, accentColor: '#5865f2', cursor: disabled ? 'default' : 'pointer' }}
            />
            <span style={{
              fontSize: 13, color: item.checked ? '#6b7280' : '#d1d5db',
              textDecoration: item.checked ? 'line-through' : 'none',
              lineHeight: 1.4, flex: 1, wordBreak: 'break-word',
              transition: 'color 0.2s, text-decoration 0.2s',
            }}>
              {item.text}
            </span>
          </label>
        ))}
      </div>

      {items.length === 0 && (
        <span style={{ fontSize: 13, color: '#6b7280', fontStyle: 'italic' }}>
          Empty checklist
        </span>
      )}
    </div>
  );
}
