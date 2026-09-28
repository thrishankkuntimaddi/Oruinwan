import React, { useState, useMemo } from "react";
import { Plus, Link2, Search, Lock } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import api from '@services/api';
import ProfileQuickSettings from "../components/workspace/ProfileQuickSettings";
import ChttrixAIChat from "../components/ai/ChttrixAIChat/ChttrixAIChat";
import { WorkspaceProvider } from "../contexts/WorkspaceContext";

import Header from './workspaceSelectComponents/Header.jsx';
import WorkspaceGrid from "./workspaceSelectComponents/WorkspaceGrid.jsx";
import CreateWorkspaceModal from "./workspaceSelectComponents/CreateWorkspaceModal.jsx";
import { DEFAULT_WORKSPACE_COLOR } from "../utils/workspaceIcons";
import LoadingState from "./workspaceSelectComponents/LoadingState.jsx";
import ErrorState from "./workspaceSelectComponents/ErrorState.jsx";
import EmptyState from "./workspaceSelectComponents/EmptyState.jsx";
import JoinInviteDialog from "./workspaceSelectComponents/JoinInviteDialog.jsx";
import { getCreatePolicy } from "./workspaceSelectComponents/createPolicy";
import "./workspaceSelectComponents/workspaceSelect.css";
import logger from '../utils/logger';

