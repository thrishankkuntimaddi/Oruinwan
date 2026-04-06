import React, { useState } from "react";
import { Puzzle, ExternalLink, CheckCircle2, Circle } from "lucide-react";
import { MOCK_INTEGRATIONS } from "../../apps/mock/mockIntegrations";

const FONT = 'Inter, system-ui, -apple-system, sans-serif';

// Channel-relevant integrations only
const CHANNEL_INTEGRATIONS = MOCK_INTEGRATIONS.filter((i) =>
  ["github", "jira", "linear", "zoom"].includes(i.id)
);

/**
 * IntegrationsTab
 * Channel-level integration toggles — all local state, no API calls.
 *
 * Shows each integration with a toggle switch.
 * When toggled on: shows "Events will appear in this channel."
 * "Not Connected" integrations show a link to the Apps page.
 */
export default function IntegrationsTab({ globalConnectedMap = {} }) {
  // Channel-level enabled state (per integration for this channel)
  const [channelEnabled, setChannelEnabled] = useState({
    github: false,
    jira: false,
    linear: false,
    zoom: false,
  });

  const toggleIntegration = (id) => {
    setChannelEnabled((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <p style={{
        fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 4px',
        lineHeight: 1.65, fontFamily: FONT,
      }}>
        Enable integrations for this channel. Events from connected apps will appear here as messages.
      </p>

      {CHANNEL_INTEGRATIONS.map((integration) => {
        const isGloballyConnected = globalConnectedMap[integration.id] ?? integration.connected;
        const isEnabled = channelEnabled[integration.id];
        const isActive = isEnabled && isGloballyConnected;

        return (
          <div
            key={integration.id}
            style={{
              display: 'flex', alignItems: 'center', gap: '14px',
              padding: '12px 14px', borderRadius: '2px',
              border: `1px solid ${isActive ? 'rgba(184,149,106,0.3)' : 'var(--border-default)'}`,
              backgroundColor: isActive ? 'rgba(184,149,106,0.06)' : 'var(--bg-active)',
              transition: 'border-color 150ms ease, background-color 150ms ease',
            }}
          >
            {/* Emoji icon */}
            <div style={{
              width: '36px', height: '36px', borderRadius: '2px', flexShrink: 0,
              backgroundColor: 'var(--bg-hover)',
              border: '1px solid var(--border-default)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '18px',
            }}>
              {integration.emoji}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                <span style={{
                  fontSize: '13px', fontWeight: 500,
                  color: 'var(--text-primary)', fontFamily: FONT,
                }}>
                  {integration.name}
                </span>
                {isGloballyConnected ? (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '3px',
                    fontSize: '9px', fontWeight: 700, letterSpacing: '0.06em',
                    color: 'var(--accent)',
                    backgroundColor: 'rgba(184,149,106,0.12)',
                    border: '1px solid rgba(184,149,106,0.2)',
                    borderRadius: '99px', padding: '1px 7px', fontFamily: FONT,
                  }}>
                    <CheckCircle2 size={9} /> Connected
                  </span>
                ) : (
                  <span style={{
                    fontSize: '9px', fontWeight: 600,
                    color: 'var(--text-muted)',
                    backgroundColor: 'var(--bg-hover)',
                    border: '1px solid var(--border-default)',
                    borderRadius: '99px', padding: '1px 7px', fontFamily: FONT,
                  }}>
                    Not Connected
                  </span>
                )}
              </div>

              {isActive ? (
                <p style={{
                  fontSize: '11px', color: 'var(--accent)', margin: 0,
                  fontWeight: 500, fontFamily: FONT,
                }}>
                  ✓ Events will appear in this channel.
                </p>
              ) : !isGloballyConnected ? (
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, fontFamily: FONT }}>
                  Connect {integration.name} in{' '}
                  <span style={{
                    color: 'var(--accent)', cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: '2px',
                    transition: 'opacity 150ms ease',
                  }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                  >
                    Apps <ExternalLink size={9} />
                  </span>{' '}
                  to enable.
                </p>
              ) : (
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, fontFamily: FONT }}>
                  {integration.description.slice(0, 60)}…
                </p>
              )}
            </div>

            {/* Toggle switch */}
            <button
              onClick={() => isGloballyConnected && toggleIntegration(integration.id)}
              disabled={!isGloballyConnected}
              title={!isGloballyConnected ? `Connect ${integration.name} first in Apps` : ''}
              style={{
                position: 'relative', width: '40px', height: '22px',
                backgroundColor: isActive ? 'var(--accent)' : 'var(--bg-hover)',
                border: `1px solid ${isActive ? 'var(--border-accent)' : 'var(--border-default)'}`,
                borderRadius: '2px', flexShrink: 0, outline: 'none',
                cursor: !isGloballyConnected ? 'not-allowed' : 'pointer',
                opacity: !isGloballyConnected ? 0.4 : 1,
                transition: 'background-color 150ms ease',
              }}
              role="switch"
              aria-checked={isActive}
            >
              <span style={{
                position: 'absolute', top: '3px',
                left: isActive ? '20px' : '3px',
                width: '14px', height: '14px',
                backgroundColor: isActive ? '#0c0c0c' : 'var(--text-muted)',
                borderRadius: '1px',
                transition: 'left 150ms ease',
              }} />
            </button>
          </div>
        );
      })}

      {/* Footer hint */}
      <div style={{
        marginTop: '4px', padding: '12px 14px', borderRadius: '2px',
        backgroundColor: 'var(--bg-active)',
        border: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'flex-start', gap: '10px',
      }}>
        <Puzzle size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: '1px' }} />
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.65, fontFamily: FONT }}>
          Want more integrations? Visit{' '}
          <span style={{ color: 'var(--accent)', fontWeight: 500, cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            Apps &amp; Integrations
          </span>
          {' '}to connect additional tools to your workspace.
        </p>
      </div>
    </div>
  );
}
