import React from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { User, Inbox, Send, CheckCircle2, Trash2, Eye, Circle } from "lucide-react";

const S = {
  panel:     { display: 'flex', flexDirection: 'column', height: '100%', background: '#0c0c0c', borderRight: '1px solid rgba(255,255,255,0.06)' },
  header:    { height: '56px', display: 'flex', alignItems: 'center', paddingLeft: '20px', paddingRight: '20px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, background: '#0c0c0c' },
  label:     { fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(228,228,228,0.35)', fontFamily: 'Inter, system-ui, sans-serif' },
  title:     { fontSize: '15px', fontWeight: 700, color: '#e4e4e4', fontFamily: 'Inter, system-ui, sans-serif' },
  nav:       { padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 },
  divider:   { height: '1px', background: 'rgba(255,255,255,0.06)', margin: '8px 12px' },
};

const navBtn = (active, danger) => ({
  width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
  padding: '8px 12px', background: active ? 'rgba(184,149,106,0.1)' : 'transparent',
  border: active ? '1px solid rgba(184,149,106,0.2)' : '1px solid transparent',
  color: active ? '#b8956a' : 'rgba(228,228,228,0.5)',
  fontSize: '13px', fontWeight: active ? 600 : 400, cursor: 'pointer',
  fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'left',
  transition: 'all 150ms ease',
});

const VIEWS = [
  { key: 'my-tasks',        label: 'My Issues',   Icon: Circle },
  { key: 'shared-tasks',    label: 'Incoming',     Icon: Inbox },
  { key: 'assigned-tasks',  label: 'Given',        Icon: Send },
  { key: 'all-tasks',       label: 'All Issues',   Icon: Eye },
  null,
  { key: 'completed-tasks', label: 'Completed',    Icon: CheckCircle2 },
  { key: 'deleted-tasks',   label: 'Trash',        Icon: Trash2, danger: true },
];

const TasksPanel = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { workspaceId } = useParams();
  const activeTab = new URLSearchParams(location.search).get("tab") || "my-tasks";

  const handleNav = (tab) => {
    navigate(`/workspace/${workspaceId}/tasks?tab=${tab}`);
  };

  return (
    <div style={S.panel}>
      <div style={S.header}>
        <span style={S.title}>Tasks</span>
      </div>

      <div style={{ padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <p style={{ ...S.label, padding: '4px 12px 8px' }}>Views</p>
        {VIEWS.map((v, i) =>
          v === null
            ? <div key={i} style={S.divider} />
            : (
              <button
                key={v.key}
                onClick={() => handleNav(v.key)}
                style={navBtn(activeTab === v.key, v.danger)}
                onMouseEnter={e => { if (activeTab !== v.key) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={e => { if (activeTab !== v.key) e.currentTarget.style.background = 'transparent'; }}
              >
                <v.Icon size={14} style={{ flexShrink: 0 }} />
                {v.label}
              </button>
            )
        )}
      </div>
    </div>
  );
};

export default TasksPanel;
