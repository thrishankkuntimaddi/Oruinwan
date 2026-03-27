/**
 * AutomationsPage.jsx
 *
 * Workspace automation list page.
 * Shows all automations with enable/disable toggle, edit, delete.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getAutomations,
  deleteAutomation,
  updateAutomation
} from '../../services/automationsService';

// ─── Trigger label map ────────────────────────────────────────────────────────
const TRIGGER_LABELS = {
  'message.sent':      { label: 'Message sent',     icon: '💬', color: '#6366f1' },
  'task.created':      { label: 'Task created',     icon: '📋', color: '#10b981' },
  'task.completed':    { label: 'Task completed',   icon: '✅', color: '#10b981' },
  'meeting.completed': { label: 'Meeting ended',    icon: '📅', color: '#f59e0b' },
  'file.uploaded':     { label: 'File uploaded',    icon: '📁', color: '#8b5cf6' },
  'github.pr_merged':  { label: 'PR merged',        icon: '🔀', color: '#1f2937' },
  'webhook.received':  { label: 'Webhook received', icon: '🔗', color: '#06b6d4' },
  'scheduled':         { label: 'Scheduled',        icon: '⏰', color: '#f97316' },
};

const ACTION_LABELS = {
  send_message:       { label: 'Send message',       icon: '💬' },
  create_task:        { label: 'Create task',         icon: '📋' },
  assign_task:        { label: 'Assign task',         icon: '👤' },
  send_notification:  { label: 'Send notification',  icon: '🔔' },
  call_webhook:       { label: 'Call webhook',        icon: '🔗' },
  post_to_slack:      { label: 'Post to Slack',      icon: '💼' },
  trigger_ci_pipeline:{ label: 'Trigger CI',         icon: '⚙️' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function AutomationsPage() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();

  const [automations, setAutomations] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const fetchAutomations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await getAutomations(workspaceId);
      setAutomations(data.automations || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load automations');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => { fetchAutomations(); }, [fetchAutomations]);

  const handleToggle = async (automation) => {
    setTogglingId(automation._id);
    try {
      await updateAutomation(automation._id, {
        workspaceId,
        isActive: !automation.isActive
      });
      setAutomations(prev =>
        prev.map(a => a._id === automation._id ? { ...a, isActive: !a.isActive } : a)
      );
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update automation');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (automation) => {
    if (!window.confirm(`Delete "${automation.name}"? This cannot be undone.`)) return;
    setDeletingId(automation._id);
    try {
      await deleteAutomation(automation._id, workspaceId);
      setAutomations(prev => prev.filter(a => a._id !== automation._id));
      setTotal(t => t - 1);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete automation');
    } finally {
      setDeletingId(null);
    }
  };

  const triggerInfo = (type) => TRIGGER_LABELS[type] || { label: type, icon: '⚡', color: '#6b7280' };
  const actionLabel = (type) => ACTION_LABELS[type]?.label || type;
  const actionIcon  = (type) => ACTION_LABELS[type]?.icon  || '⚡';

  return (
    <div style={styles.page}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>⚡ Automations</h1>
          <p style={styles.subtitle}>
            Rule-based automations for your workspace.{' '}
            <span style={styles.count}>{total} total</span>
          </p>
        </div>
        <button
          style={styles.createBtn}
          onClick={() => navigate(`/workspace/${workspaceId}/automations/new`)}
        >
          + New Automation
        </button>
      </div>

      {/* ── States ─────────────────────────────────────────────────────────── */}
      {loading && (
        <div style={styles.centered}>
          <div style={styles.spinner} />
          <p style={{ color: '#94a3b8', marginTop: 12 }}>Loading automations...</p>
        </div>
      )}

      {!loading && error && (
        <div style={styles.errorBox}>
          <span>⚠️ {error}</span>
          <button onClick={fetchAutomations} style={styles.retryBtn}>Retry</button>
        </div>
      )}

      {!loading && !error && automations.length === 0 && (
        <div style={styles.empty}>
          <div style={styles.emptyIcon}>⚡</div>
          <h3 style={styles.emptyTitle}>No automations yet</h3>
          <p style={styles.emptyText}>
            Create your first automation to streamline repetitive workflows.
          </p>
          <button
            style={styles.createBtn}
            onClick={() => navigate(`/workspace/${workspaceId}/automations/new`)}
          >
            + New Automation
          </button>
        </div>
      )}

      {/* ── Automation List ─────────────────────────────────────────────────── */}
      {!loading && !error && automations.length > 0 && (
        <div style={styles.list}>
          {automations.map(automation => {
            const trig = triggerInfo(automation.trigger?.type);
            return (
              <div
                key={automation._id}
                style={{
                  ...styles.card,
                  opacity: automation.isActive ? 1 : 0.6,
                  borderLeft: `4px solid ${trig.color}`
                }}
              >
                {/* Left: info */}
                <div style={styles.cardLeft}>
                  <div style={styles.cardHeader}>
                    <span style={{ ...styles.triggerBadge, background: trig.color + '22', color: trig.color }}>
                      {trig.icon} {trig.label}
                    </span>
                    {automation.conditions?.length > 0 && (
                      <span style={styles.condBadge}>
                        {automation.conditions.length} condition{automation.conditions.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  <h3 style={styles.cardTitle}>{automation.name}</h3>
                  {automation.description && (
                    <p style={styles.cardDesc}>{automation.description}</p>
                  )}

                  {/* Actions list */}
                  <div style={styles.actionsList}>
                    {(automation.actions || []).map((action, i) => (
                      <span key={i} style={styles.actionChip}>
                        {actionIcon(action.type)} {actionLabel(action.type)}
                      </span>
                    ))}
                  </div>

                  {/* Meta */}
                  <div style={styles.meta}>
                    <span>Runs: {automation.runCount || 0}</span>
                    {automation.lastRunAt && (
                      <span>
                        Last: {new Date(automation.lastRunAt).toLocaleDateString()}
                      </span>
                    )}
                    {automation.createdBy?.username && (
                      <span>By: {automation.createdBy.username}</span>
                    )}
                    {automation.lastError && (
                      <span style={{ color: '#f87171' }}>⚠️ Last run had errors</span>
                    )}
                  </div>
                </div>

                {/* Right: controls */}
                <div style={styles.cardRight}>
                  {/* Toggle */}
                  <button
                    title={automation.isActive ? 'Disable' : 'Enable'}
                    onClick={() => handleToggle(automation)}
                    disabled={togglingId === automation._id}
                    style={{
                      ...styles.toggle,
                      background: automation.isActive ? '#10b981' : '#374151'
                    }}
                  >
                    {togglingId === automation._id ? '...' : automation.isActive ? 'ON' : 'OFF'}
                  </button>

                  {/* Edit */}
                  <button
                    title="Edit"
                    onClick={() =>
                      navigate(`/workspace/${workspaceId}/automations/${automation._id}/edit`)
                    }
                    style={styles.iconBtn}
                  >
                    ✏️
                  </button>

                  {/* Delete */}
                  <button
                    title="Delete"
                    onClick={() => handleDelete(automation)}
                    disabled={deletingId === automation._id}
                    style={{ ...styles.iconBtn, color: '#f87171' }}
                  >
                    {deletingId === automation._id ? '...' : '🗑️'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
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
    alignItems: 'flex-start',
    marginBottom: 32,
    flexWrap: 'wrap',
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    margin: 0,
    background: 'linear-gradient(135deg, #818cf8, #34d399)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  subtitle: {
    margin: '6px 0 0',
    color: '#94a3b8',
    fontSize: 14,
  },
  count: {
    background: 'rgba(99,102,241,0.15)',
    color: '#818cf8',
    padding: '2px 8px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
  },
  createBtn: {
    background: 'linear-gradient(135deg, #6366f1, #818cf8)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '10px 20px',
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
    boxShadow: '0 4px 15px rgba(99,102,241,0.4)',
    transition: 'transform 0.15s, box-shadow 0.15s',
  },
  centered: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '80px 0',
  },
  spinner: {
    width: 40,
    height: 40,
    border: '3px solid rgba(99,102,241,0.2)',
    borderTop: '3px solid #6366f1',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  errorBox: {
    background: 'rgba(248,113,113,0.1)',
    border: '1px solid rgba(248,113,113,0.3)',
    borderRadius: 12,
    padding: '16px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  retryBtn: {
    background: 'rgba(248,113,113,0.15)',
    color: '#f87171',
    border: '1px solid rgba(248,113,113,0.3)',
    borderRadius: 8,
    padding: '6px 14px',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '80px 24px',
    textAlign: 'center',
    gap: 12,
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: 8,
    filter: 'grayscale(0.3)',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: '#e2e8f0',
    margin: 0,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 14,
    maxWidth: 360,
    margin: 0,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  card: {
    background: 'rgba(30,41,59,0.8)',
    border: '1px solid rgba(148,163,184,0.1)',
    borderRadius: 14,
    padding: '20px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    backdropFilter: 'blur(8px)',
    transition: 'box-shadow 0.2s',
  },
  cardLeft: {
    flex: 1,
    minWidth: 0,
  },
  cardHeader: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  triggerBadge: {
    fontSize: 12,
    fontWeight: 600,
    padding: '3px 10px',
    borderRadius: 20,
    letterSpacing: 0.3,
  },
  condBadge: {
    fontSize: 11,
    color: '#94a3b8',
    background: 'rgba(148,163,184,0.1)',
    padding: '3px 8px',
    borderRadius: 20,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: '#f1f5f9',
    margin: '0 0 4px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  cardDesc: {
    fontSize: 13,
    color: '#94a3b8',
    margin: '0 0 10px',
    lineHeight: 1.5,
  },
  actionsList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  actionChip: {
    fontSize: 12,
    color: '#818cf8',
    background: 'rgba(99,102,241,0.1)',
    border: '1px solid rgba(99,102,241,0.2)',
    borderRadius: 20,
    padding: '3px 10px',
    fontWeight: 500,
  },
  meta: {
    display: 'flex',
    gap: 16,
    fontSize: 12,
    color: '#64748b',
    flexWrap: 'wrap',
  },
  cardRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 8,
    flexShrink: 0,
  },
  toggle: {
    border: 'none',
    borderRadius: 20,
    padding: '6px 14px',
    fontSize: 12,
    fontWeight: 700,
    color: '#fff',
    cursor: 'pointer',
    transition: 'background 0.2s',
    minWidth: 52,
    letterSpacing: 0.5,
  },
  iconBtn: {
    background: 'rgba(148,163,184,0.08)',
    border: '1px solid rgba(148,163,184,0.12)',
    borderRadius: 8,
    padding: '7px 10px',
    cursor: 'pointer',
    fontSize: 16,
    color: '#94a3b8',
    transition: 'background 0.15s',
  },
};
