import React, { useState, useEffect, useCallback } from "react";
import {
  Puzzle, CheckCircle2, Star, StarHalf, Download, ShoppingBag, ChevronLeft, ChevronRight, MessageSquare, Trash2, Lock,
} from "lucide-react";
import api from '@services/api';
import { useToast } from '../../contexts/ToastContext';
import {
  Toolbar, SearchBox, FilterTabs, Grid, Panel, Btn, IconBtn, Chip, Dialog, Field, Confirm, EmptyState, ErrorState, errorMessage,
} from '../ui/page';
import { SAMPLE_APP_NAMES } from './realIntegrations';
import '../../pages/toolkit/toolkit.css';

const MARKETPLACE_CATEGORIES = [
  { value: "all", label: "All" },
  { value: "productivity", label: "Productivity" },
  { value: "communication", label: "Communication" },
  { value: "developer", label: "Developer" },
  { value: "automation", label: "Automation" },
  { value: "analytics", label: "Analytics" },
];

function StarRating({ rating, size = 12 }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }} aria-label={`${rating.toFixed(1)} out of 5`}>
      {Array.from({ length: full }).map((_, i) => <Star key={`f${i}`} size={size} style={{ color: 'var(--accent)', fill: 'var(--accent)' }} />)}
      {half && <StarHalf size={size} style={{ color: 'var(--accent)', fill: 'var(--accent)' }} />}
      {Array.from({ length: empty }).map((_, i) => <Star key={`e${i}`} size={size} style={{ color: 'var(--border-default)' }} />)}
    </span>
  );
}

const RATING_WORDS = ["", "Poor", "Fair", "Good", "Great", "Excellent"];

function ReviewDialog({ app, onClose, onSubmitted }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!rating) return setError("Pick a rating first");
    setSubmitting(true);
    setError("");
    try {
      await api.post("/api/marketplace/review", { appId: app._id, rating, comment });
      onSubmitted?.();
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Could not send your review"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open
      size="sm"
      title={`Review ${app.name}`}
      lead="Tell your team what it’s like to use."
      onClose={onClose}
      busy={submitting}
      footer={(
        <>
          <Btn variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Btn>
          <Btn variant="primary" onClick={submit} loading={submitting} disabled={!rating}>Send review</Btn>
        </>
      )}
    >
      <Field label="Rating" error={error || undefined}>
        <div style={{ display: 'flex', gap: 2, alignItems: 'center' }} onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} type="button" aria-label={`${n} star${n > 1 ? 's' : ''}`} aria-pressed={rating === n}
              onMouseEnter={() => setHover(n)} onClick={() => setRating(n)}
              style={{ padding: 3, background: 'none', border: 0, cursor: 'pointer', lineHeight: 0 }}>
              <Star size={22} style={{ color: (hover || rating) >= n ? 'var(--accent)' : 'var(--border-default)', fill: (hover || rating) >= n ? 'var(--accent)' : 'none' }} />
            </button>
          ))}
          {(hover || rating) > 0 && <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-secondary)' }}>{RATING_WORDS[hover || rating]}</span>}
        </div>
      </Field>
      <Field label="Comment" hint="Optional" htmlFor="review-comment">
        <textarea id="review-comment" className="gl-input" value={comment} onChange={e => setComment(e.target.value)} rows={3} maxLength={1000} placeholder="What worked, what didn’t?" />
      </Field>
    </Dialog>
  );
}

