import { useCallback, useEffect, useState } from 'react';
import api from '@services/api';

export const AGENTS_CHANGED = 'oruinwan:agents-changed';

/**
 * Agents & tools for a workspace: { agents, tools, canManage, policy, loading, error, reload }.
 * Each agent says whether it's installed for the workspace (`installedForWorkspace`), connected
 * just for you (`connectedForYou`), and which one answers you (`inUse`: 'built-in' | 'personal' |
 * 'workspace' | null). `installed` means you can chat with it either way.
 */
export function useAgents(workspaceId) {
    const [state, setState] = useState({ agents: [], tools: [], canManage: false, policy: null, loading: true, error: null });

    const reload = useCallback(async () => {
        if (!workspaceId) return;
        try {
            const { data } = await api.get('/api/agents', { params: { workspaceId } });
            setState({ agents: data.agents || [], tools: data.tools || [], canManage: Boolean(data.canManage), policy: data.policy || null, loading: false, error: null });
        } catch (err) {
            setState((s) => ({ ...s, loading: false, error: err.response?.data?.message || 'Could not load agents' }));
        }
    }, [workspaceId]);

    useEffect(() => {
        reload();
        window.addEventListener(AGENTS_CHANGED, reload);
        return () => window.removeEventListener(AGENTS_CHANGED, reload);
    }, [reload]);

    return { ...state, reload };
}

/** Tells every list on screen that agents were installed or removed. */
export const agentsChanged = () => window.dispatchEvent(new CustomEvent(AGENTS_CHANGED));

/** Opens (creating if needed) the caller's conversation with an agent and returns its DM id. */
export async function openAgentDm(workspaceId, agentId) {
    const { data } = await api.post(`/api/agents/${agentId}/dm`, { workspaceId });
    return data.dmSessionId;
}

export async function installAgent(workspaceId, agentId, apiKey, model) {
    const { data } = await api.post('/api/agents/install', { workspaceId, agentId, apiKey, ...(model ? { model } : {}) });
    agentsChanged();
    return data.agent;
}

export async function uninstallAgent(workspaceId, agentId) {
    await api.delete(`/api/agents/${agentId}`, { params: { workspaceId } });
    agentsChanged();
}

/* ── Your own connections ("just for me") ─────────────────────────────── */

/** Connect your own key for an agent. The server checks it with the provider first. */
export async function connectOwnAgent(workspaceId, agentId, apiKey, model) {
    const { data } = await api.post(`/api/connections/agents/${agentId}`, { workspaceId, apiKey, ...(model ? { model } : {}) });
    agentsChanged();
    return data.connection;
}

/** Remove your own connection to an agent or tool ('anthropic', 'github', …). Never anyone else's. */
export async function disconnectOwn(workspaceId, provider) {
    await api.delete(`/api/connections/${provider}`, { params: { workspaceId } });
    agentsChanged();
}

export async function connectOwnGithubToken(workspaceId, token) {
    const { data } = await api.post('/api/connections/github/token', { workspaceId, token });
    agentsChanged();
    return data.connection;
}

/** Starts GitHub's own sign-in; GitHub sends you back to `returnTo` with ?connected=github. */
export async function startGithubAuthorize(workspaceId, returnTo) {
    const { data } = await api.post('/api/connections/github/authorize', { workspaceId, returnTo });
    window.location.assign(data.url);
}

export async function connectOwnJira(workspaceId, { baseUrl, email, apiToken }) {
    const { data } = await api.post('/api/connections/jira', { workspaceId, baseUrl, email, apiToken });
    agentsChanged();
    return data.connection;
}

/** Your connections, the workspace policy, and (admins) how many people use their own. */
export async function getConnections(workspaceId) {
    const { data } = await api.get('/api/connections', { params: { workspaceId } });
    return data;
}

/** Admins: let members connect their own agents and tools, or not. */
export async function setMembersMayConnect(workspaceId, membersMayConnect) {
    const { data } = await api.put('/api/connections/policy', { workspaceId, membersMayConnect });
    agentsChanged();
    return data.policy;
}
