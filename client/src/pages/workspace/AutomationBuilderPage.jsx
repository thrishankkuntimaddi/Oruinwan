import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Workflow, ArrowLeft, Check, Plus, Trash2, LayoutTemplate, MessageSquare, ListPlus, CheckCircle2,
  CalendarCheck, FileUp, GitMerge, Webhook, Clock, UserCheck, Bell, Zap, AlertTriangle, X, Info,
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
import '../toolkit/toolkit.css';

const TRIGGER_OPTIONS = [
  { value: 'task.created',      label: 'Task created',      hint: 'Someone adds a task',          Icon: ListPlus },
  { value: 'task.completed',    label: 'Task completed',    hint: 'A task is marked done',        Icon: CheckCircle2 },
  { value: 'message.sent',      label: 'Message sent',      hint: 'A message is posted',          Icon: MessageSquare },
  { value: 'meeting.completed', label: 'Meeting ended',     hint: 'A meeting finishes',           Icon: CalendarCheck },
  { value: 'file.uploaded',     label: 'File uploaded',     hint: 'Someone shares a file',        Icon: FileUp },
  { value: 'github.pr_merged',  label: 'PR merged',         hint: 'From GitHub',                  Icon: GitMerge },
  { value: 'webhook.received',  label: 'Webhook received',  hint: 'Another tool calls in',        Icon: Webhook },
  { value: 'scheduled',         label: 'On a schedule',     hint: 'Every few minutes or hours',   Icon: Clock },
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

const OPERATOR_OPTIONS = [
  { value: 'equals',     label: 'equals' },
  { value: 'not_equals', label: 'does not equal' },
  { value: 'contains',   label: 'contains' },
];

const SCHEDULE_OPTIONS = [
  { value: '15m',  label: 'Every 15 minutes' },
  { value: '30m',  label: 'Every 30 minutes' },
  { value: '1h',   label: 'Every hour' },
  { value: '6h',   label: 'Every 6 hours' },
  { value: '12h',  label: 'Every 12 hours' },
  { value: '24h',  label: 'Every 24 hours' },
];

const triggerOf = (v) => TRIGGER_OPTIONS.find((o) => o.value === v) || { label: v || 'Trigger', Icon: Zap };
const actionOf = (v) => ACTION_OPTIONS.find((o) => o.value === v) || { label: v || 'Step', Icon: Zap };
const lower = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);

