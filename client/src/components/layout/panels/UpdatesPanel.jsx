import React from "react";
import { Megaphone, User, Bell, Hash, Zap } from "lucide-react";
import { useUpdates } from "../../../contexts/UpdatesContext";
import WorkspacePanel, { PanelSection } from "../WorkspacePanel";
import "../../../styles/gloss-x-panels.css";

const FILTERS = [
  { id: 'all',       label: 'Team Pulse',       Icon: Zap },
  { id: 'my-posts',  label: 'My Achievements',  Icon: User },
  { id: 'mentions',  label: 'Mentions',          Icon: Bell },
];

const TAGS = ['#Milestone', '#BugFix', '#Launch', '#Design', '#Engineering'];

const UpdatesPanel = ({ title }) => {
  const { activeFilter, setActiveFilter } = useUpdates();

  return (
    <WorkspacePanel icon={Megaphone} title="Updates" subtitle={title}>
      <PanelSection label="Filter">
        {FILTERS.map(f => (
          <button key={f.id} type="button" onClick={() => setActiveFilter(f.id)}
            className={`gl-item${activeFilter === f.id ? ' is-active' : ''}`}
            aria-current={activeFilter === f.id ? 'page' : undefined}>
            <f.Icon size={14} className="gl-x-item-icon" />
            <span className="gl-x-item-title">{f.label}</span>
          </button>
        ))}
      </PanelSection>

      <PanelSection label="Trending Topics" icon={Hash}>
        <div className="gl-x-chips gl-x-chips--wrap" style={{ padding: '4px 14px' }}>
          {TAGS.map(tag => <span key={tag} className="gl-x-chip">{tag}</span>)}
        </div>
      </PanelSection>
    </WorkspacePanel>
  );
};

export default UpdatesPanel;
