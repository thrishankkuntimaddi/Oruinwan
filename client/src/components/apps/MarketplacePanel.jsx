import React, { useState, useEffect, useCallback } from "react";
import {
  Search, Puzzle, CheckCircle2, Star, StarHalf, Download, ShoppingBag,
  RefreshCw, ChevronRight, MessageSquare, X, Trash2, AlertTriangle, Lock
} from "lucide-react";
import api from '@services/api';
import { useToast } from '../../contexts/ToastContext';
import { PanelEmpty } from '../layout/WorkspacePanel';
import '../../styles/gloss.css';
import '../../styles/gloss-x-panels.css';

const FONT = 'var(--font)';

const errorMessage = (err, fallback) => err?.response?.data?.message || err?.response?.data?.error || fallback;

const MARKETPLACE_CATEGORIES = [
  { id: "all", label: "All" },
  { id: "productivity", label: "Productivity" },
  { id: "communication", label: "Communication" },
  { id: "developer", label: "Developer" },
  { id: "automation", label: "Automation" },
  { id: "analytics", label: "Analytics" },
];

function StarRating({ rating, size = 12 }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
      {Array.from({ length: full }).map((_, i) => (
        <Star key={`f${i}`} size={size} style={{ color: 'var(--accent)', fill: 'var(--accent)' }} />
      ))}
      {half && <StarHalf size={size} style={{ color: 'var(--accent)', fill: 'var(--accent)' }} />}
      {Array.from({ length: empty }).map((_, i) => (
        <Star key={`e${i}`} size={size} style={{ color: 'var(--border-accent)' }} />
      ))}
    </span>
  );
}

function ReviewModal({ app, onClose, onSubmitted }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!rating) return setError("Please select a rating");
    setSubmitting(true);
    setError("");
    try {
      await api.post("/api/marketplace/review", { appId: app._id, rating, comment });
      onSubmitted?.();
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Failed to submit review"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, backgroundColor: 'var(--bg-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-label={`Review ${app.name}`} className="gl-card" style={{ width: '100%', maxWidth: '440px', fontFamily: FONT, boxShadow: 'var(--gl-spec-strong), var(--gl-drop)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div>
            <h3 style={{ fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontSize: '14px' }}>Review {app.name}</h3>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '3px 0 0' }}>Share your experience with the team</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="gl-icon-btn">
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '8px' }}>Rating</label>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} onClick={() => setRating(n)} style={{ padding: '2px', background: 'none', border: 'none', cursor: 'pointer' }}>
                  <Star size={22} style={{ color: (hover || rating) >= n ? 'var(--accent)' : 'var(--border-accent)', fill: (hover || rating) >= n ? 'var(--accent)' : 'none' }} />
                </button>
              ))}
              {rating > 0 && <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>{["", "Poor", "Fair", "Good", "Great", "Excellent"][rating]}</span>}
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '8px' }}>Comment <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3} maxLength={1000} placeholder="What did you like or dislike?"
              style={{ width: '100%', padding: '8px 10px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '2px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: FONT }}
              onFocus={e => (e.target.style.borderColor = 'var(--border-accent)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border-default)')}
            />
          </div>
          {error && <p style={{ fontSize: '12px', color: 'var(--state-danger)', margin: 0 }}>{error}</p>}
        </div>
        <div style={{ display: 'flex', gap: '8px', padding: '0 20px 16px' }}>
          <button type="button" onClick={onClose} className="gl-btn" style={{ flex: 1 }}>Cancel</button>
          <button type="button" onClick={submit} disabled={submitting || !rating} className="gl-btn gl-btn--primary" style={{ flex: 1 }}>
            {submitting ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />Submitting…</> : "Submit Review"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MarketplaceAppCard({ app, canManage, busy, onInstall, onUninstall, onReview }) {
  const installed = !!app.installed;

  return (
    <div data-testid="marketplace-app-card" className="gl-card gl-x-hovercard" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
          {app.iconUrl ? (
            <img src={app.iconUrl} alt="" className="gl-x-app-icon" />
          ) : (
            <div className="gl-x-app-icon">
              <Puzzle size={18} />
            </div>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <h3 style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{app.name}</h3>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '3px 0 0' }}>{app.developer} · v{app.version}</p>
          </div>
          {installed && (
            <span className="gl-x-badge gl-x-badge--ok">
              <CheckCircle2 size={10} />Installed
            </span>
          )}
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.55, margin: '0 0 12px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{app.description}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', marginTop: 'auto' }}>
          <StarRating rating={app.avgRating || 0} />
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {app.avgRating > 0 ? <>{app.avgRating.toFixed(1)} ({app.reviewCount})</> : "No reviews yet"}
          </span>
          {app.installCount > 0 && <span title="Workspaces using this app" style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}><Download size={10} />{app.installCount}</span>}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {canManage ? (
            installed ? (
              <button type="button" onClick={() => onUninstall(app)} disabled={busy} className="gl-btn gl-btn--sm gl-x-danger" style={{ flex: 1 }}>
                {busy ? <><RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} />Removing…</> : <><Trash2 size={11} />Uninstall</>}
              </button>
            ) : (
              <button type="button" onClick={() => onInstall(app)} disabled={busy} className="gl-btn gl-btn--sm gl-btn--primary" style={{ flex: 1 }}>
                {busy ? <><RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} />Installing…</> : <><Download size={11} />Install</>}
              </button>
            )
          ) : (
            <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text-muted)' }}>
              {installed ? 'Installed in this workspace' : 'Not installed'}
            </span>
          )}
          <button type="button" onClick={() => onReview(app)} className="gl-btn gl-btn--sm" style={{ padding: '0 9px' }}
            title="Write a review" aria-label={`Review ${app.name}`}>
            <MessageSquare size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}


