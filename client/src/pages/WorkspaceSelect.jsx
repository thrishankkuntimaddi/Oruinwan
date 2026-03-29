import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Rocket, Briefcase, Zap, Palette, Microscope, Globe,
    Shield, TrendingUp, Lightbulb, Flame, Target, Trophy
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import api from '@services/api';
import ProfileQuickSettings from "../components/workspace/ProfileQuickSettings";
import ChttrixAIChat from "../components/ai/ChttrixAIChat/ChttrixAIChat";
import { WorkspaceProvider } from "../contexts/WorkspaceContext";

// Extracted view components
import Header from './workspaceSelectComponents/Header.jsx';
import WorkspaceGrid from "./workspaceSelectComponents/WorkspaceGrid.jsx";
import CreateWorkspaceModal from "./workspaceSelectComponents/CreateWorkspaceModal.jsx";
import HelpModalsContainer from "./workspaceSelectComponents/HelpModalsContainer.jsx";
import LoadingState from "./workspaceSelectComponents/LoadingState.jsx";
import ErrorState from "./workspaceSelectComponents/ErrorState.jsx";

const WorkspaceSelect = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    // ⚡ PLATFORM ADMIN REDIRECT - Platform admins should NEVER be here
    React.useEffect(() => {
        if (user?.roles?.includes('chttrix_admin')) {
            navigate('/chttrix-admin', { replace: true });
        }
    }, [user, navigate]);

    // State
    const [workspaces, setWorkspaces] = useState([]);
    const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(true);
    const [loadError, setLoadError] = useState(null);

    // Help State
    const [showHelp, setShowHelp] = useState(false);
    const [activeHelpModal, setActiveHelpModal] = useState(null);

    // Profile Quick Settings State
    const [showProfile, setShowProfile] = useState(false);

    // ChttrixAI State
    const [showAI, setShowAI] = useState(false);

    // Create Modal State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [createStep, setCreateStep] = useState(1);
    const [nameError, setNameError] = useState("");
    const [createData, setCreateData] = useState({
        name: "",
        adminName: "",
        icon: "rocket",
        color: "#4f46e5",
        rules: "",
        invites: ""
    });
    const [termsAccepted, setTermsAccepted] = useState(false);

    // Load Workspaces
    const loadWorkspaces = React.useCallback(async () => {
        try {
            setIsLoadingWorkspaces(true);
            setLoadError(null);
            const response = await api.get('/api/workspaces/my');

            if (response.data.workspaces && response.data.workspaces.length > 0) {
                setWorkspaces(response.data.workspaces.map(ws => ({
                    id: ws.id,
                    name: ws.name,
                    members: ws.memberCount || 1,
                    icon: ws.icon || "rocket",
                    color: ws.color || "#4f46e5",
                    type: ws.type,
                    role: ws.role,
                    ownerName: ws.ownerName,
                    isOwner: ws.isOwner
                })));
            } else {
                setWorkspaces([]);
            }
            setIsLoadingWorkspaces(false);
        } catch (err) {
            console.error('❌ Error loading workspaces:', err);
            setLoadError('Failed to load workspaces');
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

    // --- Create Workspace Logic ---
    const resetCreateModal = () => {
        setIsCreateModalOpen(false);
        setCreateStep(1);
        setCreateData({
            name: "",
            adminName: "",
            icon: "rocket",
            color: "#4f46e5",
            rules: "",
            invites: ""
        });
        setNameError("");
        setTermsAccepted(false);
    };

    const handleCreateSubmit = async (e) => {
        e.preventDefault();

        // Step-specific validation
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

        // Final submission on step 4
        if (createStep === 4) {
            try {

                // 1. Create Workspace
                const res = await api.post('/api/workspaces/create', {
                    name: createData.name,
                    icon: createData.icon,
                    color: createData.color,
                    rules: createData.rules
                });

                const newWorkspaceId = res.data.workspace.id;


                // 2. Send Invites (if any)
                if (createData.invites && createData.invites.trim()) {
                    try {
                        await api.post(`/api/workspaces/${newWorkspaceId}/invite`, {
                            emails: createData.invites,
                            inviteType: 'email'
                        });
                    } catch (inviteError) {
                        console.error("Failed to send invites", inviteError);
                    }
                }

                await loadWorkspaces(); // Refresh list
                resetCreateModal();
                navigate(`/workspace/${newWorkspaceId}/home`);
            } catch (error) {
                console.error("Failed to create workspace", error);
                if (error.response?.data?.message) {
                    setNameError(error.response.data.message);
                } else {
                    setNameError('Failed to create workspace. Please try again.');
                }
            }
        }
    };

    // Helper to get Icon component
    const getIconComponent = (iconName) => {
        const icons = {
            rocket: Rocket, briefcase: Briefcase, zap: Zap, palette: Palette,
            microscope: Microscope, globe: Globe, shield: Shield, trendingUp: TrendingUp,
            lightbulb: Lightbulb, flame: Flame, target: Target, trophy: Trophy
        };
        return icons[iconName] || Rocket;
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans selection:bg-indigo-100 dark:selection:bg-indigo-900 selection:text-indigo-700 dark:selection:text-indigo-300">
            {/* Header */}
            <Header
                showHelp={showHelp}
                setShowHelp={setShowHelp}
                onHelpModalOpen={setActiveHelpModal}
                user={user}
                onProfileClick={() => setShowProfile(true)}
                onSettingsClick={() => navigate('/settings', { state: { from: '/workspaces' } })}
                onLogout={handleLogout}
                onOwnerConsoleClick={() => navigate('/owner/dashboard')}
                onAdminConsoleClick={() => navigate('/admin/dashboard')}
                onManagerConsoleClick={() => navigate('/manager/dashboard')}
                onAIClick={() => setShowAI(o => !o)}
                showAI={showAI}
            />

            {/* Main Content */}
            <main className="pt-24 md:pt-32 pb-20 px-4 md:px-6 max-w-7xl mx-auto">
                <div className="mb-12 text-center max-w-2xl mx-auto">
                    <h1 className="text-4xl font-black text-slate-900 dark:text-slate-100 mb-4 tracking-tight">
                        Welcome back, {user?.username?.split(' ')[0]}
                    </h1>
                    <p className="text-lg text-slate-500 dark:text-slate-400 font-medium">
                        Select a workspace to jump back in, or create a new one to get started.
                    </p>
                </div>

                {isLoadingWorkspaces ? (
                    <LoadingState />
                ) : loadError ? (
                    <ErrorState error={loadError} onRetry={loadWorkspaces} />
                ) : (
                    <WorkspaceGrid
                        workspaces={workspaces}
                        onWorkspaceClick={handleWorkspaceClick}
                        onCreateClick={() => setIsCreateModalOpen(true)}
                        getIconComponent={getIconComponent}
                        user={user}
                    />
                )}
            </main>

            {/* Create Modal */}
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
                getIconComponent={getIconComponent}
                user={user}
            />

            {/* Help Modals */}
            <HelpModalsContainer
                activeModal={activeHelpModal}
                onClose={() => setActiveHelpModal(null)}
            />

            {/* Profile Quick Settings Modal */}
            {showProfile && <ProfileQuickSettings onClose={() => setShowProfile(false)} />}

            {/* ChttrixAI Panel */}
            {showAI && (
                <div className="fixed top-0 right-0 h-full w-[380px] z-[200] shadow-2xl">
                    <WorkspaceProvider>
                        <ChttrixAIChat onClose={() => setShowAI(false)} isSidebar={true} />
                    </WorkspaceProvider>
                </div>
            )}
        </div>
    );
};

export default WorkspaceSelect;
