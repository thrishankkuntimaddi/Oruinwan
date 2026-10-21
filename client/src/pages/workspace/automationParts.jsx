import React, { useEffect, useRef, useState } from 'react';
import { Braces, CalendarClock, ChevronDown, ChevronRight, FlaskConical, Play, RefreshCcw, History } from 'lucide-react';
import { Field, SelectBox, Btn, Chip, Panel, EmptyState, LoadingState, Dialog, timeAgo } from '../../components/ui/page';
import { previewSchedule, getAutomationRuns, runAutomation } from '../../services/automationsService';
import {
  variablesFor, insertToken, unknownStepRefs, CRON_PRESETS, INTERVAL_PRESETS, looksLikeSchedule, timezoneList,
  browserTimezone, RUN_TONE, RUN_LABEL, SOURCE_LABEL, parseSampleData, sampleEventFor,
} from './automationLogic';

/** Picker that lists the template variables available at this step. */
export function VariablePicker({ groups, onPick, label = 'Insert a variable' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return (
    <span className="tk-var" ref={ref}>
      <button type="button" className="gl-icon-btn" aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open}
        onClick={() => setOpen((v) => !v)}>
        <Braces size={14} />
      </button>
      {open && (
        <div className="cd-menu tk-var-menu" role="menu" aria-label="Variables">
          {groups.map((g) => (
            <div key={g.group}>
              <div className="tk-var-group">{g.group}</div>
              {g.items.map((it) => (
                <button key={it.token} type="button" role="menuitem" onClick={() => { onPick(it.token); setOpen(false); }}>
                  <code>{it.label}</code>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </span>
  );
}

/** A text field whose value can contain {{variables}}, with a picker that inserts at the caret. */
export function VarField({ label, hint, value, onChange, placeholder, multiline, type = 'text', ctx }) {
  const inputRef = useRef(null);
  const groups = variablesFor(ctx.triggerType, ctx.actions, ctx.stepIndex);
  const bad = unknownStepRefs(value || '', ctx.actions, ctx.stepIndex);
  const pick = (token) => {
    const el = inputRef.current;
    const { value: next, caret } = insertToken(value || '', token, el?.selectionStart ?? undefined, el?.selectionEnd ?? undefined);
    onChange(next);
    requestAnimationFrame(() => { if (el) { el.focus(); try { el.setSelectionRange(caret, caret); } catch { /* not a text input */ } } });
  };
  const Input = multiline ? 'textarea' : 'input';
  return (
    <Field label={label} error={bad.length ? `Unknown step: ${bad.join(', ')} (only earlier steps can be used)` : null} hint={hint}>
      <div className="tk-var-row">
        <Input ref={inputRef} className="gl-input" type={multiline ? undefined : type} rows={multiline ? 3 : undefined}
          value={value || ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} aria-label={label} />
        {type !== 'password' && <VariablePicker groups={groups} onPick={pick} label={`Insert a variable into ${label}`} />}
      </div>
    </Field>
  );
}

/** Interval / cron schedule with timezone and a preview of the next runs. */
export function SchedulePicker({ schedule, onChange }) {
  const s = schedule || { type: 'interval', expression: '1h' };
  const [preview, setPreview] = useState({ loading: false, runs: [], error: null });
  const zones = useRef(null);
  if (!zones.current) zones.current = timezoneList();

  useEffect(() => {
    if (!looksLikeSchedule(s)) { setPreview({ loading: false, runs: [], error: s.expression ? 'That doesn’t look like a valid schedule yet' : null }); return undefined; }
    let alive = true;
    setPreview((p) => ({ ...p, loading: true }));
    const t = setTimeout(() => {
      previewSchedule({ expression: s.expression, type: s.type, timezone: s.timezone || 'UTC', count: 5 })
        .then(({ data }) => { if (alive) setPreview({ loading: false, runs: data.nextRuns || [], error: null }); })
        .catch((err) => { if (alive) setPreview({ loading: false, runs: [], error: err.response?.data?.message || 'Could not check this schedule' }); });
    }, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [s.type, s.expression, s.timezone]); // eslint-disable-line react-hooks/exhaustive-deps

  const setType = (type) => onChange(type === 'cron'
    ? { type: 'cron', expression: '0 9 * * 1-5', timezone: s.timezone || browserTimezone() }
    : { type: 'interval', expression: '1h' });

  const fmt = (iso) => {
    try {
      return new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: s.type === 'cron' ? (s.timezone || 'UTC') : undefined });
    } catch { return new Date(iso).toLocaleString(); }
  };

  return (
    <div className="tk-sched">
      <div className="tk-fields">
        <Field label="Repeat">
          <SelectBox value={s.type} onChange={setType} label="Repeat">
            <option value="interval">At a fixed interval</option>
            <option value="cron">On a calendar schedule (cron)</option>
          </SelectBox>
        </Field>
        {s.type === 'interval' ? (
          <Field label="Run every" hint="Or type your own, e.g. 45m, 3h, 2d">
            <input className="gl-input" list="tk-interval-presets" value={s.expression || ''} aria-label="Run every"
              onChange={(e) => onChange({ ...s, expression: e.target.value })} />
            <datalist id="tk-interval-presets">
              {INTERVAL_PRESETS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </datalist>
          </Field>
        ) : (
          <>
            <Field label="Cron expression" hint="minute hour day month weekday">
              <input className="gl-input" value={s.expression || ''} aria-label="Cron expression" spellCheck={false}
                style={{ fontFamily: 'var(--font-mono, monospace)' }}
                onChange={(e) => onChange({ ...s, expression: e.target.value })} />
            </Field>
            <Field label="Time zone">
              <input className="gl-input" list="tk-tz-list" value={s.timezone || ''} aria-label="Time zone"
                onChange={(e) => onChange({ ...s, timezone: e.target.value })} placeholder="UTC" />
              <datalist id="tk-tz-list">{zones.current.map((z) => <option key={z} value={z} />)}</datalist>
            </Field>
          </>
        )}
      </div>
      {s.type === 'cron' && (
        <div className="gl-x-chips gl-x-chips--wrap" style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {CRON_PRESETS.map((p) => (
            <button key={p.expression} type="button" className="tk-preset" aria-pressed={s.expression === p.expression}
              onClick={() => onChange({ ...s, expression: p.expression })}>{p.label}</button>
          ))}
        </div>
      )}
      <div className="tk-sched-preview" aria-live="polite">
        <CalendarClock size={14} />
        {preview.loading ? <span>Checking…</span>
          : preview.error ? <span className="cd-error-text">{preview.error}</span>
            : preview.runs.length ? (
              <span>Next runs: {preview.runs.map((r, i) => <React.Fragment key={r}>{i > 0 && ' · '}<b>{fmt(r)}</b></React.Fragment>)}</span>
            ) : <span>Pick a schedule to see when it runs.</span>}
      </div>
    </div>
  );
}

function StepStatus({ step }) {
  const tone = step.status === 'success' ? 'success' : step.status === 'failed' ? 'danger' : undefined;
  return <Chip tone={tone}>{step.status === 'success' ? 'Done' : step.status === 'failed' ? 'Failed' : 'Skipped'}</Chip>;
}

/** One run with its per-step results (expandable). */
export function RunRow({ run, actionLabel, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const steps = run.actionsExecuted || [];
  return (
    <li className="tk-run">
      <button type="button" className="tk-run-head" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Chip tone={RUN_TONE[run.status]}>{RUN_LABEL[run.status] || run.status}</Chip>
        <span className="tk-run-src">{SOURCE_LABEL[run.source] || run.source}{run.dryRun ? ' · dry run' : ''}</span>
        <span className="tk-run-time">{run.createdAt ? timeAgo(run.createdAt) : ''}{run.durationMs != null ? ` · ${run.durationMs} ms` : ''}</span>
      </button>
      {open && (
        <div className="tk-run-body">
          {run.conditionsMet === false && <p className="cd-hint" style={{ margin: '0 0 6px' }}>Conditions didn’t match, so no step ran.</p>}
          {run.error && <p className="cd-error-text" style={{ margin: '0 0 6px' }}>{run.error}</p>}
          {steps.length === 0 ? <p className="cd-hint" style={{ margin: 0 }}>No steps recorded.</p> : (
            <ol className="tk-run-steps">
              {steps.map((st) => (
                <li key={st.index}>
                  <div className="tk-run-step-head">
                    <span className="tk-run-step-n">{st.index + 1}</span>
                    <strong>{actionLabel(st.type)}</strong>
                    {st.stepId && <code>{st.stepId}</code>}
                    <StepStatus step={st} />
                    {st.durationMs != null && <span className="tk-run-time">{st.durationMs} ms</span>}
                  </div>
                  {st.error && <div className="cd-error-text">{st.error}</div>}
                  {st.reason && <div className="cd-hint">{st.reason}</div>}
                  {(st.preview || st.output) && (
                    <pre className="tk-run-json">{JSON.stringify(st.preview || st.output, null, 2)}</pre>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </li>
  );
}

/** Run history for a saved workflow. */
export function RunsPanel({ automationId, workspaceId, actionLabel, refreshKey }) {
  const [state, setState] = useState({ loading: true, runs: [], error: null });
  const load = React.useCallback(() => {
    setState((s) => ({ ...s, loading: true }));
    getAutomationRuns(automationId, workspaceId, { limit: 20 })
      .then(({ data }) => setState({ loading: false, runs: data.runs || [], error: null }))
      .catch((err) => setState({ loading: false, runs: [], error: err.response?.data?.message || 'Could not load runs' }));
  }, [automationId, workspaceId]);
  useEffect(() => { load(); }, [load, refreshKey]);
  return (
    <Panel flush title="Run history" icon={History}
      action={<Btn size="sm" variant="ghost" icon={RefreshCcw} onClick={load} loading={state.loading}>Refresh</Btn>}>
      {state.loading && !state.runs.length ? <LoadingState label="Loading runs…" />
        : state.error ? <p className="cd-error-text" style={{ padding: 14, margin: 0 }}>{state.error}</p>
          : !state.runs.length ? <EmptyState icon={History} title="No runs yet" text="Runs from the last 30 days show here, with what each step did." />
            : <ul className="tk-runs">{state.runs.map((r) => <RunRow key={r._id} run={r} actionLabel={actionLabel} />)}</ul>}
    </Panel>
  );
}

/** Test (dry run) / Run now dialog with editable sample event data. */
export function RunDialog({ open, mode, onClose, automationId, workspaceId, triggerType, actionLabel, onRan }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [run, setRun] = useState(null);
  useEffect(() => {
    if (open) { setText(JSON.stringify(sampleEventFor(triggerType), null, 2)); setRun(null); setError(null); }
  }, [open, triggerType]);
  const dryRun = mode === 'test';
  const go = async () => {
    const parsed = parseSampleData(text);
    if (parsed.error) { setError(parsed.error); return; }
    setBusy(true); setError(null);
    try {
      const { data } = await runAutomation(automationId, workspaceId, { eventData: parsed.data, dryRun });
      setRun(data.run);
      onRan?.(data.run);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not run the workflow');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onClose={onClose} busy={busy} size="lg"
      title={dryRun ? 'Test this workflow' : 'Run this workflow now'}
      lead={dryRun
        ? 'Uses the last saved version. Checks the conditions and shows what each step would do with this sample data; nothing is sent or created.'
        : 'Uses the last saved version and runs every step for real with this event data, even if the workflow is paused.'}
      footer={(
        <>
          <Btn variant="ghost" onClick={onClose} disabled={busy}>Close</Btn>
          <Btn variant="primary" icon={dryRun ? FlaskConical : Play} loading={busy} onClick={go}>{dryRun ? 'Run test' : 'Run now'}</Btn>
        </>
      )}>
      <Field label="Sample event data (JSON)" hint="These become the trigger variables, e.g. {{title}}." error={error}>
        <textarea className="gl-input" rows={6} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false}
          style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 12 }} aria-label="Sample event data" />
      </Field>
      {run && <ul className="tk-runs" style={{ marginTop: 12 }}><RunRow run={run} actionLabel={actionLabel} defaultOpen /></ul>}
    </Dialog>
  );
}