/**
 * The workspace app marketplace: search, categories, install state per workspace and
 * install/uninstall (workspace owners/admins only). Shared by the Apps page and the
 * Developer Platform so both show the same data and behave the same.
 */
export default function MarketplacePanel({ workspaceId, canManage }) {
  const { showToast } = useToast();
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [reviewApp, setReviewApp] = useState(null);
  const [busy, setBusy] = useState({});

  const fetchApps = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit: 18 };
      if (workspaceId) params.workspaceId = workspaceId;
      if (category !== "all") params.category = category;
      if (search.trim()) params.q = search.trim();
      const res = await api.get("/api/marketplace/apps", { params });
      setApps(res.data.apps || []);
      setTotalPages(res.data.totalPages || 1);
    } catch (err) {
      setApps([]);
      setError(errorMessage(err, "Could not load the marketplace"));
    } finally {
      setLoading(false);
    }
  }, [page, category, search, workspaceId]);

  useEffect(() => {
    const t = setTimeout(fetchApps, search ? 400 : 0);
    return () => clearTimeout(t);
  }, [fetchApps, search]);

  const setInstalled = (appId, installed) => setApps(prev => prev.map(a => (
    a._id === appId
      ? { ...a, installed, installCount: Math.max(0, (a.installCount || 0) + (installed ? 1 : -1)) }
      : a
  )));

  const runAction = async (app, action) => {
    setBusy(b => ({ ...b, [app._id]: true }));
    try {
      await api.post(`/api/marketplace/${action}`, { appId: app._id, workspaceId });
      setInstalled(app._id, action === 'install');
      showToast(action === 'install' ? `${app.name} installed` : `${app.name} uninstalled`, 'success');
    } catch (err) {
      const status = err?.response?.status;
      if (action === 'install' && status === 409) setInstalled(app._id, true);
      else if (action === 'uninstall' && status === 404) setInstalled(app._id, false);
      showToast(errorMessage(err, `Failed to ${action} ${app.name}`), 'error');
    } finally {
      setBusy(b => ({ ...b, [app._id]: false }));
    }
  };

  return (
    <div style={{ fontFamily: FONT }}>
      {reviewApp && (
        <ReviewModal app={reviewApp} onClose={() => setReviewApp(null)}
          onSubmitted={() => { showToast("Review submitted", "success"); fetchApps(); }} />
      )}

      <div className="gl-search" style={{ marginBottom: '12px' }}>
        <Search size={14} />
        <input type="text" className="gl-input" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search marketplace…" aria-label="Search marketplace"
          style={{ height: '38px', fontSize: '13px' }} />
      </div>
      <div className="gl-x-chips gl-x-chips--wrap" style={{ marginBottom: '20px' }}>
        {MARKETPLACE_CATEGORIES.map(cat => (
          <button key={cat.id} type="button" className={`gl-x-chip gl-x-chip--lg${category === cat.id ? ' is-active' : ''}`} aria-pressed={category === cat.id}
            onClick={() => { setCategory(cat.id); setPage(1); }}>{cat.label}</button>
        ))}
      </div>

      {canManage === false && (
        <div className="gl-card gl-x-note" style={{ alignItems: 'center', marginBottom: '16px' }}>
          <Lock size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          Only workspace owners and admins can install or uninstall apps.
        </div>
      )}

      {loading ? (
        <div className="gl-x-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="gl-x-skeleton" />
          ))}
        </div>
      ) : error ? (
        <div role="alert" style={{ textAlign: 'center', padding: '48px 0' }}>
          <AlertTriangle size={24} style={{ color: 'var(--state-danger)', marginBottom: '12px' }} />
          <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>Couldn’t load apps</p>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 14px' }}>{error}</p>
          <button type="button" onClick={fetchApps} className="gl-btn">
            <RefreshCw size={12} />Retry
          </button>
        </div>
      ) : apps.length === 0 ? (
        <PanelEmpty icon={ShoppingBag} title="No apps found"
          text={search.trim() || category !== 'all' ? 'Try a different search or category' : 'No apps have been published yet'} />
      ) : (
        <>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            {apps.length} app{apps.length !== 1 ? "s" : ""} · {apps.filter(a => a.installed).length} installed
          </p>
          <div className="gl-x-grid" style={{ marginBottom: '24px' }}>
            {apps.map(app => (
              <MarketplaceAppCard key={app._id} app={app} canManage={canManage && !!workspaceId} busy={!!busy[app._id]}
                onInstall={a => runAction(a, 'install')} onUninstall={a => runAction(a, 'uninstall')} onReview={setReviewApp} />
            ))}
          </div>
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <button type="button" className="gl-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                Previous
              </button>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Page {page} of {totalPages}</span>
              <button type="button" className="gl-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                Next <ChevronRight size={14} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
