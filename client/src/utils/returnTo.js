// A shared link opened while signed out (a message, note, task or channel): remember it, and
// go there right after sign-in instead of the workspace list.
const KEY = 'oruinwan.returnTo';

const safe = (path) => typeof path === 'string' && /^\/workspace\/[^/]+\//.test(path) && !path.startsWith('//');

export function rememberReturn(path) {
    try {
        if (safe(path)) sessionStorage.setItem(KEY, path);
    } catch { /* storage blocked: sign-in still lands on the workspace list */ }
}

export function takeReturn() {
    try {
        const path = sessionStorage.getItem(KEY);
        sessionStorage.removeItem(KEY);
        return safe(path) ? path : null;
    } catch {
        return null;
    }
}
