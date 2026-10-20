import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  LayoutTemplate, Download, ChevronLeft, ChevronRight, Layers, Code, BarChart2, Zap, MessageSquare, CheckCircle2,
  ArrowLeft, Lock,
} from "lucide-react";
import api from '@services/api';
import { useToast } from '../../contexts/ToastContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import useIsWorkspaceAdmin from '../../components/apps/useIsWorkspaceAdmin';
import {
  DashPage, PageHead, Toolbar, SearchBox, FilterTabs, Grid, Panel, Btn, Chip, Confirm, EmptyState, ErrorState, errorMessage,
} from '../../components/ui/page';
import '../toolkit/toolkit.css';

const CATEGORY_ICONS = {
  general:       { icon: Layers,        label: "General" },
  engineering:   { icon: Code,          label: "Engineering" },
  marketing:     { icon: BarChart2,     label: "Marketing" },
  automation:    { icon: Zap,           label: "Automation" },
  communication: { icon: MessageSquare, label: "Team comms" },
};

const ALL_CATEGORIES = [
  { value: "all", label: "All" },
  ...Object.entries(CATEGORY_ICONS).map(([value, { label }]) => ({ value, label }))
];

function TemplateCard({ template, onUse, importing, canImport }) {
  const cat = CATEGORY_ICONS[template.category] || CATEGORY_ICONS.general;
  const Icon = cat.icon;
  const busy = importing === template._id;
  return (
    <div className="gl-card tk-card">
      <div className="tk-card-head">
        <span className="tk-mark"><Icon size={18} /></span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3 className="tk-card-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{template.name}</h3>
          <div style={{ marginTop: 4 }}><Chip>{cat.label}</Chip></div>
        </div>
      </div>
      <p className="tk-card-text" style={{ minHeight: '2.6em', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
        {template.description || "A ready-to-use set of channels and structure."}
      </p>
      <div className="tk-card-foot">
        <span className="cd-hint" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {template.usageCount > 0 ? <><Download size={11} />Used {template.usageCount.toLocaleString()} time{template.usageCount === 1 ? '' : 's'}</> : 'Not used yet'}
        </span>
        {canImport && (
          <Btn size="sm" variant="primary" icon={CheckCircle2} loading={busy} onClick={() => onUse(template)}>
            {busy ? 'Applying…' : 'Use template'}
          </Btn>
        )}
      </div>
    </div>
  );
}

/** Agents & tools → Apps → Templates: ready-made workspace structure an admin can apply. */
export default function TemplateMarketplacePage() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { activeWorkspace } = useWorkspace();
  const canImport = useIsWorkspaceAdmin(workspaceId);

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [importing, setImporting] = useState(null);
  const [confirmUse, setConfirmUse] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit: 18 };
      if (activeCategory !== "all") params.category = activeCategory;
      if (search.trim()) params.q = search.trim();
      const res = await api.get("/api/workspace-templates/public", { params });
      setTemplates(res.data.templates || []);
      setTotalPages(res.data.totalPages || 1);
    } catch (err) {
      setTemplates([]);
      setError(errorMessage(err, "Could not load templates"));
    } finally {
      setLoading(false);
    }
  }, [page, activeCategory, search]);

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
    } catch (err) {
      showToast(errorMessage(err, "Could not apply the template"), "error");
    } finally {
      setImporting(null);
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
          lead="Ready-made channels and structure. Apply one to set up this workspace in a step."
          actions={<Btn variant="ghost" icon={ArrowLeft} onClick={() => navigate(`/workspace/${workspaceId}/apps`)}>Apps</Btn>}
        />
      )}
    >
      <Toolbar>
        <SearchBox value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search templates" label="Search templates" />
        <FilterTabs value={activeCategory} onChange={v => { setActiveCategory(v); setPage(1); }} options={ALL_CATEGORIES} label="Category" />
      </Toolbar>

      {canImport === false && !loading && !error && templates.length > 0 && (
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
          {filtering ? (
            <EmptyState icon={LayoutTemplate} title="No templates match" text="Try a different name or category." />
          ) : (
            <EmptyState icon={LayoutTemplate} title="No templates published yet"
              text="When your organisation publishes a workspace template, it shows up here, ready to apply." />
          )}
        </Panel>
      ) : (
        <>
          <p className="cd-hint" style={{ margin: 0 }}>{templates.length} template{templates.length !== 1 ? "s" : ""}</p>
          <Grid min={260}>
            {templates.map(t => (
              <TemplateCard key={t._id} template={t} onUse={setConfirmUse} importing={importing} canImport={canImport} />
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
        open={Boolean(confirmUse)}
        title={`Apply “${confirmUse?.name}”?`}
        confirmLabel="Apply template"
        busy={importing === confirmUse?._id}
        onConfirm={() => handleUse(confirmUse)}
        onClose={() => setConfirmUse(null)}
      >
        Its channels and structure are added to {activeWorkspace?.name || 'this workspace'}. Nothing that’s already here is removed.
      </Confirm>
    </DashPage>
  );
}
