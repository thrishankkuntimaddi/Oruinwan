import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOptionalSocket } from '../../contexts/SocketContext';
import { useToast } from '../../contexts/ToastContext';
import UpgradeDialog from './UpgradeDialog';
import { emitPlanLimit, isPlanLimitBody, onPlanLimit, UPGRADE_URL } from './planLimit';

/**
 * The one app-wide upgrade dialog. Opens for:
 *  - any HTTP 403 { code: 'PLAN_LIMIT' } (services/api.js interceptor, fetch callers),
 *  - socket refusals (`huddle:error` with code PLAN_LIMIT — the call is full),
 * and shows a toast for `plan:limit_reached` (someone you invited hit their limit).
 */
export default function PlanLimitProvider() {
    const [refusal, setRefusal] = useState(null);
    const navigate = useNavigate();
    const { showToast } = useToast();
    const socket = useOptionalSocket()?.socket || null;

    useEffect(() => onPlanLimit((detail) => setRefusal(detail)), []);

    useEffect(() => {
        if (!socket) return undefined;
        const onHuddleError = (payload) => {
            if (isPlanLimitBody(payload)) emitPlanLimit(payload);
        };
        const onLimitReached = (payload) => {
            const who = payload?.username || 'Someone you invited';
            const where = payload?.workspaceName ? ` ${payload.workspaceName}` : ' your workspace';
            const text = payload?.message || `${who} couldn't join${where}: they have reached a free plan limit.`;
            showToast?.(text, 'warning', 9000, { title: 'Free plan limit', key: `plan-limit:${payload?.workspaceId || ''}:${payload?.userId || ''}` });
        };
        socket.on('huddle:error', onHuddleError);
        socket.on('plan:limit_reached', onLimitReached);
        return () => {
            socket.off('huddle:error', onHuddleError);
            socket.off('plan:limit_reached', onLimitReached);
        };
    }, [socket, showToast]);

    const close = useCallback(() => setRefusal(null), []);
    const seePlans = useCallback(() => {
        const url = refusal?.upgradeUrl && refusal.upgradeUrl.startsWith('/') ? refusal.upgradeUrl : UPGRADE_URL;
        setRefusal(null);
        navigate(url);
    }, [refusal, navigate]);

    return <UpgradeDialog open={!!refusal} message={refusal?.message} onSeePlans={seePlans} onClose={close} />;
}
