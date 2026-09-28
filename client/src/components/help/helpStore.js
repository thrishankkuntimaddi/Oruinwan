/**
 * Tiny global store for the in-app Help panel.
 *
 * The panel lives in its own React root (mounted on first open) so it survives
 * whichever button opened it unmounting — e.g. the profile menu closes as soon
 * as you click into the panel. Components inside the router register a
 * navigate function so "Open" links stay client-side.
 */
import { useEffect, useSyncExternalStore } from 'react';

/** Views: home | topic | article | shortcuts | whatsnew | contact | requests */
const initial = { open: false, view: 'home', topicId: null, articleId: null, category: null, query: '', returnFocus: null };
let state = initial;
const listeners = new Set();

function emit() { listeners.forEach((l) => l()); }

export function getHelpState() { return state; }

export function subscribeHelp(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function setHelpState(patch) {
    state = { ...state, ...patch };
    emit();
}

let hostPromise = null;
function ensureHost() {
    if (!hostPromise && typeof document !== 'undefined') {
        hostPromise = import('./HelpPanelHost.jsx').then((m) => m.mountHelpHost());
    }
    return hostPromise;
}

/**
 * Open the panel. opts: { view, topicId, articleId, category, query }.
 * Focus returns to the element that was focused when it opened.
 */
export function openHelp(opts = {}) {
    const active = typeof document !== 'undefined' ? document.activeElement : null;
    state = {
        ...state,
        open: true,
        view: opts.view || (opts.articleId ? 'article' : opts.topicId ? 'topic' : 'home'),
        topicId: opts.topicId ?? null,
        articleId: opts.articleId ?? null,
        category: opts.category ?? null,
        query: opts.query ?? (state.open ? state.query : ''),
        returnFocus: state.open ? state.returnFocus : active,
    };
    emit();
    ensureHost();
}

export function closeHelp() {
    const target = state.returnFocus;
    state = { ...state, open: false, returnFocus: null };
    emit();
    if (target && typeof target.focus === 'function' && document.contains(target)) {
        // After the panel has unmounted its focus trap.
        setTimeout(() => target.focus(), 0);
    }
}

export function toggleHelp(opts) {
    if (state.open) closeHelp(); else openHelp(opts);
}

export function useHelpState() {
    return useSyncExternalStore(subscribeHelp, getHelpState, getHelpState);
}

// ── Navigation bridge ─────────────────────────────────────────────────────
let navigateFn = null;
export function setHelpNavigator(fn) { navigateFn = fn; }
export function helpNavigate(path) {
    if (navigateFn) navigateFn(path);
    else window.location.assign(path);
}

// ── "?" shortcut ──────────────────────────────────────────────────────────
function isTypingTarget(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

/** True when a keydown should open help: "?" (Shift+/) outside any text field, no modifiers. */
export function isHelpShortcut(e) {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return false;
    if (e.key !== '?') return false;
    return !isTypingTarget(e.target) && !isTypingTarget(document.activeElement);
}

let shortcutUsers = 0;
function onKeyDown(e) {
    if (!isHelpShortcut(e)) return;
    e.preventDefault();
    toggleHelp({ view: state.open ? state.view : 'home' });
}

/**
 * Registers the "?" shortcut while at least one help entry point is mounted,
 * and hands the panel this tree's navigate function.
 */
export function useHelpEntryPoint(navigate) {
    useEffect(() => {
        if (navigate) setHelpNavigator(navigate);
    }, [navigate]);
    useEffect(() => {
        shortcutUsers += 1;
        if (shortcutUsers === 1) document.addEventListener('keydown', onKeyDown);
        return () => {
            shortcutUsers -= 1;
            if (shortcutUsers === 0) document.removeEventListener('keydown', onKeyDown);
        };
    }, []);
}
