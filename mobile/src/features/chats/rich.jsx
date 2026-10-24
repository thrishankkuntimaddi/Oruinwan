// Message content beyond text: polls, checklists and translations, shown inside a message row.
import { useEffect, useRef, useState } from 'react';
import { BarChart3, Check, ChevronDown, ChevronUp, Clock, Languages, ListChecks, Lock, Users } from 'lucide-react';
import { api } from '../../data/session.js';
import { parseChecklistText } from '../../data/live/adapter.chats.js';
import { Icon } from '../../ui/Icon.jsx';
import { Markdown } from '../../ui/Markdown.jsx';
import { Spinner } from '../../ui/Feedback.jsx';
import { cx } from '../../ui/cx.js';
import { toast } from '../../lib/bus.js';
import { tap } from '../../native/index.js';
import { isSameLanguage, languageName, useTranslation, useTranslations } from './translate.js';

/** The poll after `me` picks `indices` (mirrors the server's rules), for an instant result. */
export function applyVote(poll, me, indices) {
  const options = poll.options.map((o, i) => {
    const others = o.votes.filter((v) => v.id !== me);
    return { ...o, votes: indices.includes(i) ? [...others, { id: me, name: 'You' }] : others };
  });
  const voters = new Set(options.flatMap((o) => o.votes.map((v) => v.id)));
  return { ...poll, options, totalVotes: voters.size };
}

const stop = { onPointerDown: (e) => e.stopPropagation(), onContextMenu: (e) => e.stopPropagation() };

