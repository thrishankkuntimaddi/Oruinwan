import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Map as MapIcon, Plus, RefreshCcw, CalendarOff } from 'lucide-react';
import {
    DashPage, PageHead, Section, Panel, Toolbar, FilterTabs, Btn, IconBtn, Chip, EmptyState, LoadingState, ErrorState, useAsync, errorMessage,
} from '../../components/ui/page';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useOptionalSocket } from '../../contexts/SocketContext';
import { useToast } from '../../contexts/ToastContext';
import roadmapService from '../../services/roadmapService';
import RoadmapItemDrawer from './RoadmapItemDrawer';
import {
    buildRange, barGeometry, dateToPct, groupItems, itemSpan, progressOf, progressLabel, statusMeta, colorVar,
    pxToDays, applyDrag, quarterKey, quarterOf,
} from './roadmapTimeline';
import './roadmap.css';

const fmtDay = (iso) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }) : '');

function Bar({ item, range, draggable, trackRef, onOpen, onDragEnd }) {
    const [drag, setDrag] = useState(null); // { mode, x0, days }
    const moved = useRef(false);
    const dragRef = useRef(null);
    const preview = drag && drag.days !== 0 ? { ...item, ...applyDrag(item, drag.mode, drag.days) } : item;
    const geo = barGeometry(preview, range);
    if (!geo) return null;
    const pct = progressOf(item);
    const span = itemSpan(item);

    const start = (mode) => (e) => {
        if (!draggable || e.button > 0) return;
        e.stopPropagation();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        moved.current = false;
        dragRef.current = { mode, x0: e.clientX, days: 0 };
        setDrag(dragRef.current);
    };
    const move = (e) => {
        const d = dragRef.current;
        if (!d) return;
        e.stopPropagation();
        const width = trackRef.current?.getBoundingClientRect().width || 0;
        const days = pxToDays(e.clientX - d.x0, width, range);
        if (days !== 0) moved.current = true;
        if (days !== d.days) { dragRef.current = { ...d, days }; setDrag(dragRef.current); }
    };
    const end = (e) => {
        const d = dragRef.current;
        if (!d) return;
        e?.stopPropagation?.();
        dragRef.current = null;
        setDrag(null);
        if (d.days !== 0) onDragEnd(item, applyDrag(item, d.mode, d.days));
    };

    const p = drag && drag.days !== 0 ? applyDrag(item, drag.mode, drag.days) : null;
    return (
        <div
            className="rm-bar"
            role="button"
            tabIndex={0}
            data-draggable={draggable ? 'true' : undefined}
            data-dragging={drag ? 'true' : undefined}
            data-dashed={span?.fromQuarter ? 'true' : undefined}
            style={{ left: `${geo.left}%`, width: `${geo.width}%`, '--rm-color': colorVar(item.color) }}
            title={`${item.title} · ${statusMeta(item.status).label} · ${progressLabel(item)}${draggable ? ' · drag to change dates' : ''}`}
            aria-label={`${item.title}, ${pct}% complete`}
            onPointerDown={start('move')}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={() => { dragRef.current = null; setDrag(null); }}
            onClick={() => { if (!moved.current) onOpen(item); moved.current = false; }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(item); } }}
        >
            <span className="rm-bar-fill" style={{ width: `${pct}%` }} />
            {draggable && <span className="rm-handle" data-edge="start" onPointerDown={start('start')} onPointerMove={move} onPointerUp={end} />}
            <span className="rm-bar-label">{item.title}</span>
            <span className="rm-bar-pct">{pct}%</span>
            {draggable && <span className="rm-handle" data-edge="end" onPointerDown={start('end')} onPointerMove={move} onPointerUp={end} />}
            {p && <span className="rm-drag-tip" style={{ left: 0 }}>{fmtDay(p.startDate)} – {fmtDay(p.endDate)}</span>}
        </div>
    );
}

