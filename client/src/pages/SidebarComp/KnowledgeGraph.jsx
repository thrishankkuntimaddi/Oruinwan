import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Network, ZoomIn, ZoomOut, RefreshCw, Plus, FileText, Maximize2 } from 'lucide-react';
import { useKnowledge } from '../../hooks/useKnowledge';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useToast } from '../../contexts/ToastContext';
import {
    DashPage, PageHead, Panel, Btn, IconBtn, Chip, LoadingState, ErrorState, EmptyState,
} from '../../components/ui/page';

function runForce(nodes, edges, width, height, iterations = 200) {
    // Spread scaled down so small graphs stay together instead of being pushed to the edges.
    const k = Math.sqrt((width * height) / Math.max(nodes.length, 1)) * 0.45;
    const positions = nodes.map((_, i) => ({
        x: width / 2 + Math.cos((i / nodes.length) * Math.PI * 2) * (width * 0.35),
        y: height / 2 + Math.sin((i / nodes.length) * Math.PI * 2) * (height * 0.35),
        vx: 0, vy: 0,
    }));

    const nodeById = {};
    nodes.forEach((n, i) => { nodeById[n.id?.toString()] = i; });

    for (let iter = 0; iter < iterations; iter++) {
        const temp = 1 - iter / iterations;

        
        for (let i = 0; i < positions.length; i++) {
            for (let j = i + 1; j < positions.length; j++) {
                const dx = positions[i].x - positions[j].x || 0.01;
                const dy = positions[i].y - positions[j].y || 0.01;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const force = (k * k) / dist;
                positions[i].vx += (dx / dist) * force;
                positions[i].vy += (dy / dist) * force;
                positions[j].vx -= (dx / dist) * force;
                positions[j].vy -= (dy / dist) * force;
            }
        }

        
        for (const edge of edges) {
            const ai = nodeById[edge.from?.toString()];
            const bi = nodeById[edge.to?.toString()];
            if (ai === undefined || bi === undefined) continue;
            const dx = positions[bi].x - positions[ai].x;
            const dy = positions[bi].y - positions[ai].y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const force = (dist * dist) / k;
            positions[ai].vx += (dx / dist) * force * 0.5;
            positions[ai].vy += (dy / dist) * force * 0.5;
            positions[bi].vx -= (dx / dist) * force * 0.5;
            positions[bi].vy -= (dy / dist) * force * 0.5;
        }

        
        for (const pos of positions) {
            // A gentle pull to the centre keeps unlinked pages near the rest.
            pos.vx += (width / 2 - pos.x) * 0.25;
            pos.vy += (height / 2 - pos.y) * 0.25;
            const speed = Math.sqrt(pos.vx * pos.vx + pos.vy * pos.vy) || 1;
            const capped = Math.min(speed, temp * 30);
            pos.x += (pos.vx / speed) * capped;
            pos.y += (pos.vy / speed) * capped;
            pos.x = Math.max(80, Math.min(width - 80, pos.x));
            pos.y = Math.max(50, Math.min(height - 60, pos.y));
            pos.vx = 0; pos.vy = 0;
        }
    }
    return positions;
}

const W = 900, H = 600;

