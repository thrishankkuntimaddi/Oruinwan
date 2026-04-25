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

function StarRating({ rating, size = 12 }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
      {Array.from({ length: full }).map((_, i) => (
        <Star key={`f${i}`} size={size} style={{ color: '#b8956a', fill: '#b8956a' }} />
      ))}
      {half && <StarHalf size={size} style={{ color: '#b8956a', fill: '#b8956a' }} />}
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
      setError(err.response?.data?.error || "Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, backgroundColor: 'var(--bg-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)', width: '100%', maxWidth: '440px', fontFamily: 'var(--font)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div>
            <h3 style={{ fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontSize: '14px' }}>Review {app.name}</h3>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '3px 0 0' }}>Share your experience with the team</p>
          </div>
          <button onClick={onClose} style={{ padding: '4px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '8px' }}>Rating</label>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} onClick={() => setRating(n)} style={{ padding: '2px', background: 'none', border: 'none', cursor: 'pointer', transition: 'transform 100ms ease' }} onMouseDown={e => (e.currentTarget.style.transform = 'scale(1.2)')} onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}>
                  <Star size={22} style={{ color: (hover || rating) >= n ? '#b8956a' : 'var(--border-accent)', fill: (hover || rating) >= n ? '#b8956a' : 'none' }} />
                </button>
              ))}
              {rating > 0 && <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>{["", "Poor", "Fair", "Good", "Great", "Excellent"][rating]}</span>}
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '8px' }}>Comment <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3} maxLength={1000} placeholder="What did you like or dislike?"
              style={{ width: '100%', padding: '8px 10px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: 'var(--font)' }}
              onFocus={e => (e.target.style.borderColor = 'var(--border-accent)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border-default)')}
            />
          </div>
          {error && <p style={{ fontSize: '12px', color: 'var(--state-danger)', margin: 0 }}>{error}</p>}
        </div>
        <div style={{ display: 'flex', gap: '8px', padding: '0 20px 16px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', backgroundColor: 'var(--bg-active)', border: '1px solid var(--border-default)', cursor: 'pointer', fontFamily: 'var(--font)' }}>Cancel</button>
          <button onClick={submit} disabled={submitting || !rating}
            style={{ flex: 1, padding: '8px', fontSize: '13px', fontWeight: 700, color: '#000', backgroundColor: 'var(--accent)', border: 'none', cursor: submitting || !rating ? 'not-allowed' : 'pointer', opacity: submitting || !rating ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontFamily: 'var(--font)' }}>
            {submitting ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />Submitting…</> : "Submit Review"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MarketplaceAppCard({ app, workspaceId, onReview, onInstalled }) {
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);

  const install = async () => {
    setInstalling(true);
    try {
      await api.post("/api/marketplace/install", { appId: app._id, workspaceId });
      setInstalled(true);
      onInstalled?.();
    } catch (err) {
      if (err.response?.status === 409) setInstalled(true);
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', overflow: 'hidden', transition: 'border-color 150ms ease' }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-default)')}>
      <div style={{ height: '2px', background: 'var(--accent)', opacity: 0.6 }} />
      <div style={{ padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
          {app.iconUrl ? (
            <img src={app.iconUrl} alt={app.name} style={{ width: '40px', height: '40px', objectFit: 'cover', flexShrink: 0 }} />
          ) : (
            <div style={{ width: '40px', height: '40px', backgroundColor: 'var(--accent-dim)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Puzzle size={18} style={{ color: 'var(--accent)' }} />
            </div>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <h3 style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{app.name}</h3>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '3px 0 0' }}>{app.developer} · v{app.version}</p>
          </div>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: '12px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{app.description}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <StarRating rating={app.avgRating || 0} />
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {app.avgRating > 0 ? <>{app.avgRating.toFixed(1)} ({app.reviewCount})</> : "No reviews yet"}
          </span>
          {app.installCount > 0 && <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}><Download size={10} />{app.installCount}</span>}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={install} disabled={installing || installed}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '7px 10px', fontSize: '11px', fontWeight: 700, background: installed ? 'var(--accent-dim)' : 'var(--accent)', border: `1px solid ${installed ? 'var(--state-success)' : 'transparent'}`, color: installed ? 'var(--state-success)' : '#000', cursor: installing || installed ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)', opacity: installing ? 0.6 : 1, transition: 'opacity 150ms ease' }}>
            {installing ? <><RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} />Installing…</> : installed ? <><CheckCircle2 size={11} />Installed</> : <><Download size={11} />Install</>}
          </button>
          <button onClick={() => onReview(app)}
            style={{ padding: '7px 10px', fontSize: '12px', color: 'var(--text-muted)', background: 'none', border: '1px solid var(--border-default)', cursor: 'pointer', transition: 'border-color 150ms ease, color 150ms ease' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-accent)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            title="Write a review">
            <MessageSquare size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

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

  const [activeTab, setActiveTab] = useState("integrations");

  
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
    const matchSearch = search.trim() === "" || i.name.toLowerCase().includes(search.toLowerCase()) || i.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === "all" || i.category === activeCategory;
    return matchSearch && matchCat;
  }), [search, activeCategory]);

  const installed = filtered.filter(i => connectedMap[i.id]);
  const available = filtered.filter(i => !connectedMap[i.id]);
  const totalInstalled = MOCK_INTEGRATIONS.filter(i => connectedMap[i.id]).length;

  
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

  
  const tabBtn = (active) => ({
    padding: '6px 14px', fontSize: '12px', fontWeight: 600,
    background: active ? 'var(--accent-dim)' : 'transparent',
    border: `1px solid ${active ? 'var(--accent)' : 'transparent'}`,
    color: active ? 'var(--accent)' : 'var(--text-muted)',
    cursor: 'pointer', transition: 'all 150ms ease', fontFamily: 'var(--font)',
    display: 'flex', alignItems: 'center', gap: '5px',
  });

  const filterBtn = (active) => ({
    padding: '4px 12px', fontSize: '11px', fontWeight: 600,
    background: active ? 'var(--accent-dim)' : 'var(--bg-hover)',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border-default)'}`,
    color: active ? 'var(--accent)' : 'var(--text-muted)',
    cursor: 'pointer', transition: 'all 150ms ease', fontFamily: 'var(--font)',
  });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)', minHeight: 0, fontFamily: 'var(--font)' }}>

      {}
      {mktToast && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 50, padding: '10px 16px', fontSize: '13px', fontWeight: 600, color: '#fff', backgroundColor: mktToast.type === "error" ? 'var(--state-danger)' : 'var(--state-success)' }}>
          {mktToast.msg}
        </div>
      )}

      {}
      {reviewApp && (
        <ReviewModal app={reviewApp} onClose={() => setReviewApp(null)}
          onSubmitted={() => { showToast("Review submitted!"); fetchMarketplace(); }} />
      )}

      {}
      <div style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', padding: '20px 32px', flexShrink: 0 }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', background: 'var(--accent-dim)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Puzzle size={18} style={{ color: 'var(--accent)' }} />
              </div>
              <div>
                <h1 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Apps &amp; Integrations</h1>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '3px 0 0' }}>Connect your favourite tools to Chttrix</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {totalInstalled > 0 && activeTab === "integrations" && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--state-success)', background: 'rgba(90,186,138,0.1)', border: '1px solid rgba(90,186,138,0.2)', padding: '5px 12px', fontWeight: 600 }}>
                  <CheckCircle2 size={13} />{totalInstalled} connected
                </div>
              )}
              <button
                onClick={() => navigate(`/workspace/${workspaceId}/developer`)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', fontSize: '12px', fontWeight: 700, color: '#000', background: 'var(--accent)', border: 'none', cursor: 'pointer', transition: 'opacity 150ms ease', fontFamily: 'var(--font)' }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                <Terminal size={14} />Developer Platform
              </button>
            </div>
          </div>

          {}
          <div style={{ display: 'flex', gap: '2px', background: 'var(--bg-active)', padding: '3px', width: 'fit-content', marginBottom: '20px' }}>
            <button onClick={() => setActiveTab("integrations")} style={tabBtn(activeTab === 'integrations')}>
              Integrations
            </button>
            <button onClick={() => setActiveTab("marketplace")} style={tabBtn(activeTab === 'marketplace')}>
              <ShoppingBag size={12} />Marketplace
            </button>
          </div>

          {}
          {activeTab === "integrations" ? (
            <>
              <div style={{ position: 'relative', marginBottom: '14px' }}>
                <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search integrations…"
                  style={{ width: '100%', paddingLeft: '36px', paddingRight: '16px', paddingTop: '9px', paddingBottom: '9px', fontSize: '13px', background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font)', boxSizing: 'border-box' }}
                  onFocus={e => (e.target.style.borderColor = 'var(--border-accent)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border-default)')} />
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {INTEGRATION_CATEGORIES.map(cat => (
                  <button key={cat.id} onClick={() => setActiveCategory(cat.id)} style={filterBtn(activeCategory === cat.id)}>{cat.label}</button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div style={{ position: 'relative', marginBottom: '14px' }}>
                <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input type="text" value={mktSearch} onChange={e => { setMktSearch(e.target.value); setMktPage(1); }} placeholder="Search marketplace…"
                  style={{ width: '100%', paddingLeft: '36px', paddingRight: '16px', paddingTop: '9px', paddingBottom: '9px', fontSize: '13px', background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font)', boxSizing: 'border-box' }}
                  onFocus={e => (e.target.style.borderColor = 'var(--border-accent)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border-default)')} />
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {MARKETPLACE_CATEGORIES.map(cat => (
                  <button key={cat.id} onClick={() => { setMktCategory(cat.id); setMktPage(1); }} style={filterBtn(mktCategory === cat.id)}>{cat.label}</button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>

          {}
          {activeTab === "integrations" && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '36px' }}>
              {filtered.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px 0' }}>
                  <div style={{ width: '56px', height: '56px', background: 'var(--bg-active)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <Grid3X3 size={24} style={{ color: 'var(--text-muted)' }} />
                  </div>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>No integrations found</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>Try a different search or category filter</p>
                </div>
              )}
              {installed.length > 0 && (
                <section>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <CheckCircle2 size={15} style={{ color: 'var(--state-success)' }} />
                    <h2 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0 }}>Installed</h2>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>({installed.length})</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
                    {installed.map(i => (
                      <IntegrationCard key={i.id} integration={i} connected={connectedMap[i.id]} onCardClick={() => setSelectedIntegration(i)} />
                    ))}
                  </div>
                </section>
              )}
              {available.length > 0 && (
                <section>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <Grid3X3 size={15} style={{ color: 'var(--text-muted)' }} />
                    <h2 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0 }}>Available</h2>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>({available.length})</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
                    {available.map(i => (
                      <IntegrationCard key={i.id} integration={i} connected={connectedMap[i.id]} onCardClick={() => setSelectedIntegration(i)} />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {}
          {activeTab === "marketplace" && (
            <div>
              {mktLoading ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="sk" style={{ height: '180px' }} />
                  ))}
                </div>
              ) : mktApps.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0' }}>
                  <div style={{ width: '56px', height: '56px', background: 'var(--bg-active)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <ShoppingBag size={24} style={{ color: 'var(--text-muted)' }} />
                  </div>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>No apps found</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>Try a different search or category</p>
                </div>
              ) : (
                <>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '16px' }}>{mktApps.length} app{mktApps.length !== 1 ? "s" : ""}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                    {mktApps.map(app => (
                      <MarketplaceAppCard key={app._id} app={app} workspaceId={workspaceId} onReview={setReviewApp} onInstalled={() => showToast(`${app.name} installed!`)} />
                    ))}
                  </div>
                  {mktTotalPages > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <button onClick={() => setMktPage(p => Math.max(1, p - 1))} disabled={mktPage === 1}
                        style={{ padding: '7px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', cursor: mktPage === 1 ? 'not-allowed' : 'pointer', opacity: mktPage === 1 ? 0.4 : 1, fontFamily: 'var(--font)' }}>
                        Previous
                      </button>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Page {mktPage} of {mktTotalPages}</span>
                      <button onClick={() => setMktPage(p => Math.min(mktTotalPages, p + 1))} disabled={mktPage === mktTotalPages}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '7px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', cursor: mktPage === mktTotalPages ? 'not-allowed' : 'pointer', opacity: mktPage === mktTotalPages ? 0.4 : 1, fontFamily: 'var(--font)' }}>
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

      {}
      {selectedIntegration && (
        <IntegrationDetailsModal integration={selectedIntegration} connected={connectedMap[selectedIntegration.id]}
          onClose={() => setSelectedIntegration(null)} onStatusChange={handleStatusChange} />
      )}
    </div>
  );
}
