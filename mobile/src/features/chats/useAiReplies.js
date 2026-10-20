// Oruinwan AI answers that are still being written in one conversation (or one thread), from the
// 'ai:reply' stream. When the answer is saved it arrives as a normal message and the live one goes.
import { useEffect, useState } from 'react';
import { on } from '../../lib/bus.js';

export function useAiReplies(convId, parentId = null) {
  const [replies, setReplies] = useState({});

  useEffect(() => {
    setReplies({});
    if (!convId) return undefined;
    const timers = new Set();
    const drop = (id) => setReplies((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    const off = on('ai:reply', (e) => {
      if (!e || String(e.conversationId) !== String(convId)) return;
      if (String(e.parentId || '') !== String(parentId || '')) return;
      const id = e.replyId;
      setReplies((prev) => {
        const cur = prev[id] || { id, text: '', status: 'Thinking…', error: null, assistant: e.assistant || 'default', name: e.assistantName || 'Oruinwan AI' };
        if (e.phase === 'start') return { ...prev, [id]: cur };
        if (e.phase === 'delta') return { ...prev, [id]: { ...cur, text: e.text || cur.text, status: null } };
        if (e.phase === 'tool') return { ...prev, [id]: { ...cur, status: e.status === 'running' ? 'Working on it…' : null } };
        if (e.phase === 'error') return { ...prev, [id]: { ...cur, status: null, error: e.message || 'Oruinwan AI could not answer.' } };
        return prev;
      });
      if (e.phase === 'end') drop(id);
      if (e.phase === 'error') {
        const t = setTimeout(() => drop(id), 8000);
        timers.add(t);
      }
    });
    return () => {
      off();
      timers.forEach(clearTimeout);
    };
  }, [convId, parentId]);

  return Object.values(replies);
}
