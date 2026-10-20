import React, { Suspense, lazy, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Route, Routes, UNSAFE_NavigationContext, UNSAFE_RouteContext, createPath, parsePath, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeftRight, BookOpen, Bot, FileText, FolderOpen, Hash, Headphones, Maximize2, MessageSquare, MessagesSquare, Sparkles, SquareCheckBig, Workflow, X } from 'lucide-react';
import { clampPaneWidth, split, useSplit } from './splitStore';

// The pages a pane can show. Lazy: they load only once someone splits the view.
const Home = lazy(() => import('../../pages/SidebarComp/Home'));
const Notes = lazy(() => import('../../pages/SidebarComp/Notes'));
const MyTasks = lazy(() => import('../../pages/SidebarComp/MyTasks'));
const FileLibrary = lazy(() => import('../../pages/SidebarComp/FileLibrary'));
const KnowledgePage = lazy(() => import('../../pages/SidebarComp/KnowledgePage'));
const ThreadPage = lazy(() => import('../../pages/thread/ThreadPage'));
const AgentsPage = lazy(() => import('../../pages/agents/AgentsPage'));
const AutomationsPage = lazy(() => import('../../pages/workspace/AutomationsPage'));
const Meetings = lazy(() => import('../../pages/SidebarComp/Meetings'));
const ChttrixAIChat = lazy(() => import('../../components/ai/ChttrixAIChat/ChttrixAIChat'));

/** Oruinwan AI as a page in the pane. */
function AIPane() {
    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <ChttrixAIChat isSidebar onClose={() => split.close()} />
        </div>
    );
}

const W = '/workspace/:workspaceId';
const TOP_ROUTE = { outlet: null, matches: [], isDataRoute: false };

