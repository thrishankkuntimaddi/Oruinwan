import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Network, ZoomIn, ZoomOut, RefreshCw, BookOpen } from 'lucide-react';
import { useKnowledge } from '../../hooks/useKnowledge';

function runForce(nodes, edges, width, height, iterations = 200) {
    const k = Math.sqrt((width * height) / Math.max(nodes.length, 1));
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
            const speed = Math.sqrt(pos.vx * pos.vx + pos.vy * pos.vy) || 1;
            const capped = Math.min(speed, temp * 30);
            pos.x += (pos.vx / speed) * capped;
            pos.y += (pos.vy / speed) * capped;
            pos.x = Math.max(50, Math.min(width - 50, pos.x));
            pos.y = Math.max(50, Math.min(height - 50, pos.y));
            pos.vx = 0; pos.vy = 0;
        }
    }
    return positions;
}

const KnowledgeGraph = () => {
    const { workspaceId } = useParams();
    const navigate = useNavigate();
    const { getGraph } = useKnowledge();
    const canvasRef = useRef(null);
    const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
    const [loading, setLoading] = useState(true);
    const [zoom, setZoom] = useState(1);
    const [positions, setPositions] = useState([]);
    const [hovered, setHovered] = useState(null);
    const [error, setError] = useState(null);

    const W = 900, H = 600;

    useEffect(() => {
        if (!workspaceId) return;
        setLoading(true);
        getGraph(workspaceId)
            .then(data => {
                setGraphData(data);
                if (data.nodes.length > 0) {
                    const pos = runForce(data.nodes, data.edges, W, H);
                    setPositions(pos);
                }
                setLoading(false);
            })
            .catch(err => {
                setError('Failed to load graph');
                setLoading(false);
            });
    }, [workspaceId, getGraph]);

    const handleRefresh = () => {
        setLoading(true);
        getGraph(workspaceId).then(data => {
            setGraphData(data);
            if (data.nodes.length > 0) {
                const pos = runForce(data.nodes, data.edges, W, H);
                setPositions(pos);
            }
            setLoading(false);
        }).catch(() => setLoading(false));
    };

    const handleCanvasClick = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const cx = (e.clientX - rect.left) / zoom;
        const cy = (e.clientY - rect.top) / zoom;
        for (let i = 0; i < positions.length; i++) {
            const pos = positions[i];
            if (!pos) continue;
            const dx = cx - pos.x, dy = cy - pos.y;
            if (Math.sqrt(dx * dx + dy * dy) < 24) {
                navigate(`/workspace/${workspaceId}/knowledge/${graphData.nodes[i].id}`);
                return;
            }
        }
    };

    const handleCanvasMouseMove = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const cx = (e.clientX - rect.left) / zoom;
        const cy = (e.clientY - rect.top) / zoom;
        let found = null;
        for (let i = 0; i < positions.length; i++) {
            const pos = positions[i];
            if (!pos) continue;
            const dx = cx - pos.x, dy = cy - pos.y;
            if (Math.sqrt(dx * dx + dy * dy) < 28) {
                found = i;
                break;
            }
        }
        setHovered(found);
    };

    
    const nodeColors = [
        '#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b',
        '#ef4444', '#ec4899', '#14b8a6', '#f97316', '#3b82f6',
    ];

    return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-900">
            {}
            <div className="h-14 px-6 flex items-center justify-between border-b border-gray-200 dark:border-gray-800 shrink-0">
                <h1 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Network size={18} className="text-indigo-600 dark:text-indigo-400" />
                    Knowledge Graph
                </h1>
                <div className="flex items-center gap-2">
                    <button onClick={() => setZoom(z => Math.max(0.4, z - 0.15))} className="p-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"><ZoomOut size={15} /></button>
                    <span className="text-xs text-gray-400 w-12 text-center">{Math.round(zoom * 100)}%</span>
                    <button onClick={() => setZoom(z => Math.min(2.0, z + 0.15))} className="p-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"><ZoomIn size={15} /></button>
                    <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />
                    <button onClick={handleRefresh} className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"><RefreshCw size={15} /></button>
                </div>
            </div>

            {}
            <div className="flex-1 overflow-hidden relative">
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-900 z-10">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                            <p className="text-sm text-gray-400">Building graph…</p>
                        </div>
                    </div>
                )}
                {error && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <p className="text-sm text-red-500">{error}</p>
                    </div>
                )}
                {!loading && !error && graphData.nodes.length === 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <Network size={56} className="text-gray-200 dark:text-gray-700 mb-4" />
                        <p className="text-gray-400 text-sm">No pages yet — create your first knowledge page</p>
                        <button
                            onClick={() => navigate(`/workspace/${workspaceId}/knowledge`)}
                            className="mt-4 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors"
                        >Start writing</button>
                    </div>
                )}
                {!loading && !error && graphData.nodes.length > 0 && positions.length > 0 && (
                    <svg
                        width="100%"
                        height="100%"
                        viewBox={`0 0 ${W / zoom} ${H / zoom}`}
                        style={{ cursor: hovered !== null ? 'pointer' : 'default', transform: `scale(${zoom})`, transformOrigin: '0 0' }}
                        onClick={handleCanvasClick}
                        onMouseMove={handleCanvasMouseMove}
                        onMouseLeave={() => setHovered(null)}
                        className="bg-gradient-to-br from-gray-50 to-white dark:from-gray-950 dark:to-gray-900"
                    >
                        {}
                        {graphData.edges.map((edge, ei) => {
                            const ai = graphData.nodes.findIndex(n => n.id?.toString() === edge.from?.toString());
                            const bi = graphData.nodes.findIndex(n => n.id?.toString() === edge.to?.toString());
                            if (ai < 0 || bi < 0) return null;
                            const pa = positions[ai], pb = positions[bi];
                            if (!pa || !pb) return null;
                            return (
                                <line
                                    key={ei}
                                    x1={pa.x / zoom} y1={pa.y / zoom}
                                    x2={pb.x / zoom} y2={pb.y / zoom}
                                    stroke="url(#edge-grad)"
                                    strokeWidth={1.5}
                                    strokeOpacity={0.45}
                                />
                            );
                        })}

                        <defs>
                            <linearGradient id="edge-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#6366f1" />
                                <stop offset="100%" stopColor="#06b6d4" />
                            </linearGradient>
                        </defs>

                        {}
                        {graphData.nodes.map((node, ni) => {
                            const pos = positions[ni];
                            if (!pos) return null;
                            const color = nodeColors[ni % nodeColors.length];
                            const isHov = hovered === ni;
                            const r = isHov ? 26 : 22;
                            return (
                                <g key={node.id} transform={`translate(${pos.x / zoom}, ${pos.y / zoom})`}>
                                    {}
                                    {isHov && <circle r={r + 8} fill={color} fillOpacity={0.12} />}
                                    <circle r={r} fill={color} fillOpacity={isHov ? 1 : 0.82} stroke="white" strokeWidth={2} />
                                    {}
                                    <text textAnchor="middle" dominantBaseline="middle" fontSize={isHov ? 16 : 14} y={0}>
                                        {node.icon || '📄'}
                                    </text>
                                    {}
                                    <text
                                        y={r + 14}
                                        textAnchor="middle"
                                        fontSize={10}
                                        fontWeight={isHov ? 700 : 500}
                                        fill={isHov ? color : '#6b7280'}
                                    >
                                        {(node.label || '').substring(0, 18)}{node.label?.length > 18 ? '…' : ''}
                                    </text>
                                </g>
                            );
                        })}
                    </svg>
                )}
            </div>

            {}
            {!loading && graphData.nodes.length > 0 && (
                <div className="border-t border-gray-100 dark:border-gray-800 px-6 py-3 flex items-center gap-4 text-xs text-gray-400">
                    <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-indigo-500 inline-block" /> Pages ({graphData.nodes.length})
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-6 h-0.5 bg-indigo-300 inline-block" /> Links ({graphData.edges.length})
                    </span>
                    <span className="ml-auto">Click a node to open page</span>
                </div>
            )}
        </div>
    );
};

export default KnowledgeGraph;
