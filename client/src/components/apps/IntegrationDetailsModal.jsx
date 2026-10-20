import React from "react";
import { BookOpen, Check, ListChecks, Settings2 } from "lucide-react";
import { Dialog, Btn } from "../ui/page";
import { IntegrationStatus } from "./IntegrationCard";
import "../../pages/toolkit/toolkit.css";

const listStyle = { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 };
const itemStyle = { display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, lineHeight: 1.5, color: 'var(--text-secondary)' };

/**
 * Details for one real integration: what it does, what you need, and where to set it up.
 * Setup itself (tokens, routes, webhook secrets) lives in Settings → Integrations.
 */
export default function IntegrationDetailsModal({ integration, status, canManage, onClose, onSetup }) {
  if (!integration) return null;
  const { Icon } = integration;
  const connected = status === 'connected';

  return (
    <Dialog
      open
      onClose={onClose}
      title={(
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <span className="tk-mark" data-size="sm"><Icon size={15} /></span>
          {integration.name}
        </span>
      )}
      lead={<span style={{ display: 'inline-flex', marginTop: 4 }}><IntegrationStatus status={status} /></span>}
      footer={(
        <>
          <a className="gl-btn gl-btn--ghost" href={integration.docs} target="_blank" rel="noopener noreferrer" style={{ marginRight: 'auto', textDecoration: 'none' }}>
            <BookOpen size={13} />Setup guide
          </a>
          <Btn variant="ghost" onClick={onClose}>Close</Btn>
          <Btn variant="primary" icon={Settings2} onClick={onSetup}>
            {connected ? 'Manage in settings' : canManage === false ? 'View in settings' : 'Set up in settings'}
          </Btn>
        </>
      )}
    >
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: 'var(--text-secondary)' }}>{integration.description}</p>

      <div>
        <div className="cd-label" style={{ marginBottom: 8 }}>What it does</div>
        <ul style={listStyle}>
          {integration.useCases.map((u) => (
            <li key={u} style={itemStyle}><Check size={14} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 3 }} />{u}</li>
          ))}
        </ul>
      </div>

      <div>
        <div className="cd-label" style={{ marginBottom: 8 }}>What you need</div>
        <ul style={listStyle}>
          {integration.needs.map((n) => (
            <li key={n} style={itemStyle}><ListChecks size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 3 }} />{n}</li>
          ))}
        </ul>
      </div>

      {canManage === false && (
        <p className="cd-hint" style={{ margin: 0 }}>Only workspace owners and admins can connect or change integrations.</p>
      )}
    </Dialog>
  );
}