const WorkspaceSelect = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { showToast } = useToast();
    const location = useLocation();

    
    React.useEffect(() => {
        if (user?.roles?.includes('chttrix_admin')) {
            navigate('/platform-admin', { replace: true });
        }
    }, [user, navigate]);

    
    const [workspaces, setWorkspaces] = useState([]);
    const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(true);
    const [loadError, setLoadError] = useState(null);

    
    const [query, setQuery] = useState("");
    const [showJoin, setShowJoin] = useState(false);
    const closeJoin = React.useCallback(() => setShowJoin(false), []);
    // Per-workspace unread notification counts, reported by the header bell.
    const [unreadByWs, setUnreadByWs] = useState({});

    
    const [showProfile, setShowProfile] = useState(false);

    
    const [showAI, setShowAI] = useState(false);

    
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [createStep, setCreateStep] = useState(1);
    const [nameError, setNameError] = useState("");
    const [createData, setCreateData] = useState({
        name: "",
        adminName: "",
        icon: "rocket",
        color: DEFAULT_WORKSPACE_COLOR,
        rules: "",
        invites: ""
    });
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [creating, setCreating] = useState(false);

    // "Create workspace" from the in-workspace switcher lands here with the wizard open.
    React.useEffect(() => {
        if (location.state?.createWorkspace) {
            setIsCreateModalOpen(true);
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, location.pathname, navigate]);

    
    const loadWorkspaces = React.useCallback(async () => {
        try {
            setIsLoadingWorkspaces(true);
            setLoadError(null);
            const response = await api.get('/api/workspaces/my');

            if (response.data.workspaces && response.data.workspaces.length > 0) {
                // Suspended memberships stay visible (with a badge); removed ones don't.
                setWorkspaces(response.data.workspaces.filter(ws => !['removed', 'left'].includes(ws.membershipStatus)).map(ws => ({
                    id: ws.id,
                    name: ws.name,
                    description: ws.description || '',
                    // Active members only (server-side count).
                    members: typeof ws.memberCount === 'number' ? ws.memberCount : 1,
                    icon: ws.icon,
                    color: ws.color || null,
                    type: ws.type,
                    role: ws.isOwner ? 'owner' : ws.role,
                    membershipStatus: ws.membershipStatus || 'active',
                    ownerName: ws.ownerName,
                    isOwner: ws.isOwner
                })));
            } else {
                setWorkspaces([]);
            }
            setIsLoadingWorkspaces(false);
        } catch (err) {
            logger.error('❌ Error loading workspaces:', err);
            setLoadError(err?.response?.data?.message || 'Failed to load workspaces');
            setIsLoadingWorkspaces(false);
        }
    }, []);

    React.useEffect(() => {
        if (user) loadWorkspaces();
    }, [user, loadWorkspaces]);

    const handleLogout = async () => {
        await logout();
        window.location.replace("/");
    };

    const handleWorkspaceClick = (workspaceId) => {
        navigate(`/workspace/${workspaceId}/home`);
    };

    
    const resetCreateModal = React.useCallback(() => {
        setIsCreateModalOpen(false);
        setCreateStep(1);
        setCreateData({
            name: "",
            adminName: "",
            icon: "rocket",
            color: DEFAULT_WORKSPACE_COLOR,
            rules: "",
            invites: ""
        });
        setNameError("");
        setTermsAccepted(false);
        setCreating(false);
    }, []);

    const handleCreateSubmit = async (e) => {
        e.preventDefault();

        
        if (createStep === 1) {
            if (!createData.name.trim()) {
                setNameError("Please enter a workspace name");
                return;
            }
            setCreateStep(2);
            return;
        }

        if (createStep === 2) {
            setCreateStep(3);
            return;
        }

        if (createStep === 3) {
            if (!termsAccepted) {
                setNameError("You must acknowledge the workspace guidelines to proceed");
                return;
            }
            setNameError("");
            setCreateStep(4);
            return;
        }

        
        if (createStep === 4) {
            if (creating) return;
            setCreating(true);
            setNameError("");
            try {

                
                const res = await api.post('/api/workspaces/create', {
                    name: createData.name,
                    icon: createData.icon,
                    color: createData.color,
                    rules: createData.rules,
                    ...(createData.templateId ? { templateId: createData.templateId } : {})
                });

                const newWorkspaceId = res.data.workspace.id;

                
                // One address per comma or line.
                const emails = [...new Set((createData.invites || '')
                    .split(/[\s,;]+/)
                    .map(e => e.trim())
                    .filter(Boolean))];
                if (emails.length) {
                    try {
                        await api.post(`/api/workspaces/${newWorkspaceId}/invite`, {
                            emails,
                            inviteType: 'email'
                        });
                        showToast(`Invitation${emails.length === 1 ? '' : 's'} sent to ${emails.length} ${emails.length === 1 ? 'person' : 'people'}`, 'success');
                    } catch (inviteError) {
                        logger.error("Failed to send invites", inviteError);
                        showToast(inviteError.response?.data?.message || 'Workspace created, but the invitations could not be sent', 'error');
                    }
                }

                await loadWorkspaces(); 
                resetCreateModal();
                navigate(`/workspace/${newWorkspaceId}/home`);
            } catch (error) {
                logger.error("Failed to create workspace", error);
                setCreating(false);
                if (error.response?.data?.message) {
                    setNameError(error.response.data.message);
                } else {
                    setNameError('Failed to create workspace. Please try again.');
                }
            }
        }
    };

    
    const firstName = user?.username?.split(' ')[0];
    const policy = getCreatePolicy(user, workspaces);
    const openCreate = () => setIsCreateModalOpen(true);
    const showSearch = workspaces.length > 6;
    const q = showSearch ? query.trim().toLowerCase() : '';
    const visible = useMemo(
        () => (q ? workspaces.filter(ws => `${ws.name} ${ws.description || ''}`.toLowerCase().includes(q)) : workspaces),
        [workspaces, q],
    );
    const ownedCount = workspaces.filter(ws => ws.isOwner).length;
    const totalUnread = Object.values(unreadByWs).reduce((a, b) => a + b, 0);
    const ready = !isLoadingWorkspaces && !loadError;

    return (
        <div className="gl-wsp">
            <div className="gl-wsp-backdrop" aria-hidden="true">
                <div className="gl-wsp-backdrop__aurora gl-wsp-backdrop__aurora--a" />
                <div className="gl-wsp-backdrop__aurora gl-wsp-backdrop__aurora--b" />
            </div>

            <Header
                workspaces={workspaces}
                user={user}
                onUnreadChange={setUnreadByWs}
                onProfileClick={() => setShowProfile(true)}
                onSettingsClick={() => navigate('/settings', { state: { from: '/workspaces' } })}
                onLogout={handleLogout}
                onOwnerConsoleClick={() => navigate('/owner/dashboard')}
                onAdminConsoleClick={() => navigate('/admin/dashboard')}
                onManagerConsoleClick={() => navigate('/manager/dashboard')}
                onAIClick={() => setShowAI(o => !o)}
                showAI={showAI}
            />

            <main className="gl-wsp-main">
                <section className="gl-wsp-hero gl-ambient" aria-labelledby="gl-wsp-title">
                    <div>
                        <span className="gl-eyebrow">Your workspaces</span>
                        <h1 id="gl-wsp-title" className="gl-wsp-title">
                            Welcome back, {firstName ? <span className="gl-sheen">{firstName}</span> : null}
                        </h1>
                        <p className="gl-wsp-lead">
                            Select a workspace to jump back in, or create a new one to get started.
                        </p>
                        {ready && workspaces.length > 0 && (
                            <div className="gl-wsp-stats">
                                <div className="gl-wsp-stat">
                                    <span className="gl-wsp-stat__value">{workspaces.length}</span>
                                    <span className="gl-wsp-stat__label">Workspace{workspaces.length !== 1 && 's'}</span>
                                </div>
                                <div className="gl-wsp-stat">
                                    <span className="gl-wsp-stat__value">{ownedCount}</span>
                                    <span className="gl-wsp-stat__label">Owned by you</span>
                                </div>
                                <div className="gl-wsp-stat">
                                    <span className="gl-wsp-stat__value">{totalUnread}</span>
                                    <span className="gl-wsp-stat__label">Unread</span>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="gl-wsp-actions">
                        {policy.isCompanyMember ? (
                            <button type="button" className="gl-btn gl-btn--lg" disabled title={`Only admins & owners can create workspaces in ${policy.companyName}`}>
                                <Lock size={15} /> New workspace
                            </button>
                        ) : (
                            <button type="button" className="gl-btn gl-btn--primary gl-btn--lg" onClick={openCreate} disabled={policy.isLimitReached}
                                title={policy.isLimitReached ? 'You have reached the limit of 3 workspaces on the personal plan.' : undefined}>
                                <Plus size={16} /> New workspace
                            </button>
                        )}
                        <button type="button" className="gl-btn gl-btn--lg" onClick={() => setShowJoin(true)}>
                            <Link2 size={15} /> Join with invite
                        </button>
                    </div>
                </section>

                {isLoadingWorkspaces ? (
                    <>
                        <div className="gl-wsp-section-head"><h2 className="gl-wsp-section-title">Workspaces</h2></div>
                        <LoadingState count={workspaces.length || 2} />
                    </>
                ) : loadError ? (
                    <ErrorState error={loadError} onRetry={loadWorkspaces} />
                ) : workspaces.length === 0 ? (
                    <EmptyState {...policy} onCreateClick={openCreate} onJoinClick={() => setShowJoin(true)} />
                ) : (
                    <>
                        <div className="gl-wsp-section-head">
                            <h2 className="gl-wsp-section-title">
                                Workspaces <span className="gl-count">{q ? `${visible.length} / ${workspaces.length}` : workspaces.length}</span>
                            </h2>
                            {showSearch && (
                                <div className="gl-search gl-wsp-search" role="search">
                                    <Search size={14} />
                                    <input
                                        type="search"
                                        className="gl-input"
                                        placeholder="Search workspaces"
                                        aria-label="Search workspaces"
                                        value={query}
                                        onChange={e => setQuery(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Escape') setQuery(''); }}
                                    />
                                </div>
                            )}
                        </div>
                        <WorkspaceGrid
                            workspaces={visible}
                            allWorkspaces={workspaces}
                            query={q}
                            unreadByWs={unreadByWs}
                            onWorkspaceClick={handleWorkspaceClick}
                            onCreateClick={openCreate}
                            onClearSearch={() => setQuery('')}
                            user={user}
                        />
                    </>
                )}
            </main>

            <CreateWorkspaceModal
                isOpen={isCreateModalOpen}
                onClose={resetCreateModal}
                createStep={createStep}
                setCreateStep={setCreateStep}
                createData={createData}
                setCreateData={setCreateData}
                nameError={nameError}
                setNameError={setNameError}
                termsAccepted={termsAccepted}
                setTermsAccepted={setTermsAccepted}
                onSubmit={handleCreateSubmit}
                submitting={creating}
                user={user}
            />

            <JoinInviteDialog open={showJoin} onClose={closeJoin} />

            {showProfile && <ProfileQuickSettings onClose={() => setShowProfile(false)} />}

            {showAI && (
                <div className="gl-wsp-ai">
                    <WorkspaceProvider>
                        <ChttrixAIChat onClose={() => setShowAI(false)} isSidebar={true} />
                    </WorkspaceProvider>
                </div>
            )}
        </div>
    );
};

export default WorkspaceSelect;
