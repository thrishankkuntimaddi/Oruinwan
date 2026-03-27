/**
 * AutomationBuilderPage.jsx
 *
 * Form-based automation builder (create & edit).
 * Three sections: Trigger → Conditions → Actions
 * Includes a templates panel for quick-start.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getTemplates,
  createAutomation,
  getAutomation,
  updateAutomation
} from '../../services/automationsService';

// ─── Options ──────────────────────────────────────────────────────────────────

const TRIGGER_OPTIONS = [
  { value: 'task.created',      label: '📋 Task created' },
  { value: 'task.completed',    label: '✅ Task completed' },
  { value: 'message.sent',      label: '💬 Message sent' },
  { value: 'meeting.completed', label: '📅 Meeting ended' },
  { value: 'file.uploaded',     label: '📁 File uploaded' },
  { value: 'github.pr_merged',  label: '🔀 PR merged (GitHub)' },
  { value: 'webhook.received',  label: '🔗 Webhook received' },
  { value: 'scheduled',         label: '⏰ Scheduled (time-based)' },
];

const ACTION_OPTIONS = [
  { value: 'send_message',        label: '💬 Send message' },
  { value: 'create_task',         label: '📋 Create task' },
  { value: 'assign_task',         label: '👤 Assign task' },
  { value: 'send_notification',   label: '🔔 Send notification' },
  { value: 'call_webhook',        label: '🔗 Call webhook' },
  { value: 'post_to_slack',       label: '💼 Post to Slack' },
  { value: 'trigger_ci_pipeline', label: '⚙️ Trigger CI pipeline' },
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

// ─── Action Config Fields ─────────────────────────────────────────────────────

function ActionConfigFields({ action, onChange }) {
  const update = (key, value) => onChange({ ...action, config: { ...action.config, [key]: value } });

  switch (action.type) {
    case 'send_message': return (
      <div style={styles.configGrid}>
        <input placeholder="Channel ID" value={action.config?.channelId || ''} onChange={e => update('channelId', e.target.value)} style={styles.input} />
        <input placeholder="Message text (use {{task.title}} etc.)" value={action.config?.text || ''} onChange={e => update('text', e.target.value)} style={styles.input} />
      </div>
    );
    case 'create_task': return (
      <div style={styles.configGrid}>
        <input placeholder="Task title (use {{event.title}} etc.)" value={action.config?.title || ''} onChange={e => update('title', e.target.value)} style={styles.input} />
        <select value={action.config?.priority || 'medium'} onChange={e => update('priority', e.target.value)} style={styles.select}>
          {['low','medium','high','critical'].map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
    );
    case 'assign_task': return (
      <div style={styles.configGrid}>
        <input placeholder="Task ID" value={action.config?.taskId || ''} onChange={e => update('taskId', e.target.value)} style={styles.input} />
        <input placeholder="Assignee ID" value={action.config?.assigneeId || ''} onChange={e => update('assigneeId', e.target.value)} style={styles.input} />
      </div>
    );
    case 'send_notification': return (
      <div style={styles.configGrid}>
        <input placeholder="Notification title" value={action.config?.title || ''} onChange={e => update('title', e.target.value)} style={styles.input} />
        <input placeholder="Body (optional)" value={action.config?.body || ''} onChange={e => update('body', e.target.value)} style={styles.input} />
        <input placeholder="Recipient ID (leave blank for event user)" value={action.config?.recipientId || ''} onChange={e => update('recipientId', e.target.value)} style={styles.input} />
      </div>
    );
    case 'call_webhook': return (
      <div style={styles.configGrid}>
        <input placeholder="Webhook URL" value={action.config?.url || ''} onChange={e => update('url', e.target.value)} style={styles.input} />
        <select value={action.config?.method || 'POST'} onChange={e => update('method', e.target.value)} style={styles.select}>
          {['POST','GET','PUT','PATCH'].map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
    );
    case 'post_to_slack': return (
      <div style={styles.configGrid}>
        <input placeholder="Slack Incoming Webhook URL" value={action.config?.webhookUrl || ''} onChange={e => update('webhookUrl', e.target.value)} style={styles.input} />
        <input placeholder="Message text" value={action.config?.text || ''} onChange={e => update('text', e.target.value)} style={styles.input} />
      </div>
    );
    case 'trigger_ci_pipeline': return (
      <div style={styles.configGrid}>
        <input placeholder="CI pipeline URL" value={action.config?.url || ''} onChange={e => update('url', e.target.value)} style={styles.input} />
        <input placeholder="Bearer token (optional)" value={action.config?.token || ''} onChange={e => update('token', e.target.value)} style={styles.input} type="password" />
      </div>
    );
    default: return null;
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

const EMPTY_FORM = {
  name: '',
  description: '',
  trigger: { type: 'task.created', config: {} },
  conditions: [],
  actions: [{ type: 'send_notification', config: {} }],
  schedule: null,
  isActive: true,
};

export default function AutomationBuilderPage() {
  const { workspaceId, id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState(EMPTY_FORM);
  const [templates, setTemplates] = useState([]);
  const [showTemplates, setShowTemplates] = useState(!isEdit);
  const [saving, setSaving] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(isEdit);
  const [error, setError] = useState(null);

  // Load existing automation for edit mode
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
        setError(err.response?.data?.message || 'Failed to load automation');
      } finally {
        setLoadingExisting(false);
      }
    })();
  }, [id, isEdit, workspaceId]);

  // Load templates
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
    setShowTemplates(false);
  }, []);

  // ── Form field helpers ────────────────────────────────────────────────────

  const setTriggerType = (type) => {
    const needsSchedule = type === 'scheduled';
    setForm(prev => ({
      ...prev,
      trigger:  { type, config: {} },
      schedule: needsSchedule ? (prev.schedule || { type: 'interval', expression: '1h' }) : null,
    }));
  };

  const addCondition = () =>
    setForm(prev => ({
      ...prev,
      conditions: [...prev.conditions, { field: '', operator: 'equals', value: '' }]
    }));

  const updateCondition = (i, updates) =>
    setForm(prev => ({
      ...prev,
      conditions: prev.conditions.map((c, idx) => idx === i ? { ...c, ...updates } : c)
    }));

  const removeCondition = (i) =>
    setForm(prev => ({ ...prev, conditions: prev.conditions.filter((_, idx) => idx !== i) }));

  const addAction = () =>
    setForm(prev => ({
      ...prev,
      actions: [...prev.actions, { type: 'send_notification', config: {} }]
    }));

  const updateAction = (i, updates) =>
    setForm(prev => ({
      ...prev,
      actions: prev.actions.map((a, idx) => idx === i ? { ...a, ...updates } : a)
    }));

  const removeAction = (i) =>
    setForm(prev => ({ ...prev, actions: prev.actions.filter((_, idx) => idx !== i) }));

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim())          return setError('Automation name is required');
    if (!form.actions.length)       return setError('At least one action is required');

    setSaving(true);
    setError(null);

    try {
      const payload = { ...form, workspaceId };
      if (isEdit) {
        await updateAutomation(id, payload);
      } else {
        await createAutomation(payload);
      }
      navigate(`/workspace/${workspaceId}/automations`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save automation');
      setSaving(false);
    }
  };

  if (loadingExisting) return (
    <div style={{ ...styles.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={styles.spinner} />
    </div>
  );

  return (
    <div style={styles.page}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={styles.header}>
        <div>
          <button onClick={() => navigate(`/workspace/${workspaceId}/automations`)} style={styles.backBtn}>
            ← Back to Automations
          </button>
          <h1 style={styles.title}>{isEdit ? '✏️ Edit Automation' : '⚡ New Automation'}</h1>
          <p style={styles.subtitle}>Set up a trigger → condition → action rule</p>
        </div>
        {!isEdit && (
          <button
            style={styles.templateToggleBtn}
            onClick={() => setShowTemplates(v => !v)}
          >
            {showTemplates ? 'Hide Templates' : '📦 Quick Start Templates'}
          </button>
        )}
      </div>

      <div style={styles.layout}>
        {/* ── Templates Panel ─────────────────────────────────────────────── */}
        {showTemplates && templates.length > 0 && (
          <aside style={styles.sidebar}>
            <h3 style={styles.sidebarTitle}>📦 Templates</h3>
            <p style={styles.sidebarSub}>Click to pre-fill the form</p>
            <div style={styles.templateList}>
              {templates.map(t => (
                <button key={t.id} onClick={() => applyTemplate(t)} style={styles.templateCard}>
                  <span style={styles.templateIcon}>{t.icon}</span>
                  <div>
                    <div style={styles.templateName}>{t.name}</div>
                    <div style={styles.templateCategory}>{t.category}</div>
                  </div>
                </button>
              ))}
            </div>
          </aside>
        )}

        {/* ── Form ────────────────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} style={styles.form}>
          {error && <div style={styles.errorBox}>⚠️ {error}</div>}

          {/* ── Basic Info ─────────────────────────────────────────────────── */}
          <section style={styles.section}>
            <div style={styles.sectionHeader}>
              <span style={styles.sectionNum}>1</span>
              <div>
                <h2 style={styles.sectionTitle}>Basic Info</h2>
                <p style={styles.sectionDesc}>Name and describe this automation</p>
              </div>
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Name *</label>
              <input
                value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. PR merged → Post in #engineering"
                style={styles.input}
                required
              />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Description (optional)</label>
              <input
                value={form.description}
                onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="What does this automation do?"
                style={styles.input}
              />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.checkLabel}>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={e => setForm(prev => ({ ...prev, isActive: e.target.checked }))}
                  style={{ marginRight: 8 }}
                />
                Active (automation will run when triggered)
              </label>
            </div>
          </section>

          {/* ── Trigger ───────────────────────────────────────────────────── */}
          <section style={styles.section}>
            <div style={styles.sectionHeader}>
              <span style={styles.sectionNum}>2</span>
              <div>
                <h2 style={styles.sectionTitle}>Trigger</h2>
                <p style={styles.sectionDesc}>When should this automation run?</p>
              </div>
            </div>
            <select
              value={form.trigger.type}
              onChange={e => setTriggerType(e.target.value)}
              style={styles.select}
            >
              {TRIGGER_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            {form.trigger.type === 'scheduled' && (
              <div style={{ marginTop: 12 }}>
                <label style={styles.label}>Run every</label>
                <select
                  value={form.schedule?.expression || '1h'}
                  onChange={e => setForm(prev => ({
                    ...prev,
                    schedule: { type: 'interval', expression: e.target.value }
                  }))}
                  style={styles.select}
                >
                  {SCHEDULE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            )}
          </section>

          {/* ── Conditions ────────────────────────────────────────────────── */}
          <section style={styles.section}>
            <div style={styles.sectionHeader}>
              <span style={styles.sectionNum}>3</span>
              <div>
                <h2 style={styles.sectionTitle}>Conditions <span style={styles.optionalTag}>(optional)</span></h2>
                <p style={styles.sectionDesc}>All conditions must match for the automation to run</p>
              </div>
            </div>

            {form.conditions.length === 0 && (
              <p style={styles.emptyHint}>No conditions — automation will always run on trigger.</p>
            )}

            {form.conditions.map((cond, i) => (
              <div key={i} style={styles.condRow}>
                <input
                  placeholder="Field (e.g. repo, channel, status)"
                  value={cond.field}
                  onChange={e => updateCondition(i, { field: e.target.value })}
                  style={{ ...styles.input, flex: 1 }}
                />
                <select
                  value={cond.operator}
                  onChange={e => updateCondition(i, { operator: e.target.value })}
                  style={{ ...styles.select, flex: 0, minWidth: 140 }}
                >
                  {OPERATOR_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <input
                  placeholder="Value"
                  value={cond.value}
                  onChange={e => updateCondition(i, { value: e.target.value })}
                  style={{ ...styles.input, flex: 1 }}
                />
                <button type="button" onClick={() => removeCondition(i)} style={styles.removeBtn}>✕</button>
              </div>
            ))}

            <button type="button" onClick={addCondition} style={styles.addBtn}>
              + Add Condition
            </button>
          </section>

          {/* ── Actions ───────────────────────────────────────────────────── */}
          <section style={styles.section}>
            <div style={styles.sectionHeader}>
              <span style={styles.sectionNum}>4</span>
              <div>
                <h2 style={styles.sectionTitle}>Actions *</h2>
                <p style={styles.sectionDesc}>What should happen when the automation runs?</p>
              </div>
            </div>

            {form.actions.map((action, i) => (
              <div key={i} style={styles.actionBlock}>
                <div style={styles.actionHeader}>
                  <select
                    value={action.type}
                    onChange={e => updateAction(i, { type: e.target.value, config: {} })}
                    style={{ ...styles.select, flex: 1 }}
                  >
                    {ACTION_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  {form.actions.length > 1 && (
                    <button type="button" onClick={() => removeAction(i)} style={styles.removeBtn}>✕</button>
                  )}
                </div>
                <ActionConfigFields
                  action={action}
                  onChange={updated => updateAction(i, updated)}
                />
              </div>
            ))}

            <button type="button" onClick={addAction} style={styles.addBtn}>
              + Add Action
            </button>
          </section>

          {/* ── Submit ────────────────────────────────────────────────────── */}
          <div style={styles.submitRow}>
            <button
              type="button"
              onClick={() => navigate(`/workspace/${workspaceId}/automations`)}
              style={styles.cancelBtn}
            >
              Cancel
            </button>
            <button type="submit" disabled={saving} style={styles.submitBtn}>
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Automation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
    padding: '32px',
    color: '#e2e8f0',
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 32,
    flexWrap: 'wrap',
    gap: 12,
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: '#818cf8',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    padding: '0 0 8px',
    display: 'block',
  },
  title: {
    fontSize: 26,
    fontWeight: 700,
    margin: '0 0 4px',
    background: 'linear-gradient(135deg, #818cf8, #34d399)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  subtitle: { fontSize: 14, color: '#64748b', margin: 0 },
  templateToggleBtn: {
    background: 'rgba(99,102,241,0.12)',
    color: '#818cf8',
    border: '1px solid rgba(99,102,241,0.25)',
    borderRadius: 10,
    padding: '9px 16px',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
  },
  layout: { display: 'flex', gap: 24, alignItems: 'flex-start' },
  sidebar: {
    width: 260,
    flexShrink: 0,
    background: 'rgba(30,41,59,0.8)',
    border: '1px solid rgba(148,163,184,0.1)',
    borderRadius: 14,
    padding: 20,
    backdropFilter: 'blur(8px)',
  },
  sidebarTitle: { fontSize: 15, fontWeight: 700, color: '#e2e8f0', margin: '0 0 4px' },
  sidebarSub:   { fontSize: 12, color: '#64748b', margin: '0 0 16px' },
  templateList: { display: 'flex', flexDirection: 'column', gap: 8 },
  templateCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: 'rgba(148,163,184,0.05)',
    border: '1px solid rgba(148,163,184,0.1)',
    borderRadius: 10,
    padding: '10px 12px',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background 0.15s, border-color 0.15s',
    width: '100%',
  },
  templateIcon:     { fontSize: 20, flexShrink: 0 },
  templateName:     { fontSize: 12, fontWeight: 600, color: '#cbd5e1', lineHeight: 1.3 },
  templateCategory: { fontSize: 11, color: '#64748b', marginTop: 2 },
  form: { flex: 1, display: 'flex', flexDirection: 'column', gap: 20 },
  section: {
    background: 'rgba(30,41,59,0.8)',
    border: '1px solid rgba(148,163,184,0.08)',
    borderRadius: 14,
    padding: 24,
    backdropFilter: 'blur(8px)',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 20,
  },
  sectionNum: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #6366f1, #818cf8)',
    color: '#fff',
    fontWeight: 700,
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: '#f1f5f9', margin: '0 0 3px' },
  sectionDesc:  { fontSize: 13, color: '#64748b', margin: 0 },
  optionalTag:  { fontSize: 12, color: '#475569', fontWeight: 400 },
  fieldGroup:   { marginBottom: 14 },
  label:        { display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6 },
  checkLabel:   { fontSize: 13, color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center' },
  input: {
    display: 'block',
    width: '100%',
    background: 'rgba(15,23,42,0.6)',
    border: '1px solid rgba(148,163,184,0.15)',
    borderRadius: 8,
    color: '#e2e8f0',
    fontSize: 14,
    padding: '9px 12px',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  select: {
    display: 'block',
    width: '100%',
    background: 'rgba(15,23,42,0.8)',
    border: '1px solid rgba(148,163,184,0.15)',
    borderRadius: 8,
    color: '#e2e8f0',
    fontSize: 14,
    padding: '9px 12px',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  condRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  configGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginTop: 10,
    paddingLeft: 12,
    borderLeft: '2px solid rgba(99,102,241,0.3)',
  },
  actionBlock: {
    background: 'rgba(15,23,42,0.4)',
    border: '1px solid rgba(148,163,184,0.1)',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  actionHeader: { display: 'flex', gap: 8, alignItems: 'center' },
  removeBtn: {
    background: 'rgba(248,113,113,0.1)',
    border: '1px solid rgba(248,113,113,0.2)',
    borderRadius: 6,
    color: '#f87171',
    cursor: 'pointer',
    padding: '6px 10px',
    fontSize: 12,
    fontWeight: 700,
    flexShrink: 0,
  },
  addBtn: {
    background: 'rgba(99,102,241,0.08)',
    border: '1px dashed rgba(99,102,241,0.3)',
    borderRadius: 8,
    color: '#818cf8',
    cursor: 'pointer',
    padding: '9px 16px',
    fontSize: 13,
    fontWeight: 600,
    width: '100%',
    marginTop: 4,
  },
  emptyHint: { color: '#475569', fontSize: 13, fontStyle: 'italic', margin: '0 0 12px' },
  errorBox: {
    background: 'rgba(248,113,113,0.1)',
    border: '1px solid rgba(248,113,113,0.3)',
    borderRadius: 10,
    padding: '12px 16px',
    color: '#f87171',
    fontSize: 14,
  },
  submitRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 12,
    paddingTop: 4,
  },
  cancelBtn: {
    background: 'rgba(148,163,184,0.08)',
    border: '1px solid rgba(148,163,184,0.15)',
    borderRadius: 10,
    color: '#94a3b8',
    cursor: 'pointer',
    padding: '11px 24px',
    fontSize: 14,
    fontWeight: 600,
  },
  submitBtn: {
    background: 'linear-gradient(135deg, #6366f1, #818cf8)',
    border: 'none',
    borderRadius: 10,
    color: '#fff',
    cursor: 'pointer',
    padding: '11px 28px',
    fontSize: 14,
    fontWeight: 700,
    boxShadow: '0 4px 14px rgba(99,102,241,0.45)',
    transition: 'opacity 0.15s',
  },
  spinner: {
    width: 40,
    height: 40,
    border: '3px solid rgba(99,102,241,0.2)',
    borderTop: '3px solid #6366f1',
    borderRadius: '50%',
  },
};
