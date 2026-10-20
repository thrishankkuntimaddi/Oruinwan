import React from "react";
import { ArrowRight } from "lucide-react";
import { Chip, Dot } from "../ui/page";
import "../../pages/toolkit/toolkit.css";

/** Status chip for an integration: connected / needs attention / not set up. */
export function IntegrationStatus({ status }) {
  if (status === 'connected') return <Chip tone="success"><Dot tone="success" />Connected</Chip>;
  if (status === 'error') return <Chip tone="danger">Needs attention</Chip>;
  if (status === 'loading') return <Chip>Checking…</Chip>;
  return <Chip>Not set up</Chip>;
}

/** A real integration (GitHub, Jira, Zoom, webhooks). The whole card opens its details. */
export default function IntegrationCard({ integration, status, onCardClick }) {
  const { Icon } = integration;
  return (
    <button type="button" onClick={onCardClick} className="gl-card gl-card--interactive tk-card" style={{ textAlign: 'left', fontFamily: 'var(--font)', color: 'inherit', width: '100%' }}>
      <div className="tk-card-head">
        <span className="tk-mark"><Icon size={18} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 className="tk-card-title">{integration.name}</h3>
          <div style={{ marginTop: 4 }}><IntegrationStatus status={status} /></div>
        </div>
      </div>
      <p className="tk-card-text">{integration.summary}</p>
      <div className="tk-card-foot">
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {status === 'connected' ? 'Manage' : 'How it works'} <ArrowRight size={13} />
        </span>
      </div>
    </button>
  );
}
