import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckSquare, FileText, CheckCircle2, AlertTriangle, ArrowLeft, Sun, Moon, ArrowRight } from 'lucide-react';
import api from '@services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import {
    DashPage, PageHead, KpiGrid, Kpi, Grid, Panel, Chip, Btn, IconBtn, EmptyState, ErrorState, LoadingState,
    useAsync, timeAgo,
} from '../../components/company-dash/dashUi';
import '../../styles/gloss.css';
import '../../components/company-dash/dash.css';

const OPEN = ['backlog', 'todo', 'in_progress', 'review', 'blocked'];
const STATUS_LABEL = { backlog: 'Backlog', todo: 'To do', in_progress: 'In progress', review: 'In review', blocked: 'Blocked', done: 'Done', cancelled: 'Cancelled' };
const STATUS_TONE = { in_progress: 'accent', review: 'warning', blocked: 'danger', done: 'success' };
const idOf = (v) => (v && typeof v === 'object' ? v._id : v);

/**
 * Personal dashboard (/employee/dashboard): the signed-in person's own tasks
 * and notes, from the same APIs the workspace Tasks and Notes pages use.
 */
const EmployeeDashboard = () => {
    const { user } = useAuth();
    const { resolvedTheme, toggleTheme } = useTheme() || {};
    const navigate = useNavigate();
    const tasks = useAsync(() => api.get('/api/v2/tasks/my').then((r) => r.data?.tasks || []));
    const notes = useAsync(() => api.get('/api/v2/notes').then((r) => r.data?.notes || []));

    const firstWs = idOf(user?.workspaces?.[0]?.workspace);
    const list = useMemo(() => tasks.data || [], [tasks.data]);
    const stats = useMemo(() => {
        const now = Date.now();
        return {
            open: list.filter((t) => OPEN.includes(t.status)).length,
            done: list.filter((t) => t.status === 'done').length,
            overdue: list.filter((t) => OPEN.includes(t.status) && t.dueDate && new Date(t.dueDate).getTime() < now).length,
        };
    }, [list]);
    const openTasks = list.filter((t) => OPEN.includes(t.status)).slice(0, 8);
    const recentNotes = [...(notes.data || [])].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)).slice(0, 8);

    const openTask = (t) => { const ws = idOf(t.workspace) || firstWs; if (ws) navigate(`/workspace/${ws}/tasks`); };
    const openNote = (n) => { const ws = idOf(n.workspace) || firstWs; if (ws) navigate(`/workspace/${ws}/notes`); };

    return (
        <div className="cd-shell">
            <div className="cd-main">
                <header className="cd-top gl-glass-bar">
                    <IconBtn label="Back to workspaces" onClick={() => navigate('/workspaces')}><ArrowLeft size={16} /></IconBtn>
                    <div className="cd-top-titles">
                        <span className="cd-top-kicker">Oruinwan</span>
                        <span className="cd-top-title">My dashboard</span>
                    </div>
                    <div className="cd-top-actions">
                        {toggleTheme && (
                            <IconBtn label={resolvedTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} onClick={() => toggleTheme()}>
                                {resolvedTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                            </IconBtn>
                        )}
                    </div>
                </header>
                <main className="cd-content">
                    <DashPage
                        head={(
                            <PageHead
                                eyebrow="Personal"
                                title={`Welcome back${user?.username ? `, ${user.username}` : ''}`}
                                lead="Your assigned tasks and your notes across workspaces."
                                actions={firstWs && <Btn variant="primary" icon={CheckSquare} onClick={() => navigate(`/workspace/${firstWs}/tasks`)}>Open tasks</Btn>}
                            />
                        )}
                    >
                        <KpiGrid>
                            <Kpi label="Open tasks" icon={CheckSquare} loading={tasks.loading && !tasks.data} value={tasks.error ? undefined : stats.open} />
                            <Kpi label="Overdue" icon={AlertTriangle} tone={stats.overdue ? 'danger' : 'muted'} loading={tasks.loading && !tasks.data} value={tasks.error ? undefined : stats.overdue} />
                            <Kpi label="Completed" icon={CheckCircle2} tone="success" loading={tasks.loading && !tasks.data} value={tasks.error ? undefined : stats.done} />
                            <Kpi label="Notes" icon={FileText} loading={notes.loading && !notes.data} value={notes.error ? undefined : (notes.data || []).length} />
                        </KpiGrid>
                        <Grid cols="2">
                            <Panel title="My open tasks" icon={CheckSquare} flush>
                                {tasks.loading && !tasks.data ? <LoadingState /> : tasks.error ? <ErrorState message={tasks.error} onRetry={tasks.reload} /> : openTasks.length === 0 ? (
                                    <EmptyState icon={CheckSquare} title="Nothing assigned" text="Tasks assigned to you in any workspace show up here." action={firstWs && <Btn size="sm" onClick={() => navigate(`/workspace/${firstWs}/tasks`)}>Go to tasks <ArrowRight size={13} /></Btn>} />
                                ) : (
                                    <div className="cd-list">
                                        {openTasks.map((t) => (
                                            <button key={t._id} type="button" className="cd-list-row gl-item" style={{ margin: 0, width: '100%', borderRadius: 0, minHeight: 52 }} onClick={() => openTask(t)}>
                                                <div className="cd-grow">
                                                    <div className="cd-cell-title">{t.title}</div>
                                                    <div className="cd-cell-sub">{t.workspace?.name || 'Workspace'}{t.dueDate ? ` · due ${new Date(t.dueDate).toLocaleDateString()}` : ''}</div>
                                                </div>
                                                <Chip tone={STATUS_TONE[t.status]}>{STATUS_LABEL[t.status] || t.status}</Chip>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </Panel>
                            <Panel title="Recent notes" icon={FileText} flush>
                                {notes.loading && !notes.data ? <LoadingState /> : notes.error ? <ErrorState message={notes.error} onRetry={notes.reload} /> : recentNotes.length === 0 ? (
                                    <EmptyState icon={FileText} title="No notes yet" text="Notes you write in a workspace appear here." />
                                ) : (
                                    <div className="cd-list">
                                        {recentNotes.map((n) => (
                                            <button key={n._id} type="button" className="cd-list-row gl-item" style={{ margin: 0, width: '100%', borderRadius: 0, minHeight: 48 }} onClick={() => openNote(n)}>
                                                <div className="cd-grow"><div className="cd-cell-title">{n.title || 'Untitled'}</div></div>
                                                <span className="cd-muted" style={{ fontSize: 12 }}>{timeAgo(n.updatedAt || n.createdAt)}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </Panel>
                        </Grid>
                    </DashPage>
                </main>
            </div>
        </div>
    );
};

export default EmployeeDashboard;
