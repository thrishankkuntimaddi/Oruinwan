import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Layout, Search, Star, Download, ChevronRight,
  Layers, Code, BarChart2, Zap, MessageSquare, CheckCircle2,
  RefreshCw, ArrowLeft
} from "lucide-react";
import api from '@services/api';

const CATEGORY_ICONS = {
  general:      { icon: Layers,        label: "General",     color: "from-blue-500 to-blue-600" },
  engineering:  { icon: Code,          label: "Engineering", color: "from-violet-500 to-purple-600" },
  marketing:    { icon: BarChart2,     label: "Marketing",   color: "from-pink-500 to-rose-600" },
  automation:   { icon: Zap,           label: "Automation",  color: "from-amber-500 to-orange-600" },
  communication:{ icon: MessageSquare, label: "Team Comms",  color: "from-emerald-500 to-teal-600" } };

const ALL_CATEGORIES = [
  { id: "all", label: "All Templates" },
  ...Object.entries(CATEGORY_ICONS).map(([id, { label }]) => ({ id, label }))
];

function TemplateCard({ template, onUse, importing }) {
  const cat = CATEGORY_ICONS[template.category] || CATEGORY_ICONS.general;
  const Icon = cat.icon;
  return (
    <div className="group bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-lg transition-all duration-200">
      {}
      <div className={`h-2 bg-gradient-to-r ${cat.color}`} />
      <div className="p-5">
        <div className="flex items-start gap-3 mb-3">
          <div
            className={`w-10 h-10 rounded-xl bg-gradient-to-br ${cat.color} flex items-center justify-center flex-shrink-0 shadow-sm`}
            style={{ background: template.color || undefined }}
          >
            <span className="text-lg">{template.icon || "📁"}</span>
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-gray-900 dark:text-white text-sm truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {template.name}
            </h3>
            <span className="text-xs text-gray-400 dark:text-gray-500 capitalize">{cat.label}</span>
          </div>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2 mb-4 min-h-[2.5rem]">
          {template.description || "A ready-to-use workspace template."}
        </p>

        <div className="flex items-center justify-between">
          {template.usageCount > 0 && (
            <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
              <Download size={11} />
              {template.usageCount.toLocaleString()} uses
            </span>
          )}
          <button
            onClick={() => onUse(template)}
            disabled={importing === template._id}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
          >
            {importing === template._id ? (
              <><RefreshCw size={11} className="animate-spin" /> Importing…</>
            ) : (
              <><CheckCircle2 size={11} /> Use Template</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TemplateMarketplacePage() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [importing, setImporting] = useState(null);
  const [toast, setToast] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 18 };
      if (activeCategory !== "all") params.category = activeCategory;
      if (search.trim()) params.q = search.trim();
      const res = await api.get("/api/workspace-templates/public", { params });
      setTemplates(res.data.templates || []);
      setTotalPages(res.data.totalPages || 1);
    } catch (err) {
      
      setTemplates([]);
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
      const token = localStorage.getItem("accessToken");
      await api.post(
        `/api/workspace-templates/${template._id}/import`,
        { workspaceId }
      );
      showToast(`"${template.name}" imported successfully!`);
    } catch (err) {
      showToast(err.response?.data?.message || "Import failed", "error");
    } finally {
      setImporting(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50 dark:bg-gray-950 min-h-0">
      {}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white transition-all ${
          toast.type === "error" ? "bg-red-500" : "bg-emerald-500"
        }`}>
          {toast.msg}
        </div>
      )}

      {}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-8 py-6 flex-shrink-0">
        <div className="max-w-5xl mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mb-4 transition-colors"
          >
            <ArrowLeft size={13} /> Back
          </button>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm">
              <Layout size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Template Marketplace</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Ready-made workspace templates — import in one click
              </p>
            </div>
          </div>

          {}
          <div className="relative mb-4">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search templates…"
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>

          {}
          <div className="flex items-center gap-2 flex-wrap">
            {ALL_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => { setActiveCategory(cat.id); setPage(1); }}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-full border transition-all ${
                  activeCategory === cat.id
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                    : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-600 hover:text-indigo-600 dark:hover:text-indigo-400"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-5xl mx-auto">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 h-44 animate-pulse" />
              ))}
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-24">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
                <Layout size={28} className="text-gray-400" />
              </div>
              <p className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-1">No templates found</p>
              <p className="text-sm text-gray-400">Try a different search or category</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
                {templates.length} template{templates.length !== 1 ? "s" : ""} available
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {templates.map(t => (
                  <TemplateCard key={t._id} template={t} onUse={handleUse} importing={importing} />
                ))}
              </div>

              {}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-40 hover:border-gray-300 dark:hover:border-gray-600 transition-all"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-40 hover:border-gray-300 dark:hover:border-gray-600 transition-all"
                  >
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
