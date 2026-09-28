import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe, RefreshCw, ArrowRight, Briefcase } from 'lucide-react';
import api from '@services/api';
import {
    DashPage, PageHead, Grid, Btn, Chip, Toolbar, SearchBox, ErrorState, EmptyState, LoadingState, useAsync,
} from '../company-dash/dashUi';
import './manager.css';

/** Workspaces the manager belongs to, with members, open tasks and weekly messages. */
export default function ManagerWorkspacePage() {
    const navigate = useNavigate();
    const [q, setQ] = useState('');
    const { data, loading, error, reload } = useAsync(
        () => api.get('/api/manager-dashboard/my-workspaces').then((r) => r.data?.workspaces || []),
    );
    const list = useMemo(() => {
        const s = q.trim().toLowerCase();
        return (data || []).filter((w) => !s || w.name?.toLowerCase().includes(s) || w.description?.toLowerCase().includes(s));
    }, [data, q]);

    return (
        <DashPage
            head={(
                <PageHead
                    eyebrow="Manager console"
                    title="My workspaces"
                    lead="Every workspace you're a member of, with this week's activity."
                    actions={<Btn icon={RefreshCw} loading={loading} onClick={reload}>Refresh</Btn>}
                />
            )}
        >
            {error && !data ? (
                <ErrorState message={error} onRetry={reload} />
            ) : !data ? (
                <LoadingState label="Loading workspaces…" />
            ) : data.length === 0 ? (
                <EmptyState
                    icon={Briefcase}
                    title="No workspaces yet"
                    text="You aren't a member of any workspace. Ask an admin to add you, or browse the workspaces you can join."
                    action={<Btn icon={Globe} onClick={() => navigate('/workspaces')}>Browse workspaces</Btn>}
                />
            ) : (
                <>
                    {data.length > 4 && (
                        <Toolbar><SearchBox value={q} onChange={setQ} placeholder="Search workspaces…" /></Toolbar>
                    )}
                    {list.length === 0 ? (
                        <EmptyState title="No matches" text={`No workspace matches “${q}”.`} />
                    ) : (
                        <Grid cols="2">
                            {list.map((ws) => (
                                <article key={ws._id} className="gl-card mg-ws-card">
                                    <div className="mg-ws-head">
                                        <div style={{ minWidth: 0 }}>
                                            <h3 className="mg-ws-name">{ws.name}</h3>
                                            {ws.description && <p className="mg-ws-desc">{ws.description}</p>}
                                        </div>
                                        <Chip tone={ws.status === 'active' ? 'success' : undefined}>{ws.status || 'active'}</Chip>
                                    </div>
                                    <div className="mg-stats">
                                        <span className="mg-stat"><b>{ws.memberCount ?? 0}</b> members</span>
                                        <span className="mg-stat"><b>{ws.activity?.tasksActive ?? 0}</b> open tasks</span>
                                        <span className="mg-stat"><b>{ws.activity?.messages ?? 0}</b> messages / 7d</span>
                                    </div>
                                    <div>
                                        <Btn size="sm" onClick={() => navigate(`/workspace/${ws._id}/home`)}>
                                            Open workspace <ArrowRight size={12} />
                                        </Btn>
                                    </div>
                                </article>
                            ))}
                        </Grid>
                    )}
                </>
            )}
        </DashPage>
    );
}
