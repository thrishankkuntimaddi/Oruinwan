import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Workflow, ArrowLeft, Check, Plus, Trash2, LayoutTemplate, MessageSquare, ListPlus, CheckCircle2,
  CalendarCheck, FileUp, GitMerge, Webhook, Clock, UserCheck, Bell, Zap, AlertTriangle, X, Info,
  ArrowUp, ArrowDown, FlaskConical, Play,
} from 'lucide-react';
import {
  getTemplates,
  createAutomation,
  getAutomation,
  updateAutomation
} from '../../services/automationsService';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useToast } from '../../contexts/ToastContext';
import {
  DashPage, PageHead, Panel, Field, SelectBox, Btn, IconBtn, Chip, LoadingState,
} from '../../components/ui/page';
import { Switch } from '../workspace-os/wosShared';
import {
  OPERATORS, operatorOf, conditionInputValue, conditionComplete, buildAutomationPayload, suggestStepId,
  validateStepIds, moveItem, MAX_STEPS, MAX_CONDITIONS, TRIGGER_FIELDS, INTERVAL_PRESETS, STEP_OUTPUTS,
} from './automationLogic';
import { VarField, SchedulePicker, RunsPanel, RunDialog } from './automationParts';
import '../toolkit/toolkit.css';

const TRIGGER_OPTIONS = [
  { value: 'task.created',      label: 'Task created',      hint: 'Someone adds a task',          Icon: ListPlus },
  { value: 'task.completed',    label: 'Task completed',    hint: 'A task is marked done',        Icon: CheckCircle2 },
  { value: 'message.sent',      label: 'Message sent',      hint: 'In a public channel',          Icon: MessageSquare },
  { value: 'meeting.completed', label: 'Meeting ended',     hint: 'A meeting finishes',           Icon: CalendarCheck },
  { value: 'file.uploaded',     label: 'File uploaded',     hint: 'Added to the file library',    Icon: FileUp },
  { value: 'github.pr_merged',  label: 'PR merged',         hint: 'From GitHub',                  Icon: GitMerge },
  { value: 'webhook.received',  label: 'Webhook received',  hint: 'Another tool calls in',        Icon: Webhook },
  { value: 'scheduled',         label: 'On a schedule',     hint: 'Interval or calendar time',    Icon: Clock },
];

const ACTION_OPTIONS = [
  { value: 'send_message',        label: 'Send a message',     Icon: MessageSquare },
  { value: 'create_task',         label: 'Create a task',      Icon: ListPlus },
  { value: 'assign_task',         label: 'Assign a task',      Icon: UserCheck },
  { value: 'send_notification',   label: 'Send a notification', Icon: Bell },
  { value: 'call_webhook',        label: 'Call a webhook',     Icon: Webhook },
  { value: 'post_to_slack',       label: 'Post to Slack',      Icon: MessageSquare },
  { value: 'trigger_ci_pipeline', label: 'Start a CI pipeline', Icon: Zap },
];

const triggerOf = (v) => TRIGGER_OPTIONS.find((o) => o.value === v) || { label: v || 'Trigger', Icon: Zap };
const actionOf = (v) => ACTION_OPTIONS.find((o) => o.value === v) || { label: v || 'Step', Icon: Zap };
const actionLabel = (v) => actionOf(v).label;
const lower = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);

