import { useEffect, useState } from 'react';
import api from '@services/api';
import { recipientsFrom } from './recipients';

/**
 * The workspace's active members (minus me) as recipients, loaded fresh each time `open`
 * becomes true, so people who joined since the page loaded can be found.
 */
export default function useWorkspaceRecipients(workspaceId, myId, open = true) {
    const [state, setState] = useState({ list: [], loading: false, error: null });

    useEffect(() => {
        if (!open || !workspaceId) return undefined;
        let live = true;
        setState((s) => ({ ...s, loading: true, error: null }));
        api.get(`/api/workspaces/${workspaceId}/members`)
            .then((res) => { if (live) setState({ list: recipientsFrom(res.data?.members, myId), loading: false, error: null }); })
            .catch((err) => {
                if (live) setState((s) => ({ ...s, loading: false, error: err?.response?.data?.message || 'Could not load people' }));
            });
        return () => { live = false; };
    }, [workspaceId, myId, open]);

    return state;
}
