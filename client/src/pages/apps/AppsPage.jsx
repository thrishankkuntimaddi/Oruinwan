import React, { useState, useMemo } from "react";
import {
  Search, Puzzle, CheckCircle2, Grid3X3, Terminal, ShoppingBag, LayoutTemplate, FlaskConical
} from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { MOCK_INTEGRATIONS, INTEGRATION_CATEGORIES } from "../../components/apps/mock/mockIntegrations";
import { useFlag } from '../../contexts/FeatureFlagsContext';
import IntegrationCard from "../../components/apps/IntegrationCard";
import IntegrationDetailsModal from "../../components/apps/IntegrationDetailsModal";
import MarketplacePanel from "../../components/apps/MarketplacePanel";
import useIsWorkspaceAdmin from "../../components/apps/useIsWorkspaceAdmin";

export default function AppsPage() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();

  // Integrations still run on mock data, so without the flag only the Marketplace tab exists.
  const integrationsEnabled = useFlag('integrations');
  const [selectedTab, setActiveTab] = useState("marketplace");
  const activeTab = integrationsEnabled ? selectedTab : "marketplace";

  
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
  const isAdmin = useIsWorkspaceAdmin(workspaceId);

  const tabBtn = (active) => ({
    padding: '10px 2px', marginBottom: '-1px', fontSize: '12px', fontWeight: 600,
    background: 'transparent', border: 'none',
    borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
    color: active ? 'var(--text-primary)' : 'var(--text-muted)',
    cursor: 'pointer', transition: 'color 150ms ease, border-color 150ms ease', fontFamily: 'var(--font)',
    display: 'flex', alignItems: 'center', gap: '6px',
  });

  const filterBtn = (active) => ({
    padding: '4px 12px', fontSize: '11px', fontWeight: 600, borderRadius: '2px',
    background: active ? 'var(--accent-dim)' : 'var(--bg-hover)',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border-default)'}`,
    color: active ? 'var(--accent)' : 'var(--text-muted)',
    cursor: 'pointer', transition: 'all 150ms ease', fontFamily: 'var(--font)',
  });

  const secondaryBtn = { display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '2px', cursor: 'pointer', transition: 'border-color 150ms ease, color 150ms ease', fontFamily: 'var(--font)' };
  const hoverOn = e => { e.currentTarget.style.borderColor = 'var(--border-accent)'; e.currentTarget.style.color = 'var(--text-primary)'; };
  const hoverOff = e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.color = 'var(--text-secondary)'; };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)', minHeight: 0, fontFamily: 'var(--font)' }}>

      <div style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', padding: '20px 32px 0', flexShrink: 0 }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', background: 'var(--accent-dim)', border: '1px solid var(--border-accent)', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Puzzle size={18} style={{ color: 'var(--accent)' }} />
              </div>
              <div>
                <h1 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Apps &amp; Integrations</h1>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '3px 0 0' }}>Extend your workspace with apps and templates</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <button onClick={() => navigate(`/workspace/${workspaceId}/templates`)} style={secondaryBtn} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
                <LayoutTemplate size={14} />Templates
              </button>
              <button onClick={() => navigate(`/workspace/${workspaceId}/developer`)} style={secondaryBtn} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
                <Terminal size={14} />Developer Platform
              </button>
            </div>
          </div>

          <div role="tablist" style={{ display: 'flex', gap: '20px' }}>
            <button role="tab" aria-selected={activeTab === 'marketplace'} onClick={() => setActiveTab("marketplace")} style={tabBtn(activeTab === 'marketplace')}>
              <ShoppingBag size={13} />Marketplace
            </button>
            {integrationsEnabled && (
              <button role="tab" aria-selected={activeTab === 'integrations'} onClick={() => setActiveTab("integrations")} style={tabBtn(activeTab === 'integrations')}>
                Integrations
                <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent)', border: '1px solid var(--border-accent)', borderRadius: '2px', padding: '1px 5px' }}>Preview</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>

          {activeTab === "marketplace" && (
            <MarketplacePanel workspaceId={workspaceId} canManage={isAdmin} />
          )}

          {activeTab === "integrations" && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 14px', fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--accent-dim)', border: '1px solid var(--border-accent)', borderRadius: '2px' }}>
                <FlaskConical size={14} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '1px' }} />
                <span><strong style={{ color: 'var(--text-primary)' }}>Preview.</strong> These integrations are a design prototype: connecting one does not link a real account and nothing is saved.</span>
              </div>
              <div>
                <div style={{ position: 'relative', marginBottom: '14px' }}>
                  <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search integrations…"
                    style={{ width: '100%', paddingLeft: '36px', paddingRight: '16px', paddingTop: '9px', paddingBottom: '9px', fontSize: '13px', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '2px', color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font)', boxSizing: 'border-box' }}
                    onFocus={e => (e.target.style.borderColor = 'var(--border-accent)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--border-default)')} />
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {INTEGRATION_CATEGORIES.map(cat => (
                    <button key={cat.id} onClick={() => setActiveCategory(cat.id)} style={filterBtn(activeCategory === cat.id)}>{cat.label}</button>
                  ))}
                </div>
              </div>
              {filtered.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px 0' }}>
                  <div style={{ width: '56px', height: '56px', background: 'var(--bg-active)', border: '1px solid var(--border-default)', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <Grid3X3 size={24} style={{ color: 'var(--text-muted)' }} />
                  </div>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>No integrations found</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>Try a different search or category filter</p>
                </div>
              )}
              {[{ key: 'installed', title: 'Connected', Icon: CheckCircle2, color: 'var(--state-success)', items: installed },
                { key: 'available', title: 'Available', Icon: Grid3X3, color: 'var(--text-muted)', items: available }]
                .filter(sec => sec.items.length > 0)
                .map(({ key, title, Icon, color, items }) => (
                  <section key={key}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                      <Icon size={15} style={{ color }} />
                      <h2 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0 }}>{title}</h2>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>({items.length})</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
                      {items.map(i => (
                        <IntegrationCard key={i.id} integration={i} connected={connectedMap[i.id]} onCardClick={() => setSelectedIntegration(i)} />
                      ))}
                    </div>
                  </section>
                ))}
            </div>
          )}
        </div>
      </div>

      {activeTab === "integrations" && selectedIntegration && (
        <IntegrationDetailsModal integration={selectedIntegration} connected={connectedMap[selectedIntegration.id]}
          onClose={() => setSelectedIntegration(null)} onStatusChange={handleStatusChange} />
      )}
    </div>
  );
}
