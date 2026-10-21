import React from "react";
import { Plug, Users } from "lucide-react";
import api from '@services/api';
import { Grid, Panel, Chip, Btn, EmptyState, ErrorState, LoadingState, useAsync } from '../ui/page';

const CATEGORY_LABELS = {
  developer: 'Developer', communication: 'Communication', files: 'Files', docs: 'Docs', pages: 'Docs',
  automation: 'Automation', productivity: 'Productivity', other: 'Other',
};

/**
 * Every integration Oruinwan ships, from the public directory
 * (GET /api/marketplace/integrations/public). Usage counts are only shown once
 * enough workspaces use a connector to keep them anonymous.
 */
export default function IntegrationsDirectory({ onSetup }) {
  const { data, loading, error, reload } = useAsync(
    () => api.get('/api/marketplace/integrations/public').then((r) => r.data.integrations || []),
    [],
  );

  if (loading) return <Panel><LoadingState label="Loading integrations…" /></Panel>;
  if (error) return <Panel><ErrorState title="Couldn’t load integrations" message={error} onRetry={reload} /></Panel>;
  if (!data?.length) return <Panel><EmptyState icon={Plug} title="No integrations listed" text="Integrations this server supports appear here." /></Panel>;

  return (
    <Grid min={220}>
      {data.map((i) => (
        <div key={i.type} className="gl-card tk-card" data-testid="integration-directory-card">
          <div className="tk-card-head">
            <span className="tk-mark"><Plug size={16} /></span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h3 className="tk-card-title">{i.label}</h3>
              <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '3px 0 0' }}>{CATEGORY_LABELS[i.category] || i.category}</p>
            </div>
          </div>
          {i.description && (
            <p className="tk-card-text" style={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{i.description}</p>
          )}
          <div className="tk-card-foot">
            {i.workspaceCount
              ? <Chip title="Workspaces with this connected"><Users size={10} />{i.workspaceCount} workspaces</Chip>
              : <span className="cd-hint">Token-based setup</span>}
            {onSetup && <Btn size="sm" variant="ghost" onClick={() => onSetup(i)}>Set up</Btn>}
          </div>
        </div>
      ))}
    </Grid>
  );
}
