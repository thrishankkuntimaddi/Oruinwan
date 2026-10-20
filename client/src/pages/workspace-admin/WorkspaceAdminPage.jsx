import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import WorkspaceSettingsModal from '../../components/home/panels/HomePanel/WorkspaceSettingsModal';
import DeleteWorkspaceModal from '../../components/home/panels/HomePanel/DeleteWorkspaceModal';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import './workspaceAdmin.css';

/** Workspace Admin: the full-page dashboard for this workspace's owner and admins (members see a read-only view). */
export default function WorkspaceAdminPage() {
    const [params, setParams] = useSearchParams();
    const { activeWorkspace } = useWorkspace();
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteVerification, setDeleteVerification] = useState('');
    return (
        <>
            <WorkspaceSettingsModal
                key={activeWorkspace?.id}
                variant="page"
                showSettingsModal
                setShowSettingsModal={() => {}}
                setShowDeleteConfirm={setShowDeleteConfirm}
                initialTab={params.get('section') || undefined}
                onTabChange={(tab) => setParams(tab === 'Overview' ? {} : { section: tab }, { replace: true })}
            />
            <DeleteWorkspaceModal showDeleteConfirm={showDeleteConfirm} setShowDeleteConfirm={setShowDeleteConfirm} workspaceName={activeWorkspace?.name}
                deleteVerification={deleteVerification} setDeleteVerification={setDeleteVerification} setShowSettingsModal={() => {}} />
        </>
    );
}
