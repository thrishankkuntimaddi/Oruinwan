import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '@services/api';
import { useAuth } from '../../contexts/AuthContext';
import { ConfirmDialog } from '../../pages/settingsTabs/settingsUi';
import { BACKUP_API, formatBytes } from '../../pages/settingsTabs/backupInfo';

const dismissKey = (userId) => `oruinwan.backupOffer.${userId}`;

/** Offer the restore when Drive backup is connected, a backup exists and the account looks empty. */
export function shouldOffer(status) {
    return Boolean(status?.configured && status.connected && status.lastBackupAt && status.accountLooksEmpty);
}

/**
 * After sign-in: if this account has a Google Drive backup but no notes, tasks or pages of its
 * own (a fresh or wiped account), offer to restore it — once, until dismissed.
 */
export default function BackupRestoreOffer() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [status, setStatus] = useState(null);
    const userId = user?._id || user?.id;

    useEffect(() => {
        if (!userId) return undefined;
        try { if (localStorage.getItem(dismissKey(userId))) return undefined; } catch { /* storage blocked: still offer */ }
        let alive = true;
        api.get(`${BACKUP_API}/status`, { params: { offer: 1 } })
            .then(({ data }) => { if (alive && shouldOffer(data)) setStatus(data); })
            .catch(() => { /* backup not available: nothing to offer */ });
        return () => { alive = false; };
    }, [userId]);

    if (!status || location.pathname.startsWith('/settings')) return null;

    const dismiss = () => {
        try { localStorage.setItem(dismissKey(userId), String(Date.now())); } catch { /* ignore */ }
        setStatus(null);
    };

    return (
        <ConfirmDialog
            open
            title="Restore from Google Drive?"
            confirmLabel="Review restore"
            cancelLabel="Not now"
            onCancel={dismiss}
            onConfirm={() => { dismiss(); navigate('/settings?tab=backup&restore=1'); }}
        >
            <p>
                There&apos;s a backup of your Oruinwan data in {status.googleEmail || 'your Google Drive'} from{' '}
                <strong>{new Date(status.lastBackupAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</strong>
                {status.lastBackupSize ? ` (${formatBytes(status.lastBackupSize)})` : ''}. You&apos;ll see exactly what comes back before anything changes.
            </p>
        </ConfirmDialog>
    );
}