export default function RoadmapPage() {
    const { workspaceId } = useParams();
    const { activeWorkspace } = useWorkspace() || {};
    const socketCtx = useOptionalSocket();
    const socket = socketCtx?.socket;
    const { showToast } = useToast();
    const [groupBy, setGroupBy] = useState('status');
    const [drawer, setDrawer] = useState(null); // { item } | { item: null } for new
    const [linkables, setLinkables] = useState({ milestones: [], tasks: [], members: [] });
    const trackRef = useRef(null);

    const { data, loading, error, reload, setData } = useAsync(() => roadmapService.list(workspaceId), [workspaceId]);
    const items = useMemo(() => data?.items || [], [data]);
    const canCreate = Boolean(data?.canCreate);

    useEffect(() => {
        if (!socket) return undefined;
        const onUpdated = (p) => { if (!p?.workspaceId || String(p.workspaceId) === String(workspaceId)) reload(); };
        socket.on('roadmap:updated', onUpdated);
        socket.on('milestone:updated', reload);
        return () => { socket.off('roadmap:updated', onUpdated); socket.off('milestone:updated', reload); };
    }, [socket, workspaceId, reload]);

    const loadLinkables = useCallback(() => {
        Promise.allSettled([roadmapService.milestones(workspaceId), roadmapService.tasks(workspaceId), roadmapService.members(workspaceId)])
            .then(([m, t, u]) => setLinkables({
                milestones: m.status === 'fulfilled' ? m.value : [],
                tasks: t.status === 'fulfilled' ? t.value.filter((x) => !x.deleted && !x.isDeleted) : [],
                members: u.status === 'fulfilled' ? u.value : [],
            }));
    }, [workspaceId]);

    const openDrawer = (item) => { setDrawer({ item }); loadLinkables(); };

    // Keep the open drawer's item fresh after live refetches.
    const drawerItem = drawer?.item ? items.find((i) => i._id === drawer.item._id) || drawer.item : null;

    const range = useMemo(() => buildRange(items), [items]);
    const lanes = useMemo(() => groupItems(items.filter((i) => itemSpan(i)), groupBy), [items, groupBy]);
    const unscheduled = items.filter((i) => !itemSpan(i));
    const todayPct = dateToPct(new Date(), range);
    const currentQ = quarterKey(quarterOf(new Date()));

    const onDragEnd = async (item, dates) => {
        const prev = data;
        setData((d) => ({ ...d, items: d.items.map((i) => (i._id === item._id ? { ...i, ...dates } : i)) }));
        try {
            const updated = await roadmapService.update(item._id, dates);
            setData((d) => ({ ...d, items: d.items.map((i) => (i._id === item._id ? updated : i)) }));
        } catch (err) {
            setData(prev);
            showToast(errorMessage(err, 'Couldn’t move the item'), 'error');
        }
    };

    const onSave = async (body) => {
        if (drawer?.item) {
            const updated = await roadmapService.update(drawer.item._id, body);
            setData((d) => ({ ...d, items: d.items.map((i) => (i._id === updated._id ? updated : i)) }));
            showToast('Roadmap item saved', 'success');
        } else {
            const created = await roadmapService.create(workspaceId, body);
            setData((d) => ({ ...d, items: [...(d?.items || []), created] }));
            showToast('Roadmap item created', 'success');
        }
        setDrawer(null);
    };

    const onDelete = async () => {
        await roadmapService.remove(drawer.item._id);
        setData((d) => ({ ...d, items: d.items.filter((i) => i._id !== drawer.item._id) }));
        setDrawer(null);
        showToast('Roadmap item deleted', 'success');
    };

    const head = (
        <PageHead
            eyebrow={activeWorkspace?.name || 'Workspace'}
            title="Roadmap"
            icon={MapIcon}
            lead="Plans by quarter, with progress from the milestones and tasks linked to each item."
            actions={(
                <>
                    <IconBtn label="Refresh" onClick={reload} style={{ width: 32, height: 32, border: '1px solid var(--border-default)' }}>
                        <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} />
                    </IconBtn>
                    {canCreate && <Btn variant="primary" icon={Plus} onClick={() => openDrawer(null)}>New item</Btn>}
                </>
            )}
        />
    );

    let body;
    if (loading && !data) body = <LoadingState label="Loading the roadmap…" />;
    else if (error && !data) body = <ErrorState title="Couldn’t load the roadmap" message={error} onRetry={reload} />;
    else if (items.length === 0) {
        body = (
            <Panel>
                <EmptyState
                    icon={MapIcon}
                    title="No roadmap items yet"
                    text={canCreate ? 'Add the big pieces of work for the coming quarters. Link milestones and tasks and the bars fill in as work gets done.' : 'Workspace admins and managers plan the roadmap here. Items appear as soon as they add them.'}
                    action={canCreate ? <Btn variant="primary" icon={Plus} onClick={() => openDrawer(null)}>New item</Btn> : null}
                />
            </Panel>
        );
    } else {
        body = (
            <>
                <Toolbar>
                    <FilterTabs
                        label="Group lanes by"
                        value={groupBy}
                        onChange={setGroupBy}
                        options={[{ value: 'status', label: 'By status' }, { value: 'owner', label: 'By owner' }]}
                    />
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {canCreate ? 'Drag a bar to move it, or its edges to change the dates.' : 'Click an item to see what it is made of.'}
                    </span>
                </Toolbar>
                <Panel flush>
                    <div className="rm-scroll">
                        <div className="rm-grid">
                            <div className="rm-head-row">
                                <div className="rm-head-cell">{groupBy === 'status' ? 'Item' : 'Owner / item'}</div>
                                <div className="rm-quarters" ref={trackRef}>
                                    {range.quarters.map((q) => <div key={q.key} className="rm-quarter" data-current={q.key === currentQ ? 'true' : undefined}>{q.label}</div>)}
                                </div>
                            </div>
                            {lanes.map((lane) => (
                                <div key={lane.key}>
                                    <div className="rm-lane-label">
                                        {lane.tone !== undefined || groupBy === 'status' ? <Chip tone={lane.tone}>{lane.label}</Chip> : lane.label}
                                        <span className="rm-count">{lane.items.length}</span>
                                    </div>
                                    {lane.items.length === 0 && <div className="rm-row"><div /><div className="rm-empty-lane" style={{ gridColumn: 'auto' }}>Nothing here.</div></div>}
                                    {lane.items.map((item) => (
                                        <div key={item._id} className="rm-row">
                                            <button type="button" className="rm-row-title" onClick={() => openDrawer(item)}>
                                                <strong title={item.title}>{item.title}</strong>
                                                <span>{groupBy === 'status' ? (item.ownerId?.username || 'No owner') : statusMeta(item.status).label} · {progressLabel(item)}</span>
                                            </button>
                                            <div className="rm-track">
                                                <div className="rm-track-lines" aria-hidden="true">{range.quarters.map((q) => <span key={q.key} />)}</div>
                                                <span className="rm-today" style={{ left: `${todayPct}%` }} aria-hidden="true" />
                                                <Bar item={item} range={range} draggable={canCreate} trackRef={trackRef} onOpen={openDrawer} onDragEnd={onDragEnd} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                </Panel>
                {unscheduled.length > 0 && (
                    <Section title="Unscheduled" lead="Give these a quarter or dates to put them on the timeline.">
                        <Panel flush>
                            {unscheduled.map((item, i) => (
                                <button key={item._id} type="button" className="rm-row-title" onClick={() => openDrawer(item)} style={{ width: '100%', padding: '10px 14px', borderTop: i ? '1px solid var(--border-subtle)' : 0, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    <CalendarOff size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                    <strong style={{ flex: 1 }}>{item.title}</strong>
                                    <Chip tone={statusMeta(item.status).tone}>{statusMeta(item.status).label}</Chip>
                                    <span>{progressOf(item)}%</span>
                                </button>
                            ))}
                        </Panel>
                    </Section>
                )}
            </>
        );
    }

    return (
        <DashPage head={head} wide>
            {body}
            <RoadmapItemDrawer
                open={Boolean(drawer)}
                item={drawerItem}
                canManage={canCreate}
                members={linkables.members}
                milestones={linkables.milestones}
                tasks={linkables.tasks}
                onSave={onSave}
                onDelete={onDelete}
                onClose={() => setDrawer(null)}
            />
        </DashPage>
    );
}
