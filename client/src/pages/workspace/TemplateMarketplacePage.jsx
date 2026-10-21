import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  LayoutTemplate, Download, ChevronLeft, ChevronRight, CheckCircle2, ArrowLeft, Lock, Share2, Star, Flag, Eye, Hash, Trash2,
} from "lucide-react";
import api from '@services/api';
import { useToast } from '../../contexts/ToastContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import useIsWorkspaceAdmin from '../../components/apps/useIsWorkspaceAdmin';
import {
  DashPage, PageHead, Toolbar, SearchBox, FilterTabs, SelectBox, Grid, Panel, Btn, IconBtn, Chip, Dialog, Field, Confirm,
  EmptyState, ErrorState, errorMessage,
} from '../../components/ui/page';
import '../toolkit/toolkit.css';

// Matches WorkspaceTemplate.category on the server.
export const TEMPLATE_CATEGORIES = [
  ['general', 'General'], ['engineering', 'Engineering'], ['design', 'Design'], ['marketing', 'Marketing'],
  ['sales', 'Sales'], ['hr', 'People'], ['finance', 'Finance'], ['support', 'Support'], ['product', 'Product'], ['custom', 'Other'],
];
const CATEGORY_LABEL = Object.fromEntries(TEMPLATE_CATEGORIES);
const CATEGORY_OPTIONS = [{ value: 'all', label: 'All' }, ...TEMPLATE_CATEGORIES.map(([value, label]) => ({ value, label }))];
const VIEWS = [
  { value: 'all', label: 'All templates' },
  { value: 'community', label: 'Community' },
  { value: 'mine', label: 'My submissions' },
];
const STATUS = { pending: ['In review', 'warning'], approved: ['Listed', 'success'], hidden: ['Hidden', 'danger'] };
const FEATURE_LABELS = { tasks: 'Tasks', notes: 'Notes', polls: 'Polls', ai: 'AI', huddles: 'Huddles' };

