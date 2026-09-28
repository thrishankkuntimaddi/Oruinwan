import React, { useState, useEffect, useCallback } from "react";
import {
  Search, Puzzle, CheckCircle2, Star, StarHalf, Download, ShoppingBag,
  RefreshCw, ChevronRight, MessageSquare, X, Trash2, AlertTriangle, Lock
} from "lucide-react";
import api from '@services/api';
import { useToast } from '../../contexts/ToastContext';

// Text colour used on accent-filled buttons (matches the app's primary button style).
const ON_ACCENT = '#0c0c0c';
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
      <div role="dialog" aria-label={`Review ${app.name}`} style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '2px', width: '100%', maxWidth: '440px', fontFamily: FONT }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div>
            <h3 style={{ fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontSize: '14px' }}>Review {app.name}</h3>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '3px 0 0' }}>Share your experience with the team</p>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ padding: '4px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
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
          <button onClick={onClose} style={{ flex: 1, padding: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', backgroundColor: 'var(--bg-active)', border: '1px solid var(--border-default)', borderRadius: '2px', cursor: 'pointer', fontFamily: FONT }}>Cancel</button>
          <button onClick={submit} disabled={submitting || !rating}
            style={{ flex: 1, padding: '8px', fontSize: '13px', fontWeight: 700, color: ON_ACCENT, backgroundColor: 'var(--accent)', border: 'none', borderRadius: '2px', cursor: submitting || !rating ? 'not-allowed' : 'pointer', opacity: submitting || !rating ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontFamily: FONT }}>
            {submitting ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />Submitting…</> : "Submit Review"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MarketplaceAppCard({ app, canManage, busy, onInstall, onUninstall, onReview }) {
  const installed = !!app.installed;
  const btnBase = { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '7px 10px', fontSize: '11px', fontWeight: 700, borderRadius: '2px', cursor: busy ? 'not-allowed' : 'pointer', fontFamily: FONT, opacity: busy ? 0.6 : 1, transition: 'opacity 150ms ease' };

  return (
    <div data-testid="marketplace-app-card" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '2px', overflow: 'hidden', transition: 'border-color 150ms ease', display: 'flex', flexDirection: 'column' }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-accent)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-default)')}>
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
          {app.iconUrl ? (
            <img src={app.iconUrl} alt="" style={{ width: '40px', height: '40px', objectFit: 'cover', flexShrink: 0, borderRadius: '2px' }} />
          ) : (
            <div style={{ width: '40px', height: '40px', backgroundColor: 'var(--accent-dim)', border: '1px solid var(--border-default)', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Puzzle size={18} style={{ color: 'var(--accent)' }} />
            </div>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <h3 style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{app.name}</h3>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '3px 0 0' }}>{app.developer} · v{app.version}</p>
          </div>
          {installed && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 700, color: 'var(--state-success)', background: 'color-mix(in srgb, var(--state-success) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--state-success) 30%, transparent)', borderRadius: '2px', padding: '2px 7px', flexShrink: 0 }}>
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
              <button onClick={() => onUninstall(app)} disabled={busy}
                style={{ ...btnBase, background: 'transparent', border: '1px solid color-mix(in srgb, var(--state-danger) 40%, transparent)', color: 'var(--state-danger)' }}>
                {busy ? <><RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} />Removing…</> : <><Trash2 size={11} />Uninstall</>}
              </button>
            ) : (
              <button onClick={() => onInstall(app)} disabled={busy}
                style={{ ...btnBase, background: 'var(--accent)', border: '1px solid var(--accent)', color: ON_ACCENT }}>
                {busy ? <><RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} />Installing…</> : <><Download size={11} />Install</>}
              </button>
            )
          ) : (
            <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text-muted)' }}>
              {installed ? 'Installed in this workspace' : 'Not installed'}
            </span>
          )}
          <button onClick={() => onReview(app)}
            style={{ padding: '7px 10px', fontSize: '12px', color: 'var(--text-muted)', background: 'none', border: '1px solid var(--border-default)', borderRadius: '2px', cursor: 'pointer', transition: 'border-color 150ms ease, color 150ms ease' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-accent)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            title="Write a review" aria-label={`Review ${app.name}`}>
            <MessageSquare size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

const filterBtn = (active) => ({
  padding: '4px 12px', fontSize: '11px', fontWeight: 600, borderRadius: '2px',
  background: active ? 'var(--accent-dim)' : 'var(--bg-hover)',
  border: `1px solid ${active ? 'var(--accent)' : 'var(--border-default)'}`,
  color: active ? 'var(--accent)' : 'var(--text-muted)',
  cursor: 'pointer', transition: 'all 150ms ease', fontFamily: FONT,
});

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

      <div style={{ position: 'relative', marginBottom: '14px' }}>
        <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search marketplace…" aria-label="Search marketplace"
          style={{ width: '100%', paddingLeft: '36px', paddingRight: '16px', paddingTop: '9px', paddingBottom: '9px', fontSize: '13px', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '2px', color: 'var(--text-primary)', outline: 'none', fontFamily: FONT, boxSizing: 'border-box' }}
          onFocus={e => (e.target.style.borderColor = 'var(--border-accent)')}
          onBlur={e => (e.target.style.borderColor = 'var(--border-default)')} />
      </div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '20px' }}>
        {MARKETPLACE_CATEGORIES.map(cat => (
          <button key={cat.id} onClick={() => { setCategory(cat.id); setPage(1); }} style={filterBtn(category === cat.id)}>{cat.label}</button>
        ))}
      </div>

      {canManage === false && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--bg-active)', border: '1px solid var(--border-subtle)', borderRadius: '2px' }}>
          <Lock size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          Only workspace owners and admins can install or uninstall apps.
        </div>
      )}

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ height: '180px', background: 'var(--bg-active)', border: '1px solid var(--border-subtle)', borderRadius: '2px' }} />
          ))}
        </div>
      ) : error ? (
        <div role="alert" style={{ textAlign: 'center', padding: '48px 0' }}>
          <AlertTriangle size={24} style={{ color: 'var(--state-danger)', marginBottom: '12px' }} />
          <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>Couldn’t load apps</p>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 14px' }}>{error}</p>
          <button onClick={fetchApps} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '2px', cursor: 'pointer', fontFamily: FONT }}>
            <RefreshCw size={12} />Retry
          </button>
        </div>
      ) : apps.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ width: '56px', height: '56px', background: 'var(--bg-active)', border: '1px solid var(--border-default)', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <ShoppingBag size={24} style={{ color: 'var(--text-muted)' }} />
          </div>
          <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>No apps found</p>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
            {search.trim() || category !== 'all' ? 'Try a different search or category' : 'No apps have been published yet'}
          </p>
        </div>
      ) : (
        <>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            {apps.length} app{apps.length !== 1 ? "s" : ""} · {apps.filter(a => a.installed).length} installed
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            {apps.map(app => (
              <MarketplaceAppCard key={app._id} app={app} canManage={canManage && !!workspaceId} busy={!!busy[app._id]}
                onInstall={a => runAction(a, 'install')} onUninstall={a => runAction(a, 'uninstall')} onReview={setReviewApp} />
            ))}
          </div>
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ padding: '7px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '2px', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1, fontFamily: FONT }}>
                Previous
              </button>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Page {page} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '7px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '2px', cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.4 : 1, fontFamily: FONT }}>
                Next <ChevronRight size={14} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