function MarketplaceAppCard({ app, canManage, busy, onInstall, onUninstall, onReview }) {
  const installed = !!app.installed;
  return (
    <div data-testid="marketplace-app-card" className="gl-card tk-card">
      <div className="tk-card-head">
        {app.iconUrl
          ? <img src={app.iconUrl} alt="" className="tk-mark" style={{ objectFit: 'cover', padding: 0 }} />
          : <span className="tk-mark"><Puzzle size={18} /></span>}
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3 className="tk-card-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{app.name}</h3>
          <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '3px 0 0' }}>{app.developer} · v{app.version}</p>
        </div>
        {installed
          ? <Chip tone="success"><CheckCircle2 size={11} />Installed</Chip>
          : SAMPLE_APP_NAMES.has(app.name) && <Chip title="An example listing: installing it doesn’t connect anything">Sample</Chip>}
      </div>
      <p className="tk-card-text" style={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{app.description}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--text-muted)' }}>
        <StarRating rating={app.avgRating || 0} />
        <span>{app.avgRating > 0 ? <>{app.avgRating.toFixed(1)} ({app.reviewCount})</> : "No reviews yet"}</span>
        {app.installCount > 0 && (
          <span title="Workspaces using this app" style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <Download size={11} />{app.installCount}
          </span>
        )}
      </div>
      <div className="tk-card-foot">
        {canManage ? (
          installed
            ? <Btn size="sm" variant="ghost" icon={Trash2} loading={busy} onClick={() => onUninstall(app)}>{busy ? 'Removing…' : 'Uninstall'}</Btn>
            : <Btn size="sm" variant="primary" icon={Download} loading={busy} onClick={() => onInstall(app)}>{busy ? 'Installing…' : 'Install'}</Btn>
        ) : (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{installed ? 'Installed in this workspace' : 'Not installed'}</span>
        )}
        <IconBtn label={`Review ${app.name}`} onClick={() => onReview(app)}><MessageSquare size={14} /></IconBtn>
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
  const [confirmRemove, setConfirmRemove] = useState(null);
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
      showToast(errorMessage(err, `Could not ${action} ${app.name}`), 'error');
    } finally {
      setBusy(b => ({ ...b, [app._id]: false }));
    }
  };

  const filtering = search.trim() || category !== 'all';
  const installedCount = apps.filter(a => a.installed).length;
  const hasSamples = apps.some(a => SAMPLE_APP_NAMES.has(a.name));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {reviewApp && (
        <ReviewDialog app={reviewApp} onClose={() => setReviewApp(null)}
          onSubmitted={() => { showToast("Thanks, your review is posted", "success"); fetchApps(); }} />
      )}

      <Toolbar>
        <SearchBox value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search apps" label="Search marketplace" />
        <FilterTabs value={category} onChange={v => { setCategory(v); setPage(1); }} options={MARKETPLACE_CATEGORIES} label="Category" />
      </Toolbar>

      {canManage === false && (
        <div className="tk-notice"><Lock size={14} />Only workspace owners and admins can install or uninstall apps.</div>
      )}

      {loading ? (
        <Grid min={260}>
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="cd-skel" style={{ height: 170 }} />)}
        </Grid>
      ) : error ? (
        <Panel><ErrorState title="Couldn’t load apps" message={error} onRetry={fetchApps} /></Panel>
      ) : apps.length === 0 ? (
        <Panel>
          <EmptyState icon={ShoppingBag} title={filtering ? 'No apps match' : 'No apps published yet'}
            text={filtering ? 'Try a different name or category.' : 'Apps that developers publish for Oruinwan show up here, ready to install.'} />
        </Panel>
      ) : (
        <>
          <p className="cd-hint" style={{ margin: 0 }}>
            {apps.length} app{apps.length !== 1 ? "s" : ""}{installedCount ? ` · ${installedCount} installed here` : ''}
            {hasSamples && ' · Listings marked Sample are examples and don’t connect to anything.'}
          </p>
          <Grid min={260}>
            {apps.map(app => (
              <MarketplaceAppCard key={app._id} app={app} canManage={canManage && !!workspaceId} busy={!!busy[app._id]}
                onInstall={a => runAction(a, 'install')} onUninstall={setConfirmRemove} onReview={setReviewApp} />
            ))}
          </Grid>
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Btn variant="ghost" icon={ChevronLeft} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</Btn>
              <span className="cd-hint">Page {page} of {totalPages}</span>
              <Btn variant="ghost" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next <ChevronRight size={13} /></Btn>
            </div>
          )}
        </>
      )}

      <Confirm
        open={Boolean(confirmRemove)}
        title={`Uninstall ${confirmRemove?.name}?`}
        confirmLabel="Uninstall"
        tone="danger"
        onConfirm={() => { const a = confirmRemove; setConfirmRemove(null); runAction(a, 'uninstall'); }}
        onClose={() => setConfirmRemove(null)}
      >
        It’s removed from this workspace for everyone. You can install it again at any time.
      </Confirm>
    </div>
  );
}