function Stars({ value, size = 11 }) {
  return (
    <span style={{ display: 'inline-flex', gap: 1 }} aria-label={`${(value || 0).toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} style={{ color: value >= n - 0.25 ? 'var(--accent)' : 'var(--border-default)', fill: value >= n - 0.25 ? 'var(--accent)' : 'none' }} />
      ))}
    </span>
  );
}

function ChannelPreview({ channels, max = 4 }) {
  if (!channels?.length) return null;
  const shown = channels.slice(0, max);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }} aria-label="Channels in this template">
      {shown.map((c) => <Chip key={c.name}><Hash size={10} />{c.name}</Chip>)}
      {channels.length > max && <Chip>+{channels.length - max}</Chip>}
    </div>
  );
}

function TemplateCard({ template, view, onUse, onPreview, onRate, onReport, onRemove, importing, canImport }) {
  const busy = importing === template._id;
  const community = view !== 'all';
  const count = template.importCount ?? template.usageCount ?? 0;
  const status = view === 'mine' && STATUS[template.status];
  return (
    <div className="gl-card tk-card" data-testid="template-card">
      <div className="tk-card-head">
        <span className="tk-mark"><LayoutTemplate size={18} /></span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3 className="tk-card-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{template.name}</h3>
          <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <Chip>{CATEGORY_LABEL[template.category] || 'General'}</Chip>
            {status && <Chip tone={status[1]}>{status[0]}</Chip>}
          </div>
        </div>
      </div>
      <p className="tk-card-text" style={{ minHeight: '2.6em', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
        {template.description || "A ready-to-use set of channels and structure."}
      </p>
      {community && <ChannelPreview channels={template.channels} />}
      {view === 'mine' && template.moderationNote && (
        <p className="cd-hint" style={{ margin: 0 }}>Moderator: {template.moderationNote}</p>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
        {community && <><Stars value={template.ratingAvg || 0} /><span>{template.ratingCount ? `${template.ratingAvg.toFixed(1)} (${template.ratingCount})` : 'No ratings yet'}</span></>}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginLeft: community ? 'auto' : 0 }}>
          <Download size={11} />{count > 0 ? `${count.toLocaleString()} import${count === 1 ? '' : 's'}` : 'Not used yet'}
        </span>
      </div>
      {community && template.publisher?.username && view !== 'mine' && (
        <p className="cd-hint" style={{ margin: 0 }}>Shared by {template.publisher.username}</p>
      )}
      <div className="tk-card-foot">
        {community && <IconBtn label={`Preview ${template.name}`} onClick={() => onPreview(template)}><Eye size={14} /></IconBtn>}
        {view === 'community' && (
          <>
            <IconBtn label={`Rate ${template.name}`} onClick={() => onRate(template)}><Star size={14} /></IconBtn>
            <IconBtn label={`Report ${template.name}`} onClick={() => onReport(template)}><Flag size={14} /></IconBtn>
          </>
        )}
        {view === 'mine' && <IconBtn label={`Remove ${template.name}`} onClick={() => onRemove(template)}><Trash2 size={14} /></IconBtn>}
        {canImport && view !== 'mine' && (
          <Btn size="sm" variant="primary" icon={CheckCircle2} loading={busy} onClick={() => onUse(template)} style={{ marginLeft: 'auto' }}>
            {busy ? 'Applying…' : 'Use template'}
          </Btn>
        )}
      </div>
    </div>
  );
}

function PreviewDialog({ template, onClose }) {
  const toggles = Object.entries(template.featureToggles || {}).filter(([k]) => FEATURE_LABELS[k]);
  return (
    <Dialog open title={template.name} lead={template.description} onClose={onClose}
      footer={<Btn variant="ghost" onClick={onClose}>Close</Btn>}>
      <Field label={`Channels (${template.channels?.length || 0})`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} data-testid="template-preview-channels">
          {(template.channels || []).map((c) => (
            <div key={c.name} style={{ fontSize: 13 }}>
              <strong>#{c.name}</strong>{c.isDefault && <span className="cd-hint"> · everyone joins</span>}
              {c.description && <div className="cd-hint">{c.description}</div>}
            </div>
          ))}
        </div>
      </Field>
      {toggles.length > 0 && (
        <Field label="Features">
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {toggles.map(([k, on]) => <Chip key={k} tone={on ? 'success' : undefined}>{FEATURE_LABELS[k]} {on ? 'on' : 'off'}</Chip>)}
          </div>
        </Field>
      )}
      <p className="cd-hint" style={{ margin: 0 }}>Templates copy structure only: no messages, files or members.</p>
    </Dialog>
  );
}

function RateDialog({ template, onClose, onRated }) {
  const [rating, setRating] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await api.post(`/api/workspace-templates/community/${template._id}/rate`, { rating });
      onRated(res.data);
    } catch (err) { setError(errorMessage(err, 'Could not save your rating')); } finally { setSaving(false); }
  };
  return (
    <Dialog open size="sm" title={`Rate ${template.name}`} lead="One rating per person; rating again replaces yours." onClose={onClose} busy={saving}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn variant="primary" onClick={save} loading={saving} disabled={!rating}>Save rating</Btn></>}>
      <Field label="Rating" error={error || undefined}>
        <div style={{ display: 'flex', gap: 2 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" aria-label={`${n} star${n > 1 ? 's' : ''}`} aria-pressed={rating === n} onClick={() => setRating(n)}
              style={{ padding: 3, background: 'none', border: 0, cursor: 'pointer', lineHeight: 0 }}>
              <Star size={22} style={{ color: rating >= n ? 'var(--accent)' : 'var(--border-default)', fill: rating >= n ? 'var(--accent)' : 'none' }} />
            </button>
          ))}
        </div>
      </Field>
    </Dialog>
  );
}

function ReportDialog({ template, onClose, onReported }) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const send = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await api.post(`/api/workspace-templates/community/${template._id}/report`, { reason: reason.trim() });
      onReported(res.data.message);
    } catch (err) { setError(errorMessage(err, 'Could not send the report')); } finally { setSaving(false); }
  };
  return (
    <Dialog open size="sm" title={`Report ${template.name}`} lead="Tell the moderators what’s wrong with this template." onClose={onClose} busy={saving}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn variant="primary" onClick={send} loading={saving} disabled={reason.trim().length < 3}>Send report</Btn></>}>
      <Field label="Reason" error={error || undefined} htmlFor="report-reason">
        <textarea id="report-reason" className="gl-input" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
    </Dialog>
  );
}

function PublishDialog({ workspaceId, workspaceName, onClose, onPublished }) {
  const [form, setForm] = useState({ name: workspaceName || '', description: '', category: 'general' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: typeof e === 'string' ? e : e.target.value }));
  const publish = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await api.post('/api/workspace-templates/community/publish', { workspaceId, ...form, name: form.name.trim(), description: form.description.trim() });
      onPublished(res.data.message);
    } catch (err) { setError(errorMessage(err, 'Could not publish the template')); } finally { setSaving(false); }
  };
  return (
    <Dialog open title="Share this workspace as a template" onClose={onClose} busy={saving}
      lead="Publishes this workspace’s public channel names and descriptions, settings and features to the community gallery. Messages, files, members and private channels are never included. A moderator reviews it first."
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn variant="primary" icon={Share2} onClick={publish} loading={saving} disabled={form.name.trim().length < 3 || form.description.trim().length < 10}>Submit for review</Btn></>}>
      {error && <div className="cd-error-text" role="alert">{error}</div>}
      <Field label="Name" htmlFor="tpl-name"><input id="tpl-name" className="gl-input" value={form.name} onChange={set('name')} maxLength={80} /></Field>
      <Field label="Description" hint="10–1000 characters: who it’s for and how the channels are used." htmlFor="tpl-desc">
        <textarea id="tpl-desc" className="gl-input" rows={3} value={form.description} onChange={set('description')} maxLength={1000} />
      </Field>
      <Field label="Category" htmlFor="tpl-cat">
        <SelectBox value={form.category} onChange={set('category')} label="Category">
          {TEMPLATE_CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </SelectBox>
      </Field>
    </Dialog>
  );
}

/** Agents & tools → Apps → Templates: official and community workspace templates. */
export default function TemplateMarketplacePage() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { activeWorkspace } = useWorkspace();
  const canImport = useIsWorkspaceAdmin(workspaceId);

  const [view, setView] = useState('all');
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [sort, setSort] = useState('popular');
  const [importing, setImporting] = useState(null);
  const [confirmUse, setConfirmUse] = useState(null);
  const [preview, setPreview] = useState(null);
  const [rating, setRating] = useState(null);
  const [reporting, setReporting] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let res;
      if (view === 'mine') {
        res = await api.get('/api/workspace-templates/community/mine');
        setTotalPages(1);
      } else {
        const params = { page, limit: 18 };
        if (activeCategory !== "all") params.category = activeCategory;
        if (search.trim()) params.q = search.trim();
        if (view === 'community') params.sort = sort;
        res = await api.get(view === 'community' ? '/api/workspace-templates/community' : '/api/workspace-templates/public', { params });
        setTotalPages(res.data.totalPages || 1);
      }
      setTemplates(res.data.templates || []);
    } catch (err) {
      setTemplates([]);
      setError(errorMessage(err, "Could not load templates"));
    } finally {
      setLoading(false);
    }
  }, [view, page, activeCategory, search, sort]);

  useEffect(() => {
    const t = setTimeout(fetchTemplates, search ? 400 : 0);
    return () => clearTimeout(t);
  }, [fetchTemplates, search]);

  const handleUse = async (template) => {
    setImporting(template._id);
    try {
      await api.post(`/api/workspace-templates/${template._id}/import`, { workspaceId });
      showToast(`Applied “${template.name}”`, "success");
      setConfirmUse(null);
      setTemplates((list) => list.map((t) => (t._id === template._id
        ? { ...t, importCount: (t.importCount ?? t.usageCount ?? 0) + 1, usageCount: (t.usageCount || 0) + 1 } : t)));
    } catch (err) {
      showToast(errorMessage(err, "Could not apply the template"), "error");
    } finally {
      setImporting(null);
    }
  };

  const handleRemove = async (template) => {
    try {
      await api.delete(`/api/workspace-templates/community/${template._id}`);
      setTemplates((list) => list.filter((t) => t._id !== template._id));
      showToast('Removed from the community gallery', 'success');
    } catch (err) {
      showToast(errorMessage(err, 'Could not remove the template'), 'error');
    }
  };

  const filtering = !!search.trim() || activeCategory !== 'all';

  return (
    <DashPage
      head={(
        <PageHead
          eyebrow={activeWorkspace?.name ? `${activeWorkspace.name} · Apps` : 'Apps'}
          title="Templates"
          icon={LayoutTemplate}
          lead="Ready-made channels and structure, from Oruinwan and the community. Apply one to set up this workspace in a step."
          actions={(
            <>
              <Btn variant="ghost" icon={ArrowLeft} onClick={() => navigate(`/workspace/${workspaceId}/apps`)}>Apps</Btn>
              {canImport && <Btn variant="primary" icon={Share2} onClick={() => setPublishing(true)}>Share this workspace</Btn>}
            </>
          )}
        />
      )}
    >
      <FilterTabs value={view} onChange={(v) => { setView(v); setPage(1); }} options={VIEWS} label="Template source" />
      {view !== 'mine' && (
        <Toolbar>
          <SearchBox value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search templates" label="Search templates" />
          <FilterTabs value={activeCategory} onChange={v => { setActiveCategory(v); setPage(1); }} options={CATEGORY_OPTIONS} label="Category" />
          {view === 'community' && (
            <SelectBox value={sort} onChange={(v) => { setSort(v); setPage(1); }} label="Sort by">
              <option value="popular">Most imported</option>
              <option value="rating">Top rated</option>
              <option value="new">Newest</option>
            </SelectBox>
          )}
        </Toolbar>
      )}

      {canImport === false && view !== 'mine' && !loading && !error && templates.length > 0 && (
        <div className="tk-notice"><Lock size={14} />Only workspace owners and admins can apply a template to this workspace.</div>
      )}

      {loading ? (
        <Grid min={260}>
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="cd-skel" style={{ height: 170 }} />)}
        </Grid>
      ) : error ? (
        <Panel><ErrorState title="Couldn’t load templates" message={error} onRetry={fetchTemplates} /></Panel>
      ) : templates.length === 0 ? (
        <Panel>
          {view === 'mine' ? (
            <EmptyState icon={Share2} title="You haven’t shared a template yet"
              text="Share this workspace’s channel structure with other teams. A moderator reviews it before it’s listed."
              action={canImport ? <Btn variant="primary" icon={Share2} onClick={() => setPublishing(true)}>Share this workspace</Btn> : null} />
          ) : filtering ? (
            <EmptyState icon={LayoutTemplate} title="No templates match" text="Try a different name or category." />
          ) : view === 'community' ? (
            <EmptyState icon={LayoutTemplate} title="No community templates yet"
              text="Templates other teams share appear here once a moderator approves them." />
          ) : (
            <EmptyState icon={LayoutTemplate} title="No templates published yet"
              text="When a workspace template is published, it shows up here, ready to apply." />
          )}
        </Panel>
      ) : (
        <>
          <p className="cd-hint" style={{ margin: 0 }}>{templates.length} template{templates.length !== 1 ? "s" : ""}</p>
          <Grid min={260}>
            {templates.map(t => (
              <TemplateCard key={t._id} template={t} view={view} onUse={setConfirmUse} onPreview={setPreview} onRate={setRating}
                onReport={setReporting} onRemove={setRemoving} importing={importing} canImport={canImport} />
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

      {preview && <PreviewDialog template={preview} onClose={() => setPreview(null)} />}
      {rating && (
        <RateDialog template={rating} onClose={() => setRating(null)} onRated={(r) => {
          setTemplates((list) => list.map((t) => (t._id === rating._id ? { ...t, ratingAvg: r.ratingAvg, ratingCount: r.ratingCount } : t)));
          setRating(null);
          showToast('Thanks for rating', 'success');
        }} />
      )}
      {reporting && <ReportDialog template={reporting} onClose={() => setReporting(null)} onReported={(m) => { setReporting(null); showToast(m, 'success'); }} />}
      {publishing && (
        <PublishDialog workspaceId={workspaceId} workspaceName={activeWorkspace?.name} onClose={() => setPublishing(false)}
          onPublished={(m) => { setPublishing(false); showToast(m, 'success'); setView('mine'); }} />
      )}

      <Confirm
        open={Boolean(confirmUse)}
        title={`Apply “${confirmUse?.name}”?`}
        confirmLabel="Apply template"
        busy={importing === confirmUse?._id}
        onConfirm={() => handleUse(confirmUse)}
        onClose={() => setConfirmUse(null)}
      >
        Its channels and structure are added to {activeWorkspace?.name || 'this workspace'}. Nothing that’s already here is removed.
      </Confirm>
      <Confirm open={Boolean(removing)} title={`Remove “${removing?.name}” from the gallery?`} confirmLabel="Remove" tone="danger"
        onConfirm={() => { const t = removing; setRemoving(null); handleRemove(t); }} onClose={() => setRemoving(null)}>
        Workspaces that already applied it keep their channels.
      </Confirm>
    </DashPage>
  );
}