/** One text input inside a labelled field. */
function TextField({ label, hint, value, onChange, placeholder, type = 'text' }) {
  return (
    <Field label={label} hint={hint}>
      <input className="gl-input" type={type} value={value || ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

function ActionConfigFields({ action, onChange }) {
  const update = (key, value) => onChange({ ...action, config: { ...action.config, [key]: value } });
  const c = action.config || {};

  switch (action.type) {
    case 'send_message': return (
      <div className="tk-fields">
        <TextField label="Channel ID" value={c.channelId} onChange={(v) => update('channelId', v)} placeholder="The channel to post in" />
        <TextField label="Message" value={c.text} onChange={(v) => update('text', v)} placeholder="Use {{task.title}} and similar" />
      </div>
    );
    case 'create_task': return (
      <div className="tk-fields">
        <TextField label="Task title" value={c.title} onChange={(v) => update('title', v)} placeholder="Use {{event.title}} and similar" />
        <Field label="Priority">
          <SelectBox value={c.priority || 'medium'} onChange={(v) => update('priority', v)} label="Priority">
            {['low', 'medium', 'high', 'critical'].map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </SelectBox>
        </Field>
      </div>
    );
    case 'assign_task': return (
      <div className="tk-fields">
        <TextField label="Task ID" value={c.taskId} onChange={(v) => update('taskId', v)} placeholder="Task to assign" />
        <TextField label="Assignee ID" value={c.assigneeId} onChange={(v) => update('assigneeId', v)} placeholder="Person who gets it" />
      </div>
    );
    case 'send_notification': return (
      <div className="tk-fields">
        <TextField label="Title" value={c.title} onChange={(v) => update('title', v)} placeholder="What the notification says" />
        <TextField label="Body" hint="Optional" value={c.body} onChange={(v) => update('body', v)} placeholder="More detail" />
        <TextField label="Recipient ID" hint="Leave blank to notify the person who caused the event" value={c.recipientId} onChange={(v) => update('recipientId', v)} placeholder="Recipient" />
      </div>
    );
    case 'call_webhook': return (
      <div className="tk-fields">
        <TextField label="Webhook URL" value={c.url} onChange={(v) => update('url', v)} placeholder="https://…" />
        <Field label="Method">
          <SelectBox value={c.method || 'POST'} onChange={(v) => update('method', v)} label="Method">
            {['POST', 'GET', 'PUT', 'PATCH'].map((m) => <option key={m} value={m}>{m}</option>)}
          </SelectBox>
        </Field>
      </div>
    );
    case 'post_to_slack': return (
      <div className="tk-fields">
        <TextField label="Slack incoming webhook URL" value={c.webhookUrl} onChange={(v) => update('webhookUrl', v)} placeholder="https://hooks.slack.com/…" />
        <TextField label="Message" value={c.text} onChange={(v) => update('text', v)} placeholder="What to post" />
      </div>
    );
    case 'trigger_ci_pipeline': return (
      <div className="tk-fields">
        <TextField label="CI pipeline URL" value={c.url} onChange={(v) => update('url', v)} placeholder="https://…" />
        <TextField label="Bearer token" hint="Optional" type="password" value={c.token} onChange={(v) => update('token', v)} placeholder="Token" />
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
  actions: [{ type: 'send_notification', config: {} }],
  schedule: null,
  isActive: true,
};

const FORM_ID = 'workflow-builder-form';

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
          actions:     a.actions || [{ type: 'send_notification', config: {} }],
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
      actions:    template.actions || [],
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
    setForm(prev => ({ ...prev, actions: [...prev.actions, { type: 'send_notification', config: {} }] }));

  const updateAction = (i, updates) =>
    setForm(prev => ({ ...prev, actions: prev.actions.map((a, idx) => idx === i ? { ...a, ...updates } : a) }));

  const removeAction = (i) =>
    setForm(prev => ({ ...prev, actions: prev.actions.filter((_, idx) => idx !== i) }));

  const backToList = () => navigate(`/workspace/${workspaceId}/automations`);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setNameError('Give the workflow a name so you can find it later');
      document.getElementById('wf-name')?.focus();
      return;
    }
    if (!form.actions.length) return setError('Add at least one step under “Then”');

    setSaving(true);
    setError(null);
    setNameError(null);

    try {
      const payload = { ...form, workspaceId };
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
  const schedule = SCHEDULE_OPTIONS.find((o) => o.value === (form.schedule?.expression || '1h'));
  const filledConditions = form.conditions.filter((c) => c.field && String(c.value ?? '').length);
  const hasSide = !isEdit && showTemplates && templates.length > 0;

  const head = (
    <PageHead
      eyebrow={activeWorkspace?.name ? `${activeWorkspace.name} · Workflows` : 'Workflows'}
      title={isEdit ? 'Edit workflow' : 'New workflow'}
      icon={Workflow}
      lead="Pick what starts it, narrow it down if you need to, then choose what Oruinwan does."
      actions={(
        <>
          <Btn variant="ghost" icon={ArrowLeft} onClick={backToList}>Workflows</Btn>
          {!isEdit && templates.length > 0 && (
            <Btn variant="ghost" icon={LayoutTemplate} onClick={() => setShowTemplates((v) => !v)} aria-pressed={showTemplates}>
              {showTemplates ? 'Hide templates' : 'Templates'}
            </Btn>
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
                <div style={{ marginTop: 12, maxWidth: 280 }}>
                  <Field label="Run every">
                    <SelectBox
                      value={form.schedule?.expression || '1h'}
                      onChange={(v) => setForm(prev => ({ ...prev, schedule: { type: 'interval', expression: v } }))}
                      label="Run every"
                    >
                      {SCHEDULE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </SelectBox>
                  </Field>
                </div>
              )}
            </Step>

            <Step
              mark="If"
              title="Only if"
              lead={form.conditions.length ? 'Every condition must match for the workflow to run.' : 'Without conditions it runs every time.'}
              aside={<Chip>{form.conditions.length ? `${form.conditions.length} condition${form.conditions.length > 1 ? 's' : ''}` : 'Optional'}</Chip>}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {form.conditions.map((cond, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <span className="tk-joiner">and</span>}
                    <div className="tk-cond">
                      <input
                        className="gl-input"
                        placeholder="Field, e.g. repo, channel, status"
                        aria-label={`Condition ${i + 1} field`}
                        value={cond.field}
                        onChange={e => updateCondition(i, { field: e.target.value })}
                      />
                      <SelectBox value={cond.operator} onChange={(v) => updateCondition(i, { operator: v })} label={`Condition ${i + 1} operator`}>
                        {OPERATOR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </SelectBox>
                      <input
                        className="gl-input"
                        placeholder="Value"
                        aria-label={`Condition ${i + 1} value`}
                        value={cond.value}
                        onChange={e => updateCondition(i, { value: e.target.value })}
                      />
                      <IconBtn label={`Remove condition ${i + 1}`} onClick={() => removeCondition(i)}><Trash2 size={14} /></IconBtn>
                    </div>
                  </React.Fragment>
                ))}
                <button type="button" className="tk-add" onClick={addCondition}><Plus size={14} />Add a condition</button>
              </div>
            </Step>

            <Step mark="Then" title="Then do this" lead="Steps run in order, top to bottom.">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {form.actions.map((action, i) => {
                  const A = actionOf(action.type);
                  return (
                    <Panel key={i}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <span className="tk-mark" data-size="sm"><A.Icon size={14} /></span>
                        <span className="cd-label" style={{ whiteSpace: 'nowrap' }}>Step {i + 1}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <SelectBox value={action.type} onChange={(v) => updateAction(i, { type: v, config: {} })} label={`Step ${i + 1} action`} style={{ width: '100%' }}>
                            {ACTION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </SelectBox>
                        </div>
                        {form.actions.length > 1 && (
                          <IconBtn label={`Remove step ${i + 1}`} onClick={() => removeAction(i)}><Trash2 size={14} /></IconBtn>
                        )}
                      </div>
                      <ActionConfigFields action={action} onChange={updated => updateAction(i, updated)} />
                    </Panel>
                  );
                })}
                <button type="button" className="tk-add" onClick={addAction}><Plus size={14} />Add another step</button>
              </div>
            </Step>
          </div>

          <Panel title="In plain words" icon={Info}>
            <p className="tk-sentence">
              When <b>{lower(trigger.label)}</b>
              {form.trigger.type === 'scheduled' && schedule ? <> (<b>{lower(schedule.label)}</b>)</> : null}
              {filledConditions.length > 0 && (
                <>, if {filledConditions.map((c, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && ' and '}<b>{c.field}</b> {OPERATOR_OPTIONS.find((o) => o.value === c.operator)?.label || c.operator} <b>{String(c.value)}</b>
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
                        <span className="tk-tpl-cat">{t.category}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </Panel>
          </aside>
        )}
      </div>
    </DashPage>
  );
}
