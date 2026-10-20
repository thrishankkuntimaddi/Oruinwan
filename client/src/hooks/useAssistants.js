import { useEffect, useState } from 'react';
import { aiService } from '../services/aiService';

// One fetch per workspace for every composer on screen; refreshed after a minute.
const cache = new Map(); // workspaceId -> { at, promise }
const TTL_MS = 60 * 1000;

/** The assistants this workspace can use: Oruinwan AI plus connected models (Claude, ChatGPT…). */
export function useAssistants(workspaceId) {
    const [list, setList] = useState([]);
    useEffect(() => {
        if (!workspaceId) return undefined;
        let live = true;
        let hit = cache.get(workspaceId);
        if (!hit || Date.now() - hit.at > TTL_MS) {
            hit = { at: Date.now(), promise: aiService.assistants(workspaceId).catch(() => []) };
            cache.set(workspaceId, hit);
        }
        hit.promise.then((l) => live && setList(l));
        return () => { live = false; };
    }, [workspaceId]);
    return list;
}
