import React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Bot, LayoutGrid, LayoutTemplate, Puzzle, SquareTerminal, Workflow } from 'lucide-react';
import WorkspacePanel, { PanelSection } from '../WorkspacePanel';
import { openAgentDm, useAgents } from '../../../features/agents/useAgents';
import { useToast } from '../../../contexts/ToastContext';
import '../../../styles/gloss-x-panels.css';

/** Agents & tools: all agents, workflows, apps, and a shortcut to chat with each installed agent. */
const AgentsPanel = ({ title }) => {
    const { workspaceId } = useParams();
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const { showToast } = useToast();
    const { agents } = useAgents(workspaceId);
    const installed = agents.filter((a) => a.installed);
    const base = `/workspace/${workspaceId}`;

    const nav = [
        { label: 'All agents', Icon: LayoutGrid, path: `${base}/agents`, active: pathname.startsWith(`${base}/agents`) },
        { label: 'Workflows', Icon: Workflow, path: `${base}/automations`, active: pathname.startsWith(`${base}/automations`) },
        { label: 'Apps', Icon: Puzzle, path: `${base}/apps`, active: pathname.startsWith(`${base}/apps`) },
        { label: 'Templates', Icon: LayoutTemplate, path: `${base}/templates`, active: pathname.startsWith(`${base}/templates`) },
        { label: 'Developer', Icon: SquareTerminal, path: `${base}/developer`, active: pathname.startsWith(`${base}/developer`) },
    ];

    const chat = async (agent) => {
        try {
            const dmId = await openAgentDm(workspaceId, agent.id);
            navigate(`${base}/home/dm/${dmId}`);
        } catch (err) {
            showToast(err.response?.data?.message || `Couldn't open ${agent.name}`, 'error');
        }
    };

    return (
        <WorkspacePanel icon={Bot} title="Agents & tools" subtitle={title}>
            {nav.map(({ label, Icon, path, active }) => (
                <button key={label} type="button" className={`gl-item${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined} onClick={() => navigate(path)}>
                    <Icon size={13} style={{ flexShrink: 0 }} />
                    <span className="gl-x-item-title">{label}</span>
                </button>
            ))}
            <PanelSection label="Chat with an agent">
                {installed.map((a) => (
                    <button key={a.id} type="button" className="gl-item" onClick={() => chat(a)} data-testid={`agent-chat-${a.id}`}>
                        <img src={a.icon} alt="" width={16} height={16} style={{ borderRadius: 4, flexShrink: 0 }} />
                        <span className="gl-x-item-title">{a.name}</span>
                    </button>
                ))}
            </PanelSection>
        </WorkspacePanel>
    );
};

export default AgentsPanel;
