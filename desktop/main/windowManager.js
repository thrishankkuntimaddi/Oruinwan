/**
 * main/windowManager.js — Window Lifecycle Manager
 *
 * Maintains a reference to the main BrowserWindow so other modules
 * (tray, IPC handlers, auto-updater) can access it without circular imports.
 */

"use strict";

/** @type {import('electron').BrowserWindow | null} */
let _mainWindow = null;

/**
 * Register the main BrowserWindow.
 * Also hooks closed event to clear the reference.
 *
 * @param {import('electron').BrowserWindow} win
 */
function registerWindowManager(win) {
    _mainWindow = win;

    win.on("closed", () => {
        _mainWindow = null;
    });
}

/**
 * Returns the current main window, or null if it has been closed.
 *
 * @returns {import('electron').BrowserWindow | null}
 */
function getMainWindow() {
    return _mainWindow;
}

/**
 * Brings the main window to the foreground.
 * Creates a new window if none exists (handled by caller).
 */
function focusMainWindow() {
    const win = _mainWindow;
    if (!win) return;
    if (win.isMinimized()) win.restore();
    if (!win.isVisible()) win.show();
    win.focus();
}

module.exports = { registerWindowManager, getMainWindow, focusMainWindow };
