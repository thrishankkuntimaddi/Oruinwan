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
import { useWorkspace } from "../../contexts/WorkspaceContext";
import { PanelEmpty } from "../../components/layout/WorkspacePanel";
import "../../styles/gloss.css";
import "../../styles/gloss-x-panels.css";

export default function AppsPage() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const { activeWorkspace } = useWorkspace();

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

  return (
    <div className="gl-x-page">

      <div className="gl-x-page-top gl-ambient">
        <div className="gl-page-head gl-x-wrap">
          <div className="gl-x-head-row">
            <span className="gl-x-head-mark" aria-hidden="true"><Puzzle size={20} /></span>
            <div style={{ minWidth: 0 }}>
              <span className="gl-eyebrow">{activeWorkspace?.name || 'Workspace'}</span>
              <h1 className="gl-page-title">Apps &amp; Integrations</h1>
              <p className="gl-page-lead">Extend your workspace with apps and templates</p>
            </div>
          </div>
          <div className="gl-x-head-actions">
            <button type="button" className="gl-btn" onClick={() => navigate(`/workspace/${workspaceId}/templates`)}>
              <LayoutTemplate size={14} />Templates
            </button>
            <button type="button" className="gl-btn" onClick={() => navigate(`/workspace/${workspaceId}/developer`)}>
              <Terminal size={14} />Developer Platform
            </button>
          </div>
        </div>

        <div className="gl-x-wrap gl-x-page-tabs">
          <div role="tablist" aria-label="Apps" className="gl-tabs gl-x-tabs-fit">
            <button type="button" role="tab" className="gl-tab" aria-selected={activeTab === 'marketplace'} onClick={() => setActiveTab("marketplace")}>
              <ShoppingBag size={13} />Marketplace
            </button>
            {integrationsEnabled && (
              <button type="button" role="tab" className="gl-tab" aria-selected={activeTab === 'integrations'} onClick={() => setActiveTab("integrations")}>
                Integrations
                <span className="gl-x-badge gl-x-badge--accent">Preview</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="gl-x-page-body">
        <div className="gl-x-wrap gl-x-page-pad">

          {activeTab === "marketplace" && (
            <MarketplacePanel workspaceId={workspaceId} canManage={isAdmin} />
          )}

          {activeTab === "integrations" && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="gl-card gl-x-note gl-x-note--accent">
                <FlaskConical size={14} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '1px' }} />
                <span><strong style={{ color: 'var(--text-primary)' }}>Preview.</strong> These integrations are a design prototype: connecting one does not link a real account and nothing is saved.</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="gl-search">
                  <Search size={14} />
                  <input type="text" className="gl-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search integrations…" aria-label="Search integrations" style={{ height: '38px', fontSize: '13px' }} />
                </div>
                <div className="gl-x-chips gl-x-chips--wrap">
                  {INTEGRATION_CATEGORIES.map(cat => (
                    <button key={cat.id} type="button" className={`gl-x-chip gl-x-chip--lg${activeCategory === cat.id ? ' is-active' : ''}`} aria-pressed={activeCategory === cat.id} onClick={() => setActiveCategory(cat.id)}>{cat.label}</button>
                  ))}
                </div>
              </div>
              {filtered.length === 0 && (
                <PanelEmpty icon={Grid3X3} title="No integrations found" text="Try a different search or category filter" />
              )}
              {[{ key: 'installed', title: 'Connected', Icon: CheckCircle2, color: 'var(--state-success)', items: installed },
                { key: 'available', title: 'Available', Icon: Grid3X3, color: 'var(--text-muted)', items: available }]
                .filter(sec => sec.items.length > 0)
                .map(({ key, title, Icon, color, items }) => (
                  <section key={key}>
                    <h2 className="gl-x-group-label" style={{ marginBottom: '14px' }}>
                      <Icon size={13} style={{ color }} />{title}<span className="gl-count">{items.length}</span>
                    </h2>
                    <div className="gl-x-grid">
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
