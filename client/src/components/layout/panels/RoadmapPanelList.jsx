import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Map as MapIcon } from 'lucide-react';
import roadmapService from '../../../services/roadmapService';
import { useOptionalSocket } from '../../../contexts/SocketContext';
import { STATUSES, progressOf, colorVar } from '../../../pages/roadmap/roadmapTimeline';
import { PanelSection, PanelEmpty } from '../WorkspacePanel';

/** Roadmap items grouped by status, filtered by the panel search (exported for tests). */
export function roadmapPanelGroups(items = [], query = '') {
    const q = String(query || '').trim().toLowerCase();
    const shown = items.filter((it) => !q || String(it.title || '').toLowerCase().includes(q));
    return STATUSES
        .map((s) => ({ key: s.value, label: s.label, items: shown.filter((it) => (it.status || 'planned') === s.value) }))
        .filter((g) => g.items.length > 0);
}

/**
 * The Roadmap tab of the Notes panel: every roadmap item, by status. Opening one shows it on
 * the roadmap page (/roadmap?item=<id> opens its drawer).
 */
export default function RoadmapPanelList({ workspaceId, query }) {
    const navigate = useNavigate();
    const location = useLocation();
    const socket = useOptionalSocket()?.socket;
    const [items, setItems] = useState(null);
    const [failed, setFailed] = useState(false);

    const load = useCallback(() => {
        if (!workspaceId) return;
        roadmapService.list(workspaceId)
            .then((d) => { setItems(d?.items || []); setFailed(false); })
            .catch(() => setFailed(true));
    }, [workspaceId]);
    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (!socket) return undefined;
        socket.on('roadmap:updated', load);
        socket.on('milestone:updated', load);
        return () => { socket.off('roadmap:updated', load); socket.off('milestone:updated', load); };
    }, [socket, load]);

    const groups = useMemo(() => roadmapPanelGroups(items || [], query), [items, query]);
    const activeItem = new URLSearchParams(location.search).get('item');

    if (items === null && !failed) {
        return <PanelSection label="Roadmap"><p className="gl-x-item-sub" style={{ padding: '10px 14px' }}>Loading…</p></PanelSection>;
    }
    if (failed && !items) {
        return <PanelEmpty icon={MapIcon} title="Couldn’t load the roadmap" action={<button type="button" className="gl-btn gl-btn--sm" onClick={load}>Try again</button>} />;
    }
    if (!groups.length) {
        return (
            <PanelEmpty
                icon={MapIcon}
                title={query ? `No roadmap items match "${query}"` : 'No roadmap items yet'}
                text={query ? undefined : 'Plans by quarter, with progress from linked milestones and tasks.'}
            />
        );
    }
    return groups.map((g) => (
        <PanelSection key={g.key} label={g.label} action={<span className="gl-count">{g.items.length}</span>}>
            {g.items.map((it) => {
                const pct = progressOf(it);
                const active = activeItem === it._id;
                return (
                    <button key={it._id} type="button" className={`gl-item${active ? ' is-active' : ''}`} aria-current={active ? 'true' : undefined}
                        onClick={() => navigate(`/workspace/${workspaceId}/roadmap?item=${it._id}`)}>
                        <span aria-hidden="true" style={{ width: 3, alignSelf: 'stretch', minHeight: 16, borderRadius: 2, background: colorVar(it.color), flexShrink: 0 }} />
                        <span className="gl-x-item-title">{it.title}</span>
                        <span className="gl-count" style={{ fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
                    </button>
                );
            })}
        </PanelSection>
    ));
}
