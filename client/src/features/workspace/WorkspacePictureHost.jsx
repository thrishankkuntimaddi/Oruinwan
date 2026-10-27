import React, { useEffect, useRef, useState } from 'react';
import api from '@services/api';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useToast } from '../../contexts/ToastContext';
import SquareCropDialog from '../../shared/components/media/SquareCropDialog';

export const WORKSPACE_PICTURE_EVENT = 'oruinwan:workspace-picture';

/** Ask the page to pick, crop and upload a new picture for the open workspace (owners/admins). */
export function changeWorkspacePicture() {
    window.dispatchEvent(new CustomEvent(WORKSPACE_PICTURE_EVENT));
}

/**
 * Mounted once by the main layout: the workspace menu's "Workspace picture" opens a file picker
 * here, the picture is cropped to a square (like a group icon) and uploaded as the workspace's
 * logo (server: workspaceProfile.js). Menus close on click, so this lives outside them.
 */
export default function WorkspacePictureHost() {
    const { activeWorkspace, refreshWorkspace } = useWorkspace() || {};
    const { showToast } = useToast() || {};
    const input = useRef(null);
    const [file, setFile] = useState(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        const open = () => input.current?.click();
        window.addEventListener(WORKSPACE_PICTURE_EVENT, open);
        return () => window.removeEventListener(WORKSPACE_PICTURE_EVENT, open);
    }, []);

    const upload = async (blob) => {
        if (!activeWorkspace?.id) return;
        setBusy(true);
        try {
            const body = new FormData();
            body.append('image', new File([blob], 'workspace.jpg', { type: 'image/jpeg' }));
            await api.post(`/api/workspaces/${activeWorkspace.id}/profile/logo`, body, { headers: { 'Content-Type': 'multipart/form-data' } });
            await refreshWorkspace?.();
            showToast?.('Workspace picture updated', 'success');
            setFile(null);
        } catch (err) {
            showToast?.(err?.response?.data?.message || 'Could not update the workspace picture', 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden data-testid="workspace-picture-input"
                onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (!f) return;
                    if (f.size > 5 * 1024 * 1024) { showToast?.('Pictures can be at most 5 MB', 'error'); return; }
                    setFile(f);
                }} />
            {file && <SquareCropDialog file={file} title="Workspace picture" busy={busy} onCancel={() => setFile(null)} onDone={upload} />}
        </>
    );
}
