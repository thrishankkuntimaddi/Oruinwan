// Completing a task whose blockers are still open: the server answers 409 TASK_BLOCKED with the
// blockers. This sheet lists them (tap one to open it) and offers "Complete anyway".
import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { nav } from '../../app/nav.js';
import { STATUS_META } from '../../data/constants.js';
import { blockersOf } from '../../data/live/adapter.work.js';
import { Button } from '../../ui/Button.jsx';
import { Sheet } from '../../ui/Overlay.jsx';
import { StatusIcon } from './TaskRow.jsx';

export function BlockersSheet({ open, blockers, onClose, onComplete }) {
  const [busy, setBusy] = useState(false);
  const n = blockers?.length || 0;
  const complete = async () => {
    setBusy(true);
    try {
      await onComplete();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={n === 1 ? 'Blocked by an open task' : `Blocked by ${n} open tasks`}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button icon={CheckCircle2} className="flex-1" loading={busy} onClick={complete}>
            Complete anyway
          </Button>
        </div>
      }
    >
      <p className="px-5 pb-3 text-sm text-text-2">
        This task depends on work that isn’t done yet. Finish {n === 1 ? 'it' : 'those'} first, or complete this one anyway.
      </p>
      <div className="px-2 pb-3" data-testid="blockers-list">
        {(blockers || []).map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => {
              onClose();
              nav.push('task', { id: b.id });
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left active:bg-surface-2"
          >
            <StatusIcon status={STATUS_META[b.status] ? b.status : 'todo'} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px]">{b.title}</span>
              <span className="block truncate text-[13px] text-text-2">
                {[b.issueKey, STATUS_META[b.status]?.label].filter(Boolean).join(' · ')}
              </span>
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

/**
 * Wraps a status change: `guard(run)` calls run(false); on 409 TASK_BLOCKED it opens the sheet
 * and "Complete anyway" calls run(true). Other errors are rethrown. Resolves true when it went through.
 */
export function useBlockerGuard() {
  const [ask, setAsk] = useState(null); // { blockers, run }
  const guard = async (run) => {
    try {
      await run(false);
      return true;
    } catch (err) {
      const blockers = blockersOf(err);
      if (!blockers) throw err;
      setAsk({ blockers, run });
      return false;
    }
  };
  const ui = (
    <BlockersSheet
      open={Boolean(ask)}
      blockers={ask?.blockers || []}
      onClose={() => setAsk(null)}
      onComplete={async () => {
        await ask.run(true);
        setAsk(null);
      }}
    />
  );
  return { guard, ui };
}