export function PollCard({ m, me, directory }) {
  const [poll, setPoll] = useState(m.poll);
  const [busy, setBusy] = useState(0);
  const [closing, setClosing] = useState(false);
  const [open, setOpen] = useState(null);
  const confirmed = useRef(m.poll);
  useEffect(() => {
    confirmed.current = m.poll;
    setPoll(m.poll);
  }, [m.poll]);
  if (!poll) return null;

  const expired = poll.endDate ? new Date(poll.endDate) < new Date() : false;
  const closed = !poll.active || expired;
  const mine = poll.options.reduce((acc, o, i) => (o.votes.some((v) => v.id === me) ? [...acc, i] : acc), []);
  const voted = mine.length > 0;
  // Results are live for everyone (voted or not): a vote by anyone moves the bars for all.
  const showResults = true;
  const total = poll.totalVotes || 0;
  const pending = Boolean(m.pending) || String(m.id).startsWith('tmp');

  const vote = async (indices) => {
    if (closed || pending) return;
    tap('select');
    setPoll((p) => applyVote(p, me, indices));
    setBusy((n) => n + 1);
    try {
      const next = await api().votePoll(null, m.id, indices);
      if (next) {
        confirmed.current = next;
        setPoll(next);
      }
    } catch (err) {
      setPoll(confirmed.current);
      toast(err.message || 'Your vote was not saved. Try again.', 'danger');
    } finally {
      setBusy((n) => n - 1);
    }
  };

  const pick = (i) => {
    const has = mine.includes(i);
    vote(poll.allowMultiple ? (has ? mine.filter((x) => x !== i) : [...mine, i]) : has ? [] : [i]);
  };

  const end = async () => {
    setClosing(true);
    try {
      const next = await api().closePoll(null, m.id);
      if (next) setPoll(next);
    } catch (err) {
      toast(err.message || 'Could not end the poll.', 'danger');
    } finally {
      setClosing(false);
    }
  };

  const voterName = (v) => v.name || directory?.[v.id]?.name || 'Someone';

  return (
    <div className="mt-1 w-full max-w-[420px] overflow-hidden rounded-xl border border-line bg-surface" {...stop} data-testid="poll-card">
      <div className="flex items-center gap-2 px-3.5 pt-3">
        <Icon as={BarChart3} size={14} className="text-accent-ink" />
        <span className="rounded bg-accent/12 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-accent-ink uppercase">
          {poll.allowMultiple ? 'Multiple choice' : 'Poll'}
        </span>
        {closed && <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-text-2 uppercase">Closed</span>}
      </div>
      <p className="px-3.5 pt-1.5 text-[15px] font-semibold leading-snug">{poll.question}</p>
      <p className="flex flex-wrap items-center gap-3 px-3.5 pt-1 pb-2.5 text-[11px] text-text-3">
        <span className="inline-flex items-center gap-1">
          <Icon as={Users} size={11} /> {total} {total === 1 ? 'vote' : 'votes'}
        </span>
        {poll.endDate && (
          <span className="inline-flex items-center gap-1">
            <Icon as={Clock} size={11} /> {expired ? 'Ended' : 'Ends'} {new Date(poll.endDate).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </span>
        )}
        {poll.anonymous && (
          <span className="inline-flex items-center gap-1">
            <Icon as={Lock} size={11} /> Anonymous
          </span>
        )}
      </p>
      <div className="flex flex-col gap-1.5 px-2.5 pb-2.5">
        {poll.options.map((o, i) => {
          const count = o.votes.length;
          const pct = total ? Math.round((count / total) * 100) : 0;
          const chosen = mine.includes(i);
          return (
            <div key={i}>
              <button
                type="button"
                disabled={closed || pending}
                aria-pressed={chosen}
                onClick={() => pick(i)}
                className={cx(
                  'pressable relative w-full overflow-hidden rounded-lg border bg-input px-3 py-2.5 text-left',
                  chosen ? 'border-accent' : 'border-line',
                )}
              >
                {showResults && (
                  <span
                    aria-hidden
                    className={cx('absolute inset-y-0 left-0 transition-[width] duration-300', chosen ? 'bg-accent/18' : 'bg-surface-3')}
                    style={{ width: `${pct}%` }}
                  />
                )}
                <span className="relative flex items-center justify-between gap-2.5">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden
                      className={cx(
                        'grid h-4 w-4 shrink-0 place-items-center border-[1.5px]',
                        poll.allowMultiple ? 'rounded' : 'rounded-full',
                        chosen ? 'border-accent bg-accent text-on-accent' : 'border-text-3',
                      )}
                    >
                      {chosen && <Icon as={Check} size={10} strokeWidth={3} />}
                    </span>
                    <span className={cx('truncate text-[14px]', chosen && 'font-semibold')}>{o.text}</span>
                  </span>
                  {showResults && (
                    <span className="flex shrink-0 items-center gap-1.5 text-[12px] tabular-nums text-text-2">
                      <strong className={chosen ? 'text-accent-ink' : ''}>{pct}%</strong>
                      <span className="text-[11px] text-text-3">{count}</span>
                    </span>
                  )}
                </span>
              </button>
              {showResults && !poll.anonymous && count > 0 && (
                <button
                  type="button"
                  onClick={() => setOpen(open === i ? null : i)}
                  className="flex items-center gap-1 px-1.5 pt-1 text-[11px] text-text-3"
                  aria-expanded={open === i}
                >
                  <Icon as={open === i ? ChevronUp : ChevronDown} size={11} /> Who voted
                </button>
              )}
              {open === i && (
                <div className="flex flex-wrap gap-1 px-1.5 pt-1">
                  {o.votes.map((v) => (
                    <span key={v.id} className="rounded border border-line-soft bg-surface-2 px-1.5 py-0.5 text-[11px] text-text-2">
                      {v.id === me ? 'You' : voterName(v)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-line-soft px-3.5 py-2 text-[11px] text-text-3">
        <span className="flex items-center gap-1.5">
          {busy > 0 && <Spinner className="h-3 w-3" />}
          {closed ? 'Voting has ended' : voted ? 'You voted. Tap again to change.' : poll.allowMultiple ? 'Choose one or more' : 'Choose one'}
        </span>
        {poll.createdBy === me && !closed && !pending && (
          <button type="button" onClick={end} disabled={closing} className="rounded-md border border-line px-2 py-1 font-medium text-text-2">
            {closing ? 'Ending…' : 'End poll'}
          </button>
        )}
      </div>
    </div>
  );
}

export function ChecklistCard({ m }) {
  const data = m.state === 'ok' ? parseChecklistText(m.text) : null;
  const [items, setItems] = useState(m.checklist || []);
  const [busy, setBusy] = useState(null);
  useEffect(() => setItems(m.checklist || []), [m.checklist]);
  const labels = data?.items || [];
  const total = Math.max(items.length, labels.length);
  const done = items.filter((i) => i.checked).length;
  const allDone = total > 0 && done === total;
  const pending = Boolean(m.pending) || String(m.id).startsWith('tmp');

  const toggle = async (idx) => {
    if (busy !== null || pending) return;
    tap('select');
    const before = items;
    setItems((list) => list.map((it, i) => (i === idx ? { ...it, checked: !it.checked } : it)));
    setBusy(idx);
    try {
      const next = await api().toggleChecklistItem(null, m.id, idx);
      if (next?.length) setItems(next);
    } catch (err) {
      setItems(before);
      toast(err.message || 'Could not update the checklist.', 'danger');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mt-1 w-full max-w-[420px] overflow-hidden rounded-xl border border-line bg-surface" {...stop} data-testid="checklist-card">
      <div className="flex items-center gap-2 px-3.5 pt-3">
        <Icon as={ListChecks} size={14} className={allDone ? 'text-success' : 'text-accent-ink'} />
        <span className={cx('rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase', allDone ? 'bg-success/12 text-success' : 'bg-accent/12 text-accent-ink')}>
          {allDone ? 'Done' : 'Checklist'}
        </span>
        {total > 0 && <span className="text-[11px] text-text-3">{done} of {total} done</span>}
      </div>
      {data?.title && <p className="px-3.5 pt-1.5 text-[15px] font-semibold">{data.title}</p>}
      {total > 0 && (
        <div className="mx-3.5 mt-2 h-1 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label="Checklist progress">
          <span className={cx('block h-full rounded-full transition-[width] duration-300', allDone ? 'bg-success' : 'bg-accent')} style={{ width: `${(done / total) * 100}%` }} />
        </div>
      )}
      <ul className="px-1.5 py-1.5">
        {Array.from({ length: total }, (_, i) => {
          const it = items[i] || { checked: false };
          const label = labels[i] || it.text || `Item ${i + 1}`;
          return (
            <li key={i}>
              <button
                type="button"
                role="checkbox"
                aria-checked={it.checked}
                disabled={pending || m.state !== 'ok'}
                onClick={() => toggle(i)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left active:bg-surface-2"
              >
                <span className={cx('grid h-[18px] w-[18px] shrink-0 place-items-center rounded border-[1.5px]', it.checked ? 'border-accent bg-accent text-on-accent' : 'border-text-3')}>
                  {busy === i ? <Spinner className="h-3 w-3" /> : it.checked ? <Icon as={Check} size={11} strokeWidth={3} /> : null}
                </span>
                <span className={cx('text-[14px]', it.checked && 'text-text-3 line-through')}>{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** A translation under a message, when one was asked for (or made automatically). */
export function TranslationNote({ m }) {
  const t = useTranslation(m.id);
  const clear = useTranslations((s) => s.clear);
  if (!t) return null;
  if (t.auto && (t.status === 'error' || (t.status === 'done' && isSameLanguage(t.detected, t.lang)))) return null;
  return (
    <div className="mt-1.5 rounded-lg border border-line-soft bg-surface-2/60 px-2.5 py-2" {...stop}>
      <p className="mb-1 flex items-center gap-1.5 text-[11px] text-text-3">
        <Icon as={Languages} size={12} />
        {t.status === 'loading' ? `Translating to ${languageName(t.lang)}…` : t.status === 'error' ? t.error : `Translated to ${languageName(t.lang)}${t.detected ? ` from ${languageName(t.detected)}` : ''}`}
        {t.status !== 'loading' && (
          <button type="button" onClick={() => clear(m.id)} className="ml-auto font-medium text-text-2">
            Hide
          </button>
        )}
      </p>
      {t.status === 'loading' && <Spinner className="h-3.5 w-3.5 text-text-2" />}
      {t.status === 'done' && <Markdown text={t.text} className="text-text" />}
    </div>
  );
}
