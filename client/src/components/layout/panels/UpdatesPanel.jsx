import React from "react";
import { Layout, User, Bell, Hash, Zap } from "lucide-react";
import { useUpdates } from "../../../contexts/UpdatesContext";

const S = {
  panel:   { display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)', borderRight: '1px solid var(--border-subtle)' },
  header:  { height: '56px', display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '20px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 },
  title:   { fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Inter, system-ui, sans-serif' },
  label:   { fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'Inter, system-ui, sans-serif' },
  divider: { height: '1px', background: 'var(--bg-active)', margin: '8px 12px' },
};

const navBtn = (active) => ({
  width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
  padding: '8px 12px',
  background: active ? 'rgba(184,149,106,0.1)' : 'transparent',
  border: active ? '1px solid rgba(184,149,106,0.2)' : '1px solid transparent',
  color: active ? '#b8956a' : 'rgba(228,228,228,0.5)',
  fontSize: '13px', fontWeight: active ? 600 : 400,
  cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'left',
  transition: 'all 150ms ease',
});

const FILTERS = [
  { id: 'all',       label: 'Team Pulse',       Icon: Zap },
  { id: 'my-posts',  label: 'My Achievements',  Icon: User },
  { id: 'mentions',  label: 'Mentions',          Icon: Bell },
];

const TAGS = ['#Milestone', '#BugFix', '#Launch', '#Design', '#Engineering'];

const UpdatesPanel = () => {
  const { activeFilter, setActiveFilter } = useUpdates();

  return (
    <div style={S.panel}>
      <div style={S.header}>
        <Layout size={16} style={{ color: '#b8956a', flexShrink: 0 }} />
        <span style={S.title}>Updates</span>
      </div>

      <div style={{ padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <p style={{ ...S.label, padding: '4px 12px 8px' }}>Filter</p>
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setActiveFilter(f.id)}
            style={navBtn(activeFilter === f.id)}
            onMouseEnter={e => { if (activeFilter !== f.id) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
            onMouseLeave={e => { if (activeFilter !== f.id) e.currentTarget.style.background = 'transparent'; }}
          >
            <f.Icon size={14} style={{ flexShrink: 0 }} />
            {f.label}
          </button>
        ))}
      </div>

      <div style={S.divider} />

      <div style={{ padding: '8px 20px' }}>
        <p style={{ ...S.label, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Hash size={11} /> Trending Topics
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {TAGS.map(tag => (
            <span
              key={tag}
              style={{ padding: '3px 10px', background: 'var(--bg-hover)', border: '1px solid var(--border-default)', fontSize: '11px', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', transition: 'border-color 150ms ease' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(184,149,106,0.3)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default UpdatesPanel;