function ActionConfigFields({ action, onChange, ctx }) {
  const update = (key, value) => onChange({ ...action, config: { ...action.config, [key]: value } });
  const c = action.config || {};
  const F = (props) => <VarField ctx={ctx} {...props} />;

  switch (action.type) {
    case 'send_message': return (
      <div className="tk-fields">
        {F({ label: 'Channel', hint: 'Channel name like engineering, or a channel ID', value: c.channelName || c.channelId,
          onChange: (v) => onChange({ ...action, config: { ...c, channelName: /^[a-f0-9]{24}$/i.test(v) ? undefined : v, channelId: /^[a-f0-9]{24}$/i.test(v) ? v : undefined } }),
          placeholder: '#engineering' })}
        {F({ label: 'Message', multiline: true, value: c.text, onChange: (v) => update('text', v), placeholder: 'Use variables like {{task.title}}' })}
      </div>
    );
    case 'create_task': return (
      <div className="tk-fields">
        {F({ label: 'Task title', value: c.title, onChange: (v) => update('title', v), placeholder: 'Release {{github.repo}}' })}
        {F({ label: 'Description', hint: 'Optional', value: c.description, onChange: (v) => update('description', v) })}
        <Field label="Priority">
          <SelectBox value={c.priority || 'medium'} onChange={(v) => update('priority', v)} label="Priority">
            {['low', 'medium', 'high', 'urgent'].map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </SelectBox>
        </Field>
        <Field label="Due in (days)" hint="Optional">
          <input className="gl-input" type="number" min="0" value={c.dueInDays ?? ''} aria-label="Due in days"
            onChange={(e) => update('dueInDays', e.target.value === '' ? undefined : Number(e.target.value))} />
        </Field>
        {F({ label: 'Assignee ID', hint: 'Optional', value: c.assigneeId, onChange: (v) => update('assigneeId', v) })}
      </div>
    );
    case 'assign_task': return (
      <div className="tk-fields">
        {F({ label: 'Task ID', hint: 'Blank = the task from the previous step or the trigger', value: c.taskId, onChange: (v) => update('taskId', v), placeholder: '{{previous.taskId}}' })}
        {F({ label: 'Assignee ID', value: c.assigneeId, onChange: (v) => update('assigneeId', v), placeholder: 'Person who gets it' })}
      </div>
    );
    case 'send_notification': return (
      <div className="tk-fields">
        {F({ label: 'Title', value: c.title, onChange: (v) => update('title', v), placeholder: 'What the notification says' })}
        {F({ label: 'Body', hint: 'Optional', value: c.body, onChange: (v) => update('body', v) })}
        {F({ label: 'Recipient ID', hint: 'Blank = the person who caused the event', value: c.recipientId, onChange: (v) => update('recipientId', v) })}
        {F({ label: 'Link', hint: 'Optional', value: c.link, onChange: (v) => update('link', v) })}
      </div>
    );
    case 'call_webhook': return (
      <div className="tk-fields">
        {F({ label: 'Webhook URL', value: c.url, onChange: (v) => update('url', v), placeholder: 'https://…' })}
        <Field label="Method">
          <SelectBox value={c.method || 'POST'} onChange={(v) => update('method', v)} label="Method">
            {['POST', 'GET', 'PUT', 'PATCH', 'DELETE'].map((m) => <option key={m} value={m}>{m}</option>)}
          </SelectBox>
        </Field>
      </div>
    );
    case 'post_to_slack': return (
      <div className="tk-fields">
        <VarField ctx={ctx} label="Slack incoming webhook URL" type="password" value={c.webhookUrl} onChange={(v) => update('webhookUrl', v)} placeholder="https://hooks.slack.com/…" />
        {F({ label: 'Message', multiline: true, value: c.text, onChange: (v) => update('text', v), placeholder: 'What to post' })}
      </div>
    );
    case 'trigger_ci_pipeline': return (
      <div className="tk-fields">
        {F({ label: 'CI pipeline URL', value: c.url, onChange: (v) => update('url', v), placeholder: 'https://…' })}
        <VarField ctx={ctx} label="Bearer token" hint="Optional" type="password" value={c.token} onChange={(v) => update('token', v)} placeholder="Token" />
      </div>
    );
    default: return null;
  }
}

/** A numbered step on the When → If → Then rail. */
function Step({ mark, title, lead, aside, children }) {
  return (
    <section className="tk-step">
      <div className="tk-step-rail"><span className="tk-step-num">{mark}</span></div>
      <div className="tk-step-body">
        <div className="tk-step-head">
          <div>
            <h2 className="tk-step-title">{title}</h2>
            {lead && <p className="tk-step-lead">{lead}</p>}
          </div>
          {aside}
        </div>
        {children}
      </div>
    </section>
  );
}

const EMPTY_FORM = {
  name: '',
  description: '',
  trigger: { type: 'task.created', config: {} },
  conditions: [],
  conditionLogic: 'all',
  actions: [{ id: 'notify', type: 'send_notification', config: {} }],
  schedule: null,
  isActive: true,
};

const FORM_ID = 'workflow-builder-form';

function describeSchedule(s) {
  if (!s) return null;
  if (s.type === 'cron') return `cron “${s.expression}” (${s.timezone || 'UTC'})`;
  return lower(INTERVAL_PRESETS.find((o) => o.value === s.expression)?.label || `every ${s.expression}`);
}

export default function AutomationBuilderPage() {
  const { workspaceId, id } = useParams();
  const navigate = useNavigate();
  const { activeWorkspace } = useWorkspace();
  const { showToast } = useToast();
  const isEdit = Boolean(id);

  const [form, setForm] = useState(EMPTY_FORM);
  const [templates, setTemplates] = useState([]);
  const [showTemplates, setShowTemplates] = useState(!isEdit);
  const [appliedTemplate, setAppliedTemplate] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(isEdit);
  const [error, setError] = useState(null);
  const [nameError, setNameError] = useState(null);
  const [runMode, setRunMode] = useState(null); // 'test' | 'run'
  const [runsKey, setRunsKey] = useState(0);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const { data } = await getAutomation(id, workspaceId);
        const a = data.automation;
        setForm({
          name:        a.name || '',
          description: a.description || '',
          trigger:     a.trigger || { type: 'task.created', config: {} },
          conditions:  a.conditions || [],
          conditionLogic: a.conditionLogic === 'any' ? 'any' : 'all',
          actions:     (a.actions && a.actions.length ? a.actions : [{ type: 'send_notification', config: {} }])
            .map((x) => ({ ...x, id: x.id || '', name: x.name || '' })),
          schedule:    a.schedule || null,
          isActive:    a.isActive ?? true,
        });
      } catch (err) {
        setError(err.response?.data?.message || 'Could not load this workflow');
      } finally {
        setLoadingExisting(false);
      }
    })();
  }, [id, isEdit, workspaceId]);

  useEffect(() => {
    getTemplates()
      .then(({ data }) => setTemplates(data.templates || []))
      .catch(() => {});
  }, []);

  const applyTemplate = useCallback((template) => {
    setForm(prev => ({
      ...prev,
      name:       prev.name || template.name,
      description: prev.description || template.description,
      trigger:    template.trigger,
      conditions: template.conditions || [],
      conditionLogic: template.conditionLogic === 'any' ? 'any' : 'all',
      actions:    (template.actions || []).map((x) => ({ ...x, id: x.id || '', name: x.name || '' })),
      schedule:   template.schedule || null,
    }));
    setAppliedTemplate(template.name);
    setShowTemplates(false);
  }, []);

  const setTriggerType = (type) => {
    const needsSchedule = type === 'scheduled';
    setForm(prev => ({
      ...prev,
      trigger:  { type, config: {} },
      schedule: needsSchedule ? (prev.schedule || { type: 'interval', expression: '1h' }) : null,
    }));
  };

  const addCondition = () =>
    setForm(prev => ({ ...prev, conditions: [...prev.conditions, { field: '', operator: 'equals', value: '' }] }));
  const updateCondition = (i, updates) =>
    setForm(prev => ({ ...prev, conditions: prev.conditions.map((c, idx) => idx === i ? { ...c, ...updates } : c) }));
  const removeCondition = (i) =>
    setForm(prev => ({ ...prev, conditions: prev.conditions.filter((_, idx) => idx !== i) }));

  const addAction = () =>
    setForm(prev => ({
      ...prev,
      actions: [...prev.actions, { id: suggestStepId('send_notification', prev.actions.map((a) => a.id)), type: 'send_notification', config: {} }],
    }));
  const updateAction = (i, updates) =>
    setForm(prev => ({ ...prev, actions: prev.actions.map((a, idx) => idx === i ? { ...a, ...updates } : a) }));
  const changeActionType = (i, type) =>
    setForm(prev => ({
      ...prev,
      actions: prev.actions.map((a, idx) => {
        if (idx !== i) return a;
        const others = prev.actions.filter((_, j) => j !== i).map((x) => x.id);
        // Re-suggest the id only when it was the auto-suggested one for the old type.
        const autoId = !a.id || a.id === suggestStepId(a.type, others);
        return { ...a, type, config: {}, id: autoId ? suggestStepId(type, others) : a.id };
      }),
    }));
  const removeAction = (i) =>
    setForm(prev => ({ ...prev, actions: prev.actions.filter((_, idx) => idx !== i) }));
  const moveAction = (i, dir) =>
    setForm(prev => ({ ...prev, actions: moveItem(prev.actions, i, i + dir) }));

  const idErrors = useMemo(() => validateStepIds(form.actions), [form.actions]);
  const idErrorAt = (i) => idErrors.find((e) => e.index === i)?.message || null;

  const backToList = () => navigate(`/workspace/${workspaceId}/automations`);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setNameError('Give the workflow a name so you can find it later');
      document.getElementById('wf-name')?.focus();
      return;
    }
    if (!form.actions.length) return setError('Add at least one step under “Then”');
    if (idErrors.length) return setError(`Step ${idErrors[0].index + 1}: ${idErrors[0].message}`);

    setSaving(true);
    setError(null);
    setNameError(null);

    try {
      const payload = buildAutomationPayload(form, workspaceId);
      if (isEdit) {
        await updateAutomation(id, payload);
      } else {
        await createAutomation(payload);
      }
      showToast(isEdit ? `Saved “${form.name.trim()}”` : `Created “${form.name.trim()}”`, 'success');
      backToList();
    } catch (err) {
      const msg = err.response?.data?.message || 'Could not save the workflow';
      setError(msg);
      showToast(msg, 'error');
      setSaving(false);
    }
  };

  const trigger = triggerOf(form.trigger.type);
  const filledConditions = form.conditions.filter(conditionComplete);
  const hasSide = !isEdit && showTemplates && templates.length > 0;
  const fieldHints = TRIGGER_FIELDS[form.trigger.type] || [];

  const head = (
    <PageHead
      eyebrow={activeWorkspace?.name ? `${activeWorkspace.name} · Workflows` : 'Workflows'}
      title={isEdit ? 'Edit workflow' : 'New workflow'}
      icon={Workflow}
      lead="Pick what starts it, narrow it down if you need to, then list the steps Oruinwan runs in order."
      actions={(
        <>
          <Btn variant="ghost" icon={ArrowLeft} onClick={backToList}>Workflows</Btn>
          {!isEdit && templates.length > 0 && (
            <Btn variant="ghost" icon={LayoutTemplate} onClick={() => setShowTemplates((v) => !v)} aria-pressed={showTemplates}>
              {showTemplates ? 'Hide templates' : 'Templates'}
            </Btn>
          )}
          {isEdit && (
            <>
              <Btn variant="ghost" icon={FlaskConical} onClick={() => setRunMode('test')} disabled={loadingExisting}>Test</Btn>
              <Btn variant="ghost" icon={Play} onClick={() => setRunMode('run')} disabled={loadingExisting}>Run now</Btn>
            </>
          )}
          <Btn variant="primary" icon={Check} type="submit" form={FORM_ID} loading={saving} disabled={loadingExisting}>
            {isEdit ? 'Save changes' : 'Create workflow'}
          </Btn>
        </>
      )}
    />
  );

  if (loadingExisting) return <DashPage head={head}><LoadingState label="Loading workflow…" /></DashPage>;

  return (
    <DashPage head={head}>
      <div className="tk-builder" data-side={hasSide ? 'true' : 'false'}>
        <form id={FORM_ID} onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          {error && (
            <div className="tk-notice" data-tone="danger" role="alert">
              <AlertTriangle size={15} />
              <span style={{ flex: 1 }}>{error}</span>
              <IconBtn label="Dismiss" onClick={() => setError(null)}><X size={14} /></IconBtn>
            </div>
          )}
          {appliedTemplate && (
            <div className="tk-notice" data-tone="success">
              <Check size={15} />
              <span style={{ flex: 1 }}>Filled in from “{appliedTemplate}”. Check the channel and IDs below, then create it.</span>
              <IconBtn label="Dismiss" onClick={() => setAppliedTemplate(null)}><X size={14} /></IconBtn>
            </div>
          )}

          <Panel>
            <div className="tk-fields">
              <Field label="Name" htmlFor="wf-name" error={nameError}>
                <input
                  id="wf-name"
                  className="gl-input"
                  value={form.name}
                  onChange={e => { setNameError(null); setForm(prev => ({ ...prev, name: e.target.value })); }}
                  placeholder="e.g. PR merged → post in #engineering"
                  required
                  aria-invalid={Boolean(nameError)}
                />
              </Field>
              <Field label="Description" hint="Optional" htmlFor="wf-desc">
                <input
                  id="wf-desc"
                  className="gl-input"
                  value={form.description}
                  onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="What this workflow is for"
                />
              </Field>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, fontSize: 13, color: 'var(--text-secondary)' }}>
              <Switch checked={form.isActive} onChange={(v) => setForm(prev => ({ ...prev, isActive: v }))} label="Run this workflow" />
              <span>{form.isActive ? 'Runs as soon as it’s saved' : 'Saved as paused; turn it on when you’re ready'}</span>
            </div>
          </Panel>

          <div className="tk-steps">
            <Step mark="When" title="When this happens" lead="The event that starts the workflow.">
              <div className="tk-choices" role="group" aria-label="Trigger">
                {TRIGGER_OPTIONS.map(({ value, label, hint, Icon }) => (
                  <button key={value} type="button" className="tk-choice" aria-pressed={form.trigger.type === value} onClick={() => setTriggerType(value)}>
                    <Icon size={16} />
                    <span>{label}<small>{hint}</small></span>
                  </button>
                ))}
              </div>
              {form.trigger.type === 'scheduled' && (
                <div style={{ marginTop: 12 }}>
                  <SchedulePicker schedule={form.schedule} onChange={(s) => setForm(prev => ({ ...prev, schedule: s }))} />
                </div>
              )}
            </Step>

            <Step
              mark="If"
              title="Only if"
              lead={form.conditions.length
                ? (form.conditionLogic === 'any' ? 'Runs when any condition matches.' : 'Runs only when every condition matches.')
                : 'Without conditions it runs every time.'}
              aside={(
                <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                  {form.conditions.length > 1 && (
                    <span className="gl-tabs" role="radiogroup" aria-label="Condition logic">
                      {[['all', 'All match'], ['any', 'Any matches']].map(([v, l]) => (
                        <button key={v} type="button" role="radio" className="gl-tab" aria-checked={form.conditionLogic === v} aria-selected={form.conditionLogic === v}
                          onClick={() => setForm(prev => ({ ...prev, conditionLogic: v }))}>{l}</button>
                      ))}
                    </span>
                  )}
                  <Chip>{form.conditions.length ? `${form.conditions.length} condition${form.conditions.length > 1 ? 's' : ''}` : 'Optional'}</Chip>
                </span>
              )}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <datalist id="wf-field-hints">{fieldHints.map((f) => <option key={f} value={f} />)}</datalist>
                {form.conditions.map((cond, i) => {
                  const op = operatorOf(cond.operator);
                  return (
                    <React.Fragment key={i}>
                      {i > 0 && <span className="tk-joiner">{form.conditionLogic === 'any' ? 'or' : 'and'}</span>}
                      <div className="tk-cond">
                        <input
                          className="gl-input"
                          list="wf-field-hints"
                          placeholder="Field, e.g. priority, repo, tags"
                          aria-label={`Condition ${i + 1} field`}
                          value={cond.field}
                          onChange={e => updateCondition(i, { field: e.target.value })}
                        />
                        <SelectBox value={op.value}
                          onChange={(v) => updateCondition(i, { operator: v, value: operatorOf(v).kind === 'bool' ? true : (operatorOf(v).kind === op.kind ? cond.value : '') })}
                          label={`Condition ${i + 1} operator`}>
                          {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </SelectBox>
                        {op.kind === 'bool' ? (
                          <SelectBox value={cond.value === false || cond.value === 'false' ? 'false' : 'true'}
                            onChange={(v) => updateCondition(i, { value: v === 'true' })} label={`Condition ${i + 1} value`}>
                            <option value="true">is present</option>
                            <option value="false">is missing</option>
                          </SelectBox>
                        ) : (
                          <input
                            className="gl-input"
                            placeholder={op.kind === 'list' ? 'high, urgent' : op.kind === 'regex' ? '^release/' : op.kind === 'number' ? '10 or 2026-01-31' : 'Value'}
                            aria-label={`Condition ${i + 1} value`}
                            value={conditionInputValue(cond)}
                            onChange={e => updateCondition(i, { value: e.target.value })}
                            spellCheck={op.kind !== 'regex'}
                          />
                        )}
                        <IconBtn label={`Remove condition ${i + 1}`} onClick={() => removeCondition(i)}><Trash2 size={14} /></IconBtn>
                      </div>
                    </React.Fragment>
                  );
                })}
                {form.conditions.length < MAX_CONDITIONS && (
                  <button type="button" className="tk-add" onClick={addCondition}><Plus size={14} />Add a condition</button>
                )}
              </div>
            </Step>

            <Step mark="Then" title="Then do this" lead="Steps run in order. Each step can use what earlier steps produced through the { } picker.">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {form.actions.map((action, i) => {
                  const A = actionOf(action.type);
                  const ctx = { triggerType: form.trigger.type, actions: form.actions, stepIndex: i };
                  return (
                    <Panel key={i}>
                      <div className="tk-stephead">
                        <span className="tk-mark" data-size="sm"><A.Icon size={14} /></span>
                        <span className="cd-label" style={{ whiteSpace: 'nowrap' }}>Step {i + 1}</span>
                        <div style={{ flex: 1, minWidth: 140 }}>
                          <SelectBox value={action.type} onChange={(v) => changeActionType(i, v)} label={`Step ${i + 1} action`} style={{ width: '100%' }}>
                            {ACTION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </SelectBox>
                        </div>
                        <IconBtn label={`Move step ${i + 1} up`} onClick={() => moveAction(i, -1)} disabled={i === 0}><ArrowUp size={14} /></IconBtn>
                        <IconBtn label={`Move step ${i + 1} down`} onClick={() => moveAction(i, 1)} disabled={i === form.actions.length - 1}><ArrowDown size={14} /></IconBtn>
                        {form.actions.length > 1 && (
                          <IconBtn label={`Remove step ${i + 1}`} onClick={() => removeAction(i)}><Trash2 size={14} /></IconBtn>
                        )}
                      </div>
                      <div className="tk-fields" style={{ marginBottom: 10 }}>
                        <Field label="Step id" error={idErrorAt(i)}
                          hint={action.id && !idErrorAt(i) && STEP_OUTPUTS[action.type]?.length ? `Later steps: {{steps.${action.id}.${STEP_OUTPUTS[action.type][0]}}}` : 'Lets later steps refer to this one'}>
                          <input className="gl-input" value={action.id || ''} aria-label={`Step ${i + 1} id`} spellCheck={false}
                            onChange={(e) => updateAction(i, { id: e.target.value.replace(/\s+/g, '') })} placeholder="e.g. release" />
                        </Field>
                        <Field label="Label" hint="Optional">
                          <input className="gl-input" value={action.name || ''} aria-label={`Step ${i + 1} label`}
                            onChange={(e) => updateAction(i, { name: e.target.value })} placeholder="What this step is for" />
                        </Field>
                      </div>
                      <ActionConfigFields action={action} onChange={updated => updateAction(i, updated)} ctx={ctx} />
                      <label className="tk-inline-check">
                        <input type="checkbox" checked={Boolean(action.continueOnError)} onChange={(e) => updateAction(i, { continueOnError: e.target.checked })} />
                        Keep going if this step fails
                      </label>
                    </Panel>
                  );
                })}
                {form.actions.length < MAX_STEPS ? (
                  <button type="button" className="tk-add" onClick={addAction}><Plus size={14} />Add another step</button>
                ) : <p className="cd-hint" style={{ margin: 0 }}>A workflow can have up to {MAX_STEPS} steps.</p>}
              </div>
            </Step>
          </div>

          <Panel title="In plain words" icon={Info}>
            <p className="tk-sentence">
              When <b>{lower(trigger.label)}</b>
              {form.trigger.type === 'scheduled' && form.schedule ? <> (<b>{describeSchedule(form.schedule)}</b>)</> : null}
              {filledConditions.length > 0 && (
                <>, if {filledConditions.map((c, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && (form.conditionLogic === 'any' ? ' or ' : ' and ')}<b>{c.field}</b> {operatorOf(c.operator).label} {operatorOf(c.operator).kind !== 'bool' && <b>{conditionInputValue(c)}</b>}
                  </React.Fragment>
                ))}</>
              )}
              , Oruinwan will {form.actions.length
                ? form.actions.map((a, i) => (
                  <React.Fragment key={i}>{i > 0 && (i === form.actions.length - 1 ? ', then ' : ', ')}<b>{lower(actionOf(a.type).label)}</b></React.Fragment>
                ))
                : 'do nothing yet'}.
              {' '}{form.isActive ? 'It starts running as soon as you save.' : 'It stays paused until you turn it on.'}
            </p>
          </Panel>

          {isEdit ? (
            <RunsPanel automationId={id} workspaceId={workspaceId} actionLabel={actionLabel} refreshKey={runsKey} />
          ) : (
            <p className="cd-hint" style={{ margin: 0 }}>After you create it you can test it with sample data, run it on demand and see its run history.</p>
          )}
        </form>

        {hasSide && (
          <aside className="tk-builder-side">
            <Panel flush title="Start from a template" icon={LayoutTemplate}
              action={<IconBtn label="Hide templates" onClick={() => setShowTemplates(false)}><X size={14} /></IconBtn>}>
              <p className="cd-hint" style={{ margin: 0, padding: '10px 14px 4px' }}>Fills in the steps for you. You can change anything after.</p>
              <div className="tk-tpl-list">
                {templates.map(t => {
                  const T = triggerOf(t.trigger?.type);
                  return (
                    <button key={t.id} type="button" className="tk-tpl" onClick={() => applyTemplate(t)}>
                      <span className="tk-mark" data-size="sm"><T.Icon size={14} /></span>
                      <span style={{ minWidth: 0 }}>
                        <strong>{t.name}</strong>
                        <span className="tk-tpl-cat">{t.category}{t.actions?.length > 1 ? ` · ${t.actions.length} steps` : ''}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </Panel>
          </aside>
        )}
      </div>

      {isEdit && (
        <RunDialog open={Boolean(runMode)} mode={runMode} onClose={() => setRunMode(null)} automationId={id} workspaceId={workspaceId}
          triggerType={form.trigger.type} actionLabel={actionLabel} onRan={() => setRunsKey((k) => k + 1)} />
      )}
    </DashPage>
  );
}