/** What the pane shows, for its header. */
export function paneKind(path = '') {
    if (/\/thread\//.test(path)) return { label: 'Thread', Icon: MessagesSquare };
    if (/\/ai$/.test(path)) return { label: 'Oruinwan AI', Icon: Sparkles };
    if (/\/agents/.test(path)) return { label: 'Agents', Icon: Bot };
    if (/\/automations/.test(path)) return { label: 'Workflows', Icon: Workflow };
    if (/\/huddles/.test(path)) return { label: 'Huddles', Icon: Headphones };
    if (/\/(home\/)?channel\//.test(path)) return { label: 'Channel', Icon: Hash };
    if (/\/(home\/)?dm\//.test(path)) return { label: 'Direct message', Icon: MessageSquare };
    if (/\/notes/.test(path)) return { label: 'Notes', Icon: FileText };
    if (/\/tasks/.test(path)) return { label: 'Tasks', Icon: SquareCheckBig };
    if (/\/files/.test(path)) return { label: 'Files', Icon: FolderOpen };
    if (/\/knowledge/.test(path)) return { label: 'Knowledge', Icon: BookOpen };
    return { label: 'Page', Icon: FileText };
}

/** A page that can't be shown in the pane: offer to open it in the main view. */
function NotInPane({ path }) {
    const navigate = useMainNavigate();
    return (
        <div style={{ display: 'grid', placeItems: 'center', height: '100%', padding: 24, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
            <div>
                <p style={{ margin: '0 0 12px' }}>This page opens in the main view.</p>
                <button type="button" className="gl-btn" onClick={() => { navigate(path); split.close(); }}>Open it there</button>
            </div>
        </div>
    );
}

// The main router's navigate, for the pane's own buttons (outside the pane's routes).
const MainNavigateContext = React.createContext(null);
const useMainNavigate = () => useContext(MainNavigateContext);

/**
 * The pane's pages run on the main router's route matching, with their own location and their
 * own navigator: links and navigate() inside the pane change the pane, not the main view.
 */
function PaneRouter({ path }) {
    const parent = useContext(UNSAFE_NavigationContext);
    const navigator = useMemo(() => {
        const toPath = (to) => (typeof to === 'string' ? to : createPath(to));
        return {
            ...parent.navigator,
            createHref: (to) => toPath(to),
            push: (to) => split.navigate(toPath(to)),
            replace: (to) => split.navigate(toPath(to)),
            go: () => {},
        };
    }, [parent.navigator]);
    const location = useMemo(() => ({ ...parsePath(path), state: null, key: `pane:${path}` }), [path]);

    return (
        <UNSAFE_NavigationContext.Provider value={{ ...parent, navigator }}>
            {/* A top-level route context: the pane's routes match from the root, not inside the main page's route. */}
            <UNSAFE_RouteContext.Provider value={TOP_ROUTE}>
            <Suspense fallback={<div className="skel-shimmer" style={{ height: '100%' }} />}>
                <Routes location={location}>
                    {['home/channel/:id', 'home/dm/:id', 'home/dm/new/:dmId', 'channel/:id', 'dm/:id', 'dm/new/:dmId', 'home'].map((p) => (
                        <Route key={p} path={`${W}/${p}`} element={<Home />} />
                    ))}
                    <Route path={`${W}/notes`} element={<Notes />} />
                    <Route path={`${W}/notes/:id`} element={<Notes />} />
                    <Route path={`${W}/tasks`} element={<MyTasks />} />
                    <Route path={`${W}/tasks/:taskId`} element={<MyTasks />} />
                    <Route path={`${W}/files`} element={<FileLibrary />} />
                    <Route path={`${W}/files/:id`} element={<FileLibrary />} />
                    <Route path={`${W}/knowledge`} element={<KnowledgePage />} />
                    <Route path={`${W}/knowledge/:id`} element={<KnowledgePage />} />
                    <Route path={`${W}/thread/:type/:conversationId/:messageId`} element={<ThreadPage />} />
                    <Route path={`${W}/ai`} element={<AIPane />} />
                    <Route path={`${W}/agents`} element={<AgentsPage />} />
                    <Route path={`${W}/automations`} element={<AutomationsPage />} />
                    <Route path={`${W}/huddles`} element={<Meetings />} />
                    <Route path="*" element={<NotInPane path={path} />} />
                </Routes>
            </Suspense>
            </UNSAFE_RouteContext.Provider>
        </UNSAFE_NavigationContext.Provider>
    );
}

/** The second page beside the main view, with a drag handle on its left edge. */
export default function SplitPane({ workspaceId }) {
    const { pane, width } = useSplit();
    const mainLocation = useLocation();
    const navigate = useNavigate();
    const rootRef = useRef(null);
    const [dragging, setDragging] = useState(false);

    // Moving to another workspace closes the pane (its page belongs to the old one).
    useEffect(() => {
        if (pane && workspaceId && pane.workspaceId !== String(workspaceId)) split.close();
    }, [pane, workspaceId]);

    useEffect(() => {
        if (!dragging) return undefined;
        const container = rootRef.current?.parentElement;
        const move = (e) => {
            const box = container.getBoundingClientRect();
            split.setWidth(clampPaneWidth(box.right - e.clientX, box.width));
        };
        const up = () => {
            setDragging(false);
            split.setWidth(split.get().width, { save: true });
        };
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
        return () => {
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
        };
    }, [dragging]);

    if (!pane || (workspaceId && pane.workspaceId !== String(workspaceId))) return null;

    const { label, Icon } = paneKind(pane.path);
    const mainPath = `${mainLocation.pathname}${mainLocation.search}`;

    const swap = () => {
        split.navigate(mainPath);
        navigate(pane.path);
    };
    const openInMain = () => {
        navigate(pane.path);
        split.close();
    };

    return (
        <MainNavigateContext.Provider value={navigate}>
            <div
                className={`gl-shell-resizer${dragging ? ' is-dragging' : ''}`}
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize split view"
                title="Drag to resize"
                onMouseDown={(e) => { e.preventDefault(); setDragging(true); }}
            />
            <section
                ref={rootRef}
                aria-label={`Split view: ${label}`}
                data-testid="split-pane"
                style={{ width, flexShrink: 0, display: 'flex', flexDirection: 'column', minWidth: 0, borderLeft: '1px solid var(--border-subtle)', background: 'var(--bg-base)' }}
            >
                <header className="gl-shell-split-head">
                    <Icon size={13} style={{ color: 'var(--text-secondary)' }} aria-hidden="true" />
                    <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
                    <button type="button" className="gl-icon-btn" title="Swap with the main view" aria-label="Swap with the main view" onClick={swap}><ArrowLeftRight size={14} /></button>
                    <button type="button" className="gl-icon-btn" title="Open in the main view" aria-label="Open in the main view" onClick={openInMain}><Maximize2 size={14} /></button>
                    <button type="button" className="gl-icon-btn" title="Close split view (Ctrl+\)" aria-label="Close split view" onClick={split.close}><X size={14} /></button>
                </header>
                <div style={{ flex: 1, minHeight: 0, overflow: 'clip', position: 'relative', display: 'flex', flexDirection: 'column' }}>
                    <PaneRouter path={pane.path} />
                </div>
            </section>
        </MainNavigateContext.Provider>
    );
}
