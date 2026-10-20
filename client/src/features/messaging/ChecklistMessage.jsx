import React, { useState, useCallback, useEffect, useRef } from 'react';
import api from '@services/api';
import { Check, ListChecks } from 'lucide-react';
import { useSocket } from '../../contexts/SocketContext';
import './messagingUi.css';


export default function ChecklistMessage({ messageId, checklist: initialChecklist = [], disabled = false }) {
  const [items, setItems] = useState(initialChecklist);
  // The server only knows checked states (labels are encrypted), so keep the labels
  // by position and adopt newer states from props (e.g. another person's toggle).
  const labelsRef = useRef(initialChecklist.map(i => i.text));
  labelsRef.current = initialChecklist.map((i, idx) => i.text || labelsRef.current[idx]);
  const withLabels = (list) => list.map((item, idx) => ({ ...item, text: item.text || labelsRef.current[idx] || `Item ${idx + 1}` }));
  const stateKey = initialChecklist.map(i => (i.checked ? 1 : 0)).join('');
  useEffect(() => { setItems(withLabels(initialChecklist)); }, [stateKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live ticks from other people in the conversation.
  const { socket } = useSocket() || {};
  useEffect(() => {
    if (!socket) return undefined;
    const onUpdate = ({ messageId: id, checklist }) => {
      if (String(id) === String(messageId) && Array.isArray(checklist)) setItems(withLabels(checklist));
    };
    socket.on('message:checklist_updated', onUpdate);
    return () => socket.off('message:checklist_updated', onUpdate);
  }, [socket, messageId]); // eslint-disable-line react-hooks/exhaustive-deps
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
      
      if (res.data?.checklist) setItems(withLabels(res.data.checklist));
    } catch {
      
      setItems(items);
    } finally {
      setLoading(null);
    }
  }, [messageId, items, disabled, loading]);

  const doneCount = items.filter(i => i.checked).length;
  const progress  = items.length > 0 ? (doneCount / items.length) * 100 : 0;

  const allDone = items.length > 0 && doneCount === items.length;

  return (
    <div className="mx-check">
      <div className="mx-check-head">
        <ListChecks size={14} aria-hidden="true" />
        <span className="mx-badge" data-tone={allDone ? 'success' : undefined}>{allDone ? 'Done' : 'Checklist'}</span>
        {items.length > 0 && (
          <span className="mx-check-count" data-done={allDone ? 'true' : undefined}>
            {doneCount} of {items.length} done
          </span>
        )}
      </div>

      {items.length > 0 && (
        <div
          className="mx-check-bar"
          data-done={allDone ? 'true' : undefined}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={items.length}
          aria-valuenow={doneCount}
          aria-label="Checklist progress"
        >
          <span style={{ width: `${progress}%` }} />
        </div>
      )}

      {items.length > 0 ? (
        <div className="mx-check-list">
          {items.map((item, idx) => (
            <label
              key={item._id || idx}
              className="mx-check-item"
              data-disabled={disabled ? 'true' : undefined}
              data-busy={loading === idx ? 'true' : undefined}
            >
              <input
                type="checkbox"
                checked={!!item.checked}
                onChange={() => toggle(idx)}
                disabled={disabled || loading === idx}
              />
              <span className="mx-check-box" aria-hidden="true">
                {item.checked && <Check size={11} strokeWidth={3} />}
              </span>
              <span className="mx-check-text">{item.text}</span>
            </label>
          ))}
        </div>
      ) : (
        <p className="mx-check-empty">This checklist has no items.</p>
      )}
    </div>
  );
}
