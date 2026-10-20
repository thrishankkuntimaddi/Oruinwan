// Split view: a second page beside the main one (desktop and wide tablets). The state lives
// here, not in MainLayout, because every route renders its own MainLayout and the pane must
// survive navigation. Remembered for this browser tab (sessionStorage); the width for good.
import { useSyncExternalStore } from 'react';

const STATE_KEY = 'oruinwan.split';
const WIDTH_KEY = 'oruinwan.split.width';
export const MIN_PANE_W = 320;
export const DEFAULT_PANE_W = 480;

function read(storage, key, fallback) {
    try {
        const raw = storage.getItem(key);
        return raw == null ? fallback : JSON.parse(raw);
    } catch {
        return fallback;
    }
}

function write(storage, key, value) {
    try {
        if (value == null) storage.removeItem(key);
        else storage.setItem(key, JSON.stringify(value));
    } catch {
        /* storage blocked: the pane just isn't remembered */
    }
}

let state = {
    // { path, workspaceId } of the page in the pane, or null when the pane is closed.
    pane: typeof window === 'undefined' ? null : read(window.sessionStorage, STATE_KEY, null),
    width: typeof window === 'undefined' ? DEFAULT_PANE_W : read(window.localStorage, WIDTH_KEY, DEFAULT_PANE_W),
    pickerOpen: false,
};
const listeners = new Set();

function set(patch) {
    state = { ...state, ...patch };
    if ('pane' in patch) write(window.sessionStorage, STATE_KEY, state.pane);
    listeners.forEach((l) => l());
}

export const split = {
    get: () => state,
    subscribe(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
    },
    /** Opens `path` (an app path inside the workspace) in the pane. */
    open(path, workspaceId) {
        set({ pane: { path, workspaceId: String(workspaceId) }, pickerOpen: false });
    },
    navigate(path) {
        if (state.pane) set({ pane: { ...state.pane, path } });
    },
    close() {
        set({ pane: null });
    },
    setWidth(width, { save = false } = {}) {
        set({ width });
        if (save) write(window.localStorage, WIDTH_KEY, width);
    },
    openPicker() {
        set({ pickerOpen: true });
    },
    closePicker() {
        set({ pickerOpen: false });
    },
};

export function useSplit() {
    return useSyncExternalStore(split.subscribe, split.get, split.get);
}

/** Widest the pane may be: the main view keeps at least this much room. */
export function clampPaneWidth(width, available) {
    const max = Math.max(MIN_PANE_W, available - 420);
    return Math.round(Math.min(Math.max(width, MIN_PANE_W), max));
}
