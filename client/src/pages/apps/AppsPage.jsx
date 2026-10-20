import React, { useMemo, useState } from "react";
import { Puzzle, Terminal, LayoutTemplate, Settings2 } from "lucide-react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useFlag } from '../../contexts/FeatureFlagsContext';
import IntegrationCard from "../../components/apps/IntegrationCard";
import IntegrationDetailsModal from "../../components/apps/IntegrationDetailsModal";
import MarketplacePanel from "../../components/apps/MarketplacePanel";
import useIsWorkspaceAdmin from "../../components/apps/useIsWorkspaceAdmin";
import { REAL_INTEGRATIONS, BASIC_CONNECTIONS } from "../../components/apps/realIntegrations";
import { getIntegrations, getWebhooks } from "../../services/integrations.service";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import { DashPage, PageHead, Section, Grid, Btn, useAsync } from "../../components/ui/page";
import "../toolkit/toolkit.css";

/** Agents & tools → Apps: marketplace apps for this workspace and the integrations Oruinwan supports. */
export default function AppsPage() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { activeWorkspace } = useWorkspace();
  const isAdmin = useIsWorkspaceAdmin(workspaceId);

  // GitHub / Jira / Zoom only exist on servers with the `integrations` release flag on.
  const integrationsEnabled = useFlag('integrations');
  const [selected, setSelected] = useState(null);

  const { data: statusData, loading: statusLoading } = useAsync(async () => {
    const [integrations, webhooks] = await Promise.all([
      getIntegrations(workspaceId).catch(() => []),
      getWebhooks(workspaceId).catch(() => []),
    ]);
    return { integrations: integrations || [], webhooks: webhooks || [] };
  }, [workspaceId], { enabled: Boolean(integrationsEnabled && workspaceId) });

  const statusOf = useMemo(() => (integration) => {
    if (statusLoading) return 'loading';
    if (integration.type === 'webhook') return statusData?.webhooks?.length ? 'connected' : 'none';
    const rec = statusData?.integrations?.find((i) => i.type === integration.type);
    return rec?.status === 'connected' ? 'connected' : rec?.status === 'error' ? 'error' : 'none';
  }, [statusData, statusLoading]);

  const openSettings = () => {
    try { localStorage.setItem('lastWorkspaceId', String(workspaceId)); } catch { /* storage blocked */ }
    navigate('/settings?tab=integrations', { state: { from: location.pathname } });
  };

  return (
    <DashPage
      head={(
        <PageHead
          eyebrow={activeWorkspace?.name ? `${activeWorkspace.name} · Agents & tools` : 'Agents & tools'}
          title="Apps"
          icon={Puzzle}
          lead="Add apps to this workspace and connect the tools your team already works in."
          actions={(
            <>
              <Btn variant="ghost" icon={LayoutTemplate} onClick={() => navigate(`/workspace/${workspaceId}/templates`)}>Templates</Btn>
              <Btn variant="ghost" icon={Terminal} onClick={() => navigate(`/workspace/${workspaceId}/developer`)}>Developer platform</Btn>
            </>
          )}
        />
      )}
    >
      {integrationsEnabled && (
        <Section
          title="Integrations"
          lead="Bring GitHub, Jira and Zoom into your channels, or send events anywhere with webhooks."
          action={<Btn size="sm" variant="ghost" icon={Settings2} onClick={openSettings}>Integration settings</Btn>}
        >
          <Grid min={230}>
            {REAL_INTEGRATIONS.map((i) => (
              <IntegrationCard key={i.id} integration={i} status={statusOf(i)} onCardClick={() => setSelected(i)} />
            ))}
          </Grid>
          <p className="cd-hint" style={{ margin: 0 }}>
            Basic connections for {BASIC_CONNECTIONS.slice(0, -1).join(', ')} and {BASIC_CONNECTIONS.at(-1)} are also in integration settings.
          </p>
        </Section>
      )}

      <Section title="Marketplace" lead="Apps built for Oruinwan. Installing one adds it for everyone in this workspace.">
        <MarketplacePanel workspaceId={workspaceId} canManage={isAdmin} />
      </Section>

      {integrationsEnabled && selected && (
        <IntegrationDetailsModal
          integration={selected}
          status={statusOf(selected)}
          canManage={isAdmin}
          onClose={() => setSelected(null)}
          onSetup={() => { setSelected(null); openSettings(); }}
        />
      )}
    </DashPage>
  );
}