const KnowledgeGraph = () => {
    const { workspaceId } = useParams();
    const navigate = useNavigate();
    const { activeWorkspace } = useWorkspace();
    const { showToast } = useToast();
    const { getGraph, createPage } = useKnowledge();
    const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
    const [loading, setLoading] = useState(true);
    const [zoom, setZoom] = useState(1);
    const [positions, setPositions] = useState([]);
    const [hovered, setHovered] = useState(null);
    const [error, setError] = useState(null);
    const [creating, setCreating] = useState(false);

    const load = useCallback(() => {
        if (!workspaceId) return;
        setLoading(true);
        setError(null);
        getGraph(workspaceId)
            .then(data => {
                setGraphData(data);
                setPositions(data.nodes.length > 0 ? runForce(data.nodes, data.edges, W, H) : []);
            })
            .catch(() => setError('The graph could not be loaded.'))
            .finally(() => setLoading(false));
    }, [workspaceId, getGraph]);

    useEffect(() => { load(); }, [load]);

    const createFirst = async () => {
        setCreating(true);
        try {
            const p = await createPage(workspaceId, { title: 'Untitled page', content: '' });
            navigate(`/workspace/${workspaceId}/knowledge/${p._id}`);
        } catch {
            showToast('Could not create the page', 'error');
        } finally { setCreating(false); }
    };

    const openNode = (node) => navigate(`/workspace/${workspaceId}/knowledge/${node.id}`);

    const index = useMemo(() => {
        const m = {};
        graphData.nodes.forEach((n, i) => { m[n.id?.toString()] = i; });
        return m;
    }, [graphData.nodes]);
    const linked = useMemo(() => {
        const s = new Set();
        graphData.edges.forEach((e) => { s.add(e.from?.toString()); s.add(e.to?.toString()); });
        return s;
    }, [graphData.edges]);
    const unlinkedCount = graphData.nodes.filter(n => !linked.has(n.id?.toString())).length;

    // Zoom keeps the centre in place.
    const vw = W / zoom, vh = H / zoom;
    const viewBox = `${(W - vw) / 2} ${(H - vh) / 2} ${vw} ${vh}`;
    const hasNodes = graphData.nodes.length > 0 && positions.length > 0;
    const hovNode = hovered !== null ? graphData.nodes[hovered] : null;
    const isNeighbour = (ni) => {
        if (hovered === null) return false;
        const a = graphData.nodes[hovered]?.id?.toString();
        const b = graphData.nodes[ni]?.id?.toString();
        return graphData.edges.some(e => (e.from?.toString() === a && e.to?.toString() === b) || (e.to?.toString() === a && e.from?.toString() === b));
    };

    return (
        <DashPage
            wide
            head={(
                <PageHead
                    eyebrow={activeWorkspace?.name ? `${activeWorkspace.name} · Knowledge` : 'Knowledge'}
                    title="Knowledge graph"
                    icon={Network}
                    lead="How your pages link to each other. Open any page by selecting its dot."
                    actions={hasNodes && (
                        <>
                            <IconBtn label="Zoom out" onClick={() => setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)))}><ZoomOut size={15} /></IconBtn>
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 40, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
                            <IconBtn label="Zoom in" onClick={() => setZoom(z => Math.min(2.5, +(z + 0.25).toFixed(2)))}><ZoomIn size={15} /></IconBtn>
                            <IconBtn label="Reset zoom" onClick={() => setZoom(1)}><Maximize2 size={14} /></IconBtn>
                            <Btn variant="ghost" icon={RefreshCw} onClick={load}>Refresh</Btn>
                        </>
                    )}
                />
            )}
        >
            {loading ? (
                <LoadingState label="Building the graph…" />
            ) : error ? (
                <ErrorState message={error} onRetry={load} />
            ) : !hasNodes ? (
                <Panel>
                    <EmptyState
                        icon={Network}
                        title="Nothing to map yet"
                        text="Each knowledge page becomes a dot here, and links between pages become lines."
                        action={<Btn variant="primary" icon={Plus} loading={creating} onClick={createFirst}>Write your first page</Btn>}
                    />
                </Panel>
            ) : (
                <Panel flush>
                    <div className="kg-canvas">
                        <svg
                            viewBox={viewBox}
                            preserveAspectRatio="xMidYMid meet"
                            role="img"
                            aria-label={`Graph of ${graphData.nodes.length} pages and ${graphData.edges.length} links`}
                            onMouseLeave={() => setHovered(null)}
                        >
                            {graphData.edges.map((edge, ei) => {
                                const pa = positions[index[edge.from?.toString()]];
                                const pb = positions[index[edge.to?.toString()]];
                                if (!pa || !pb) return null;
                                const lit = hovNode && (edge.from?.toString() === hovNode.id?.toString() || edge.to?.toString() === hovNode.id?.toString());
                                return (
                                    <line key={ei} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
                                        style={{ stroke: lit ? 'var(--accent)' : 'var(--gl-accent-line)', strokeWidth: lit ? 1.5 : 1 }} />
                                );
                            })}
                            {graphData.nodes.map((node, ni) => {
                                const pos = positions[ni];
                                if (!pos) return null;
                                const isHov = hovered === ni;
                                const dim = hovered !== null && !isHov && !isNeighbour(ni);
                                const r = isHov ? 22 : 18;
                                const custom = node.icon && node.icon !== '📄';
                                const label = node.label || 'Untitled page';
                                return (
                                    <g key={node.id} transform={`translate(${pos.x}, ${pos.y})`} className="kg-node"
                                        tabIndex={0} role="link" aria-label={`Open ${label}`}
                                        onClick={() => openNode(node)}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openNode(node); } }}
                                        onMouseEnter={() => setHovered(ni)} onFocus={() => setHovered(ni)} onBlur={() => setHovered(null)}
                                        style={{ opacity: dim ? 0.35 : 1 }}>
                                        {isHov && <circle r={r + 7} style={{ fill: 'var(--gl-accent-soft)' }} />}
                                        <circle r={r} style={{ fill: isHov ? 'var(--accent)' : 'var(--bg-surface)', stroke: isHov ? 'var(--accent)' : 'var(--gl-accent-line)', strokeWidth: 1 }} />
                                        {custom ? (
                                            <text textAnchor="middle" dominantBaseline="central" fontSize={isHov ? 16 : 14}>{node.icon}</text>
                                        ) : (
                                            <FileText x={-7} y={-7} width={14} height={14} style={{ color: isHov ? 'var(--bg-base)' : 'var(--accent)' }} />
                                        )}
                                        <text y={r + 15} textAnchor="middle" fontSize={11} fontWeight={isHov ? 700 : 500}
                                            style={{ fill: isHov ? 'var(--accent)' : 'var(--text-secondary)', fontFamily: 'var(--font)', paintOrder: 'stroke', stroke: 'var(--bg-base)', strokeWidth: 4, strokeLinejoin: 'round' }}>
                                            {label.substring(0, 20)}{label.length > 20 ? '…' : ''}
                                        </text>
                                    </g>
                                );
                            })}
                        </svg>
                    </div>
                    <div className="kg-foot">
                        <span><Chip tone="accent">{graphData.nodes.length}</Chip> page{graphData.nodes.length === 1 ? '' : 's'}</span>
                        <span><Chip>{graphData.edges.length}</Chip> link{graphData.edges.length === 1 ? '' : 's'}</span>
                        {unlinkedCount > 0 && <span><Chip tone="warning">{unlinkedCount}</Chip> not linked yet</span>}
                        <span className="kg-foot-hint">{hovNode ? `Open “${hovNode.label || 'Untitled page'}”` : 'Select a dot to open its page'}</span>
                    </div>
                </Panel>
            )}
            <style>{`
                .kg-canvas { background: var(--bg-base); border-bottom: 1px solid var(--border-subtle); }
                .kg-canvas svg { display: block; width: 100%; height: auto; max-height: calc(100vh - 260px); min-height: 280px; }
                .kg-node { cursor: pointer; outline: none; transition: opacity 150ms ease; }
                .kg-node:focus-visible circle:last-of-type { stroke-width: 2; }
                .kg-foot { display: flex; align-items: center; gap: 8px 16px; flex-wrap: wrap; padding: 10px 16px; font-size: 12px; color: var(--text-secondary); }
                .kg-foot > span { display: inline-flex; align-items: center; gap: 6px; }
                .kg-foot-hint { margin-left: auto; color: var(--text-muted); }
                @media (max-width: 640px) { .kg-foot-hint { margin-left: 0; width: 100%; } }
            `}</style>
        </DashPage>
    );
};

export default KnowledgeGraph;
