import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Layout, Search, Download, ChevronRight,
  Layers, Code, BarChart2, Zap, MessageSquare, CheckCircle2,
  RefreshCw, ArrowLeft, AlertTriangle, Lock
} from "lucide-react";
import api from '@services/api';
import { useToast } from '../../contexts/ToastContext';
import useIsWorkspaceAdmin from '../../components/apps/useIsWorkspaceAdmin';

const FONT = 'var(--font)';
const ON_ACCENT = '#0c0c0c';

const CATEGORY_ICONS = {
  general:       { icon: Layers,        label: "General" },
  engineering:   { icon: Code,          label: "Engineering" },
  marketing:     { icon: BarChart2,     label: "Marketing" },
  automation:    { icon: Zap,           label: "Automation" },
  communication: { icon: MessageSquare, label: "Team Comms" },
};

const ALL_CATEGORIES = [
  { id: "all", label: "All Templates" },
  ...Object.entries(CATEGORY_ICONS).map(([id, { label }]) => ({ id, label }))
];

const errorMessage = (err, fallback) => err?.response?.data?.message || err?.response?.data?.error || fallback;

function TemplateCard({ template, onUse, importing, canImport }) {
  const cat = CATEGORY_ICONS[template.category] || CATEGORY_ICONS.general;
  const Icon = cat.icon;
  const busy = importing === template._id;
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '2px', padding: '18px', display: 'flex', flexDirection: 'column', transition: 'border-color 150ms ease' }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-accent)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-default)')}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '2px', background: 'var(--accent-dim)', border: '1px solid var(--border-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '18px' }}>
          {template.icon ? <span>{template.icon}</span> : <Icon size={18} style={{ color: 'var(--accent)' }} />}
        </div>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{template.name}</h3>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{cat.label}</span>
        </div>
      </div>
      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.55, margin: '0 0 16px', minHeight: '2.5rem', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
        {template.description || "A ready-to-use workspace template."}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', marginTop: 'auto' }}>
        {template.usageCount > 0 && (
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Download size={11} />{template.usageCount.toLocaleString()} uses
          </span>
        )}
        {canImport && (
          <button onClick={() => onUse(template)} disabled={busy}
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '11px', fontWeight: 700, color: ON_ACCENT, background: 'var(--accent)', border: 'none', borderRadius: '2px', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1, fontFamily: FONT }}>
            {busy ? <><RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} />Importing…</> : <><CheckCircle2 size={11} />Use Template</>}
          </button>
        )}
      </div>
    </div>
  );
}

export default function TemplateMarketplacePage() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const canImport = useIsWorkspaceAdmin(workspaceId);

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [importing, setImporting] = useState(null);
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
      showToast(`"${template.name}" imported`, "success");
    } catch (err) {
      showToast(errorMessage(err, "Import failed"), "error");
    } finally {
      setImporting(null);
    }
  };

  const filtering = !!search.trim() || activeCategory !== 'all';
  const pageBtn = (disabled) => ({ display: 'flex', alignItems: 'center', gap: '4px', padding: '7px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '2px', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1, fontFamily: FONT });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: 'var(--bg-base)', fontFamily: FONT }}>
      <div style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', padding: '20px 32px', flexShrink: 0 }}>
        <div style={{ maxWidth: '1024px', margin: '0 auto' }}>
          <button onClick={() => navigate(`/workspace/${workspaceId}/apps`)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)', background: 'none', border: 'none', padding: 0, marginBottom: '16px', cursor: 'pointer', fontFamily: FONT }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
            <ArrowLeft size={13} /> Apps
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '2px', background: 'var(--accent-dim)', border: '1px solid var(--border-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Layout size={18} style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <h1 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Template Marketplace</h1>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '3px 0 0' }}>Ready-made workspace templates — import channels and structure in one click</p>
            </div>
          </div>

          <div style={{ position: 'relative', marginBottom: '14px' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search templates…" aria-label="Search templates"
              style={{ width: '100%', padding: '9px 16px 9px 36px', fontSize: '13px', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '2px', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', fontFamily: FONT }}
              onFocus={e => (e.target.style.borderColor = 'var(--border-accent)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border-default)')} />
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {ALL_CATEGORIES.map(cat => {
              const active = activeCategory === cat.id;
              return (
                <button key={cat.id} onClick={() => { setActiveCategory(cat.id); setPage(1); }}
                  style={{ padding: '4px 12px', fontSize: '11px', fontWeight: 600, borderRadius: '2px', background: active ? 'var(--accent-dim)' : 'var(--bg-hover)', border: `1px solid ${active ? 'var(--accent)' : 'var(--border-default)'}`, color: active ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', fontFamily: FONT }}>
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
        <div style={{ maxWidth: '1024px', margin: '0 auto' }}>
          {canImport === false && !loading && !error && templates.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--bg-active)', border: '1px solid var(--border-subtle)', borderRadius: '2px' }}>
              <Lock size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              Only workspace owners and admins can apply a template to this workspace.
            </div>
          )}

          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ height: '170px', background: 'var(--bg-active)', border: '1px solid var(--border-subtle)', borderRadius: '2px' }} />
              ))}
            </div>
          ) : error ? (
            <div role="alert" style={{ textAlign: 'center', padding: '64px 0' }}>
              <AlertTriangle size={24} style={{ color: 'var(--state-danger)', marginBottom: '12px' }} />
              <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>Couldn’t load templates</p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 14px' }}>{error}</p>
              <button onClick={fetchTemplates} style={{ ...pageBtn(false), display: 'inline-flex' }}><RefreshCw size={12} />Retry</button>
            </div>
          ) : templates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '2px', background: 'var(--bg-active)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Layout size={24} style={{ color: 'var(--text-muted)' }} />
              </div>
              {filtering ? (
                <>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>No matching templates</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>Try a different search or category</p>
                </>
              ) : (
                <>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>No templates published yet</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>Public workspace templates will appear here once your organisation publishes them.</p>
                </>
              )}
            </div>
          ) : (
            <>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                {templates.length} template{templates.length !== 1 ? "s" : ""} available
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                {templates.map(t => (
                  <TemplateCard key={t._id} template={t} onUse={handleUse} importing={importing} canImport={canImport} />
                ))}
              </div>
              {totalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={pageBtn(page === 1)}>Previous</button>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Page {page} of {totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={pageBtn(page === totalPages)}>
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
