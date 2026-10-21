/**
 * The call in its own small always-on-top window, so it stays visible over other apps.
 *
 *  - Desktop app: window.open() of a named blank window; the desktop app (desktop/electron/main.js)
 *    makes that window small, frameless-ish and always on top.
 *  - Chrome / Edge: the Document Picture-in-Picture API.
 *
 * Both give a window in this same page, so React can render into it and the call's media
 * streams play there directly.
 */

export const FLOATING_NAME = 'oruinwan-call';
const SIZE = { width: 340, height: 236 };

const isDesktopApp = (win) => !!win?.oruinwanDesktop;

/** Whether this browser or app can pop the call out into its own window. */
export function canPopOut(win = typeof window !== 'undefined' ? window : undefined) {
    if (!win) return false;
    return isDesktopApp(win) || !!win.documentPictureInPicture?.requestWindow;
}

/** Copy the page's styles and theme into the floating window, so it looks like the app. */
export function copyLook(fromDoc, toDoc) {
    const head = toDoc.head;
    for (const node of fromDoc.querySelectorAll('style, link[rel="stylesheet"]')) {
        head.appendChild(node.cloneNode(true));
    }
    for (const attr of ['class', 'data-theme', 'style']) {
        const v = fromDoc.documentElement.getAttribute(attr);
        if (v != null) toDoc.documentElement.setAttribute(attr, v);
    }
    if (fromDoc.body?.className) toDoc.body.className = fromDoc.body.className;
    toDoc.body.classList.add('cs-floating-body');
    toDoc.title = 'Oruinwan call';
}

/**
 * Open the floating window. Must run from a click (or, in the desktop app, from the app's own
 * minimise/blur hook, which counts as one). Resolves with the window, or null.
 */
export async function openFloatingWindow(win = window) {
    let child = null;
    try {
        if (isDesktopApp(win)) {
            child = win.open('about:blank', FLOATING_NAME, `width=${SIZE.width},height=${SIZE.height}`);
        } else if (win.documentPictureInPicture?.requestWindow) {
            child = await win.documentPictureInPicture.requestWindow(SIZE);
        }
    } catch {
        child = null;
    }
    if (!child || !child.document) return null;
    copyLook(win.document, child.document);
    return child;
}
