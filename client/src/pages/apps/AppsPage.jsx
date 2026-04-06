import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Search, Puzzle, CheckCircle2, Grid3X3, Terminal,
  Star, StarHalf, Download, ShoppingBag, RefreshCw, ChevronRight,
  MessageSquare, X
} from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { MOCK_INTEGRATIONS, INTEGRATION_CATEGORIES } from "../../components/apps/mock/mockIntegrations";
import IntegrationCard from "../../components/apps/IntegrationCard";
import IntegrationDetailsModal from "../../components/apps/IntegrationDetailsModal";
import api from '@services/api';

// ── Star rating display ──────────────────────────────────────────────────────
function StarRating({ rating, size = 12 }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: full }).map((_, i) => (
        <Star key={`f${i}`} size={size} className="text-amber-400 fill-amber-400" />
      ))}
      {half && <StarHalf size={size} className="text-amber-400 fill-amber-400" />}
      {Array.from({ length: empty }).map((_, i) => (
        <Star key={`e${i}`} size={size} className="text-gray-300 dark:text-gray-600" />
      ))}
    </span>
  );
}

// ── Review Modal ─────────────────────────────────────────────────────────────
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
      const token = localStorage.getItem("accessToken");
      await api.post(
        "/api/marketplace/review",
        { appId: app._id, rating, comment }
      );
      onSubmitted?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white">Review {app.name}</h3>
            <p className="text-xs text-gray-400 mt-0.5">Share your experience with the team</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {/* Star picker */}
          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2 block">Rating</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover(0)}
                  onClick={() => setRating(n)}
                  className="p-0.5 transition-transform hover:scale-110"
                >
                  <Star
                    size={24}
                    className={(hover || rating) >= n ? "text-amber-400 fill-amber-400" : "text-gray-300 dark:text-gray-600"}
                  />
                </button>
              ))}
              {rating > 0 && (
                <span className="ml-2 text-sm text-gray-500 dark:text-gray-400 self-center">
                  {["", "Poor", "Fair", "Good", "Great", "Excellent"][rating]}
                </span>
              )}
            </div>
          </div>
          {/* Comment */}
          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2 block">
              Comment <span className="font-normal normal-case text-gray-400">(optional)</span>
            </label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="What did you like or dislike?"
              className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-xl p-3 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none transition-all"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <div className="flex gap-2 p-5 pt-0">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting || !rating}
            className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {submitting ? <><RefreshCw size={13} className="animate-spin" /> Submitting…</> : "Submit Review"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Marketplace App Card ─────────────────────────────────────────────────────
const CATEGORY_COLORS = {
  productivity:  "from-blue-500 to-blue-600",
  communication: "from-emerald-500 to-teal-600",
  developer:     "from-violet-500 to-purple-600",
  automation:    "from-amber-500 to-orange-600",
  analytics:     "from-pink-500 to-rose-600" };

function MarketplaceAppCard({ app, workspaceId, onReview, onInstalled }) {
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);
  const gradient = CATEGORY_COLORS[app.category] || "from-gray-500 to-gray-600";

  const install = async () => {
    setInstalling(true);
    try {
      const token = localStorage.getItem("accessToken");
      await api.post(
        "/api/marketplace/install",
        { appId: app._id, workspaceId }
      );
      setInstalled(true);
      onInstalled?.();
    } catch (err) {
      // 409 = already installed — treat as success
      if (err.response?.status === 409) setInstalled(true);
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', transition: 'border-color 150ms ease' }} onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(184,149,106,0.2)'} onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}>
      <div style={{ height: '3px', background: '#b8956a', opacity: 0.6 }} />
      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          {app.iconUrl ? (
            <img src={app.iconUrl} alt={app.name} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
          ) : (
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0 shadow-sm`}>
              <Puzzle size={18} className="text-white" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 style={{ fontWeight: 700, fontSize: '13px', color: '#e4e4e4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {app.name}
            </h3>
            <p className="text-xs text-gray-400 dark:text-gray-500">{app.developer} · v{app.version}</p>
          </div>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2 mb-3 min-h-[2.2rem]">
          {app.description}
        </p>

        {/* Ratings row */}
        <div className="flex items-center gap-2 mb-3">
          <StarRating rating={app.avgRating || 0} />
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {app.avgRating > 0 ? (
              <>{app.avgRating.toFixed(1)} ({app.reviewCount})</>
            ) : (
              "No reviews yet"
            )}
          </span>
          {app.installCount > 0 && (
            <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
              <Download size={10} />{app.installCount}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={install}
            disabled={installing || installed}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '6px 10px', fontSize: '11px', fontWeight: 700, background: installed ? 'rgba(52,211,153,0.1)' : '#b8956a', border: `1px solid ${installed ? 'rgba(52,211,153,0.25)' : 'transparent'}`, color: installed ? '#34d399' : '#0c0c0c', cursor: installing || installed ? 'not-allowed' : 'pointer', fontFamily: 'Inter,system-ui,sans-serif', transition: 'opacity 150ms ease', opacity: installing ? 0.6 : 1 }}
          >
            {installing ? (
              <><RefreshCw size={11} className="animate-spin" />Installing…</>
            ) : installed ? (
              <><CheckCircle2 size={11} />Installed</>
            ) : (
              <><Download size={11} />Install</>
            )}
          </button>
          <button
            onClick={() => onReview(app)}
            className="px-2.5 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 rounded-lg transition-all"
            title="Write a review"
          >
            <MessageSquare size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
const MARKETPLACE_CATEGORIES = [
  { id: "all", label: "All" },
  { id: "productivity", label: "Productivity" },
  { id: "communication", label: "Communication" },
  { id: "developer", label: "Developer" },
  { id: "automation", label: "Automation" },
  { id: "analytics", label: "Analytics" },
];

export default function AppsPage() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();

  // Tabs: "integrations" (legacy mock) | "marketplace" (real backend)
  const [activeTab, setActiveTab] = useState("integrations");

  // ── Legacy integrations state ──────────────────────────────────────────────
  const [connectedMap, setConnectedMap] = useState(() => {
    const init = {};
    MOCK_INTEGRATIONS.forEach(i => { init[i.id] = i.connected; });
    return init;
  });
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [selectedIntegration, setSelectedIntegration] = useState(null);
  const handleStatusChange = (id, newConnected) => setConnectedMap(prev => ({ ...prev, [id]: newConnected }));

  const filtered = useMemo(() => MOCK_INTEGRATIONS.filter(i => {
    const matchSearch = search.trim() === "" ||
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === "all" || i.category === activeCategory;
    return matchSearch && matchCat;
  }), [search, activeCategory]);

  const installed = filtered.filter(i => connectedMap[i.id]);
  const available = filtered.filter(i => !connectedMap[i.id]);
  const totalInstalled = MOCK_INTEGRATIONS.filter(i => connectedMap[i.id]).length;

  // ── Marketplace state ──────────────────────────────────────────────────────
  const [mktApps, setMktApps] = useState([]);
  const [mktLoading, setMktLoading] = useState(false);
  const [mktSearch, setMktSearch] = useState("");
  const [mktCategory, setMktCategory] = useState("all");
  const [mktPage, setMktPage] = useState(1);
  const [mktTotalPages, setMktTotalPages] = useState(1);
  const [reviewApp, setReviewApp] = useState(null);
  const [mktToast, setMktToast] = useState(null);

  const showToast = (msg, type = "success") => {
    setMktToast({ msg, type });
    setTimeout(() => setMktToast(null), 3000);
  };

  const fetchMarketplace = useCallback(async () => {
    setMktLoading(true);
    try {
      const params = { page: mktPage, limit: 18 };
      if (mktCategory !== "all") params.category = mktCategory;
      if (mktSearch.trim()) params.q = mktSearch.trim();
      const res = await api.get("/api/marketplace/apps", { params });
      setMktApps(res.data.apps || []);
      setMktTotalPages(res.data.totalPages || 1);
    } catch {
      setMktApps([]);
    } finally {
      setMktLoading(false);
    }
  }, [mktPage, mktCategory, mktSearch]);

  useEffect(() => {
    if (activeTab !== "marketplace") return;
    const t = setTimeout(fetchMarketplace, mktSearch ? 400 : 0);
    return () => clearTimeout(t);
  }, [fetchMarketplace, activeTab, mktSearch]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', background: '#0c0c0c', minHeight: 0, fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Toast */}
      {mktToast && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white ${
          mktToast.type === "error" ? "bg-red-500" : "bg-emerald-500"
        }`}>
          {mktToast.msg}
        </div>
      )}

      {/* Review modal */}
      {reviewApp && (
        <ReviewModal
          app={reviewApp}
          onClose={() => setReviewApp(null)}
          onSubmitted={() => { showToast("Review submitted!"); fetchMarketplace(); }}
        />
      )}

      {/* Header */}
      <div style={{ background: '#111111', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '20px 32px', flexShrink: 0 }}>
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div style={{ width: '36px', height: '36px', background: 'rgba(184,149,106,0.12)', border: '1px solid rgba(184,149,106,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Puzzle size={18} style={{ color: '#b8956a' }} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Apps & Integrations</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Connect your favourite tools to Chttrix</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {totalInstalled > 0 && activeTab === "integrations" && (
                <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-full px-3 py-1.5 font-medium">
                  <CheckCircle2 size={14} />{totalInstalled} connected
                </div>
              )}
              <button
                onClick={() => navigate(`/workspace/${workspaceId}/developer`)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', fontSize: '12px', fontWeight: 700, color: '#0c0c0c', background: '#b8956a', border: 'none', cursor: 'pointer', transition: 'opacity 150ms ease' }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                <Terminal size={14} />Developer Platform
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '2px', background: 'rgba(255,255,255,0.05)', padding: '3px', width: 'fit-content', marginBottom: '20px' }}>
            <button
              onClick={() => setActiveTab("integrations")}
              style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 600, background: activeTab === 'integrations' ? 'rgba(184,149,106,0.12)' : 'transparent', border: `1px solid ${activeTab === 'integrations' ? 'rgba(184,149,106,0.25)' : 'transparent'}`, color: activeTab === 'integrations' ? '#b8956a' : 'rgba(228,228,228,0.45)', cursor: 'pointer', transition: 'all 150ms ease' }}
            >
              Integrations
            </button>
            <button
              onClick={() => setActiveTab("marketplace")}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 14px', fontSize: '12px', fontWeight: 600, background: activeTab === 'marketplace' ? 'rgba(184,149,106,0.12)' : 'transparent', border: `1px solid ${activeTab === 'marketplace' ? 'rgba(184,149,106,0.25)' : 'transparent'}`, color: activeTab === 'marketplace' ? '#b8956a' : 'rgba(228,228,228,0.45)', cursor: 'pointer', transition: 'all 150ms ease' }}
            >
              <ShoppingBag size={12} />Marketplace
            </button>
          </div>

          {/* Search + filters for each tab */}
          {activeTab === "integrations" ? (
            <>
              <div className="relative mb-4">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search integrations…"
                  style={{ width: '100%', paddingLeft: '36px', paddingRight: '16px', paddingTop: '9px', paddingBottom: '9px', fontSize: '13px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#e4e4e4', outline: 'none', fontFamily: 'Inter,system-ui,sans-serif', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {INTEGRATION_CATEGORIES.map(cat => (
                  <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                    style={{ padding: '4px 12px', fontSize: '11px', fontWeight: 600, background: activeCategory === cat.id ? 'rgba(184,149,106,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${activeCategory === cat.id ? 'rgba(184,149,106,0.3)' : 'rgba(255,255,255,0.08)'}`, color: activeCategory === cat.id ? '#b8956a' : 'rgba(228,228,228,0.45)', cursor: 'pointer', transition: 'all 150ms ease', fontFamily: 'Inter,system-ui,sans-serif' }}>
                    {cat.label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="relative mb-4">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input type="text" value={mktSearch} onChange={e => { setMktSearch(e.target.value); setMktPage(1); }}
                  placeholder="Search marketplace…"
                  style={{ width: '100%', paddingLeft: '36px', paddingRight: '16px', paddingTop: '9px', paddingBottom: '9px', fontSize: '13px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#e4e4e4', outline: 'none', fontFamily: 'Inter,system-ui,sans-serif', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {MARKETPLACE_CATEGORIES.map(cat => (
                  <button key={cat.id} onClick={() => { setMktCategory(cat.id); setMktPage(1); }}
                    style={{ padding: '4px 12px', fontSize: '11px', fontWeight: 600, background: mktCategory === cat.id ? 'rgba(184,149,106,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${mktCategory === cat.id ? 'rgba(184,149,106,0.3)' : 'rgba(255,255,255,0.08)'}`, color: mktCategory === cat.id ? '#b8956a' : 'rgba(228,228,228,0.45)', cursor: 'pointer', transition: 'all 150ms ease', fontFamily: 'Inter,system-ui,sans-serif' }}>
                    {cat.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-6 custom-scrollbar">
        <div className="max-w-5xl mx-auto">

          {/* ── INTEGRATIONS TAB ─── */}
          {activeTab === "integrations" && (
            <div className="space-y-10">
              {filtered.length === 0 && (
                <div className="text-center py-20">
                  <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
                    <Grid3X3 size={28} className="text-gray-400" />
                  </div>
                  <p className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-1">No integrations found</p>
                  <p className="text-sm text-gray-400">Try a different search or category filter</p>
                </div>
              )}
              {installed.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle2 size={16} className="text-emerald-500" />
                    <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider">Installed</h2>
                    <span className="text-xs text-gray-400 font-medium ml-1">({installed.length})</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {installed.map(i => (
                      <IntegrationCard key={i.id} integration={i} connected={connectedMap[i.id]} onCardClick={() => setSelectedIntegration(i)} />
                    ))}
                  </div>
                </section>
              )}
              {available.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <Grid3X3 size={16} className="text-gray-400" />
                    <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider">Available</h2>
                    <span className="text-xs text-gray-400 font-medium ml-1">({available.length})</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {available.map(i => (
                      <IntegrationCard key={i.id} integration={i} connected={connectedMap[i.id]} onCardClick={() => setSelectedIntegration(i)} />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {/* ── MARKETPLACE TAB ─── */}
          {activeTab === "marketplace" && (
            <div>
              {mktLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 h-48 animate-pulse" />
                  ))}
                </div>
              ) : mktApps.length === 0 ? (
                <div className="text-center py-20">
                  <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
                    <ShoppingBag size={28} className="text-gray-400" />
                  </div>
                  <p className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-1">No apps found</p>
                  <p className="text-sm text-gray-400">Try a different search or category</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
                    {mktApps.length} app{mktApps.length !== 1 ? "s" : ""}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    {mktApps.map(app => (
                      <MarketplaceAppCard
                        key={app._id}
                        app={app}
                        workspaceId={workspaceId}
                        onReview={setReviewApp}
                        onInstalled={() => showToast(`${app.name} installed!`)}
                      />
                    ))}
                  </div>
                  {mktTotalPages > 1 && (
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setMktPage(p => Math.max(1, p - 1))}
                        disabled={mktPage === 1}
                        className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-40 hover:border-gray-300 transition-all"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-gray-500">Page {mktPage} of {mktTotalPages}</span>
                      <button
                        onClick={() => setMktPage(p => Math.min(mktTotalPages, p + 1))}
                        disabled={mktPage === mktTotalPages}
                        className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-40 hover:border-gray-300 transition-all"
                      >
                        Next <ChevronRight size={14} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Integration details modal (legacy tab) */}
      {selectedIntegration && (
        <IntegrationDetailsModal
          integration={selectedIntegration}
          connected={connectedMap[selectedIntegration.id]}
          onClose={() => setSelectedIntegration(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}
