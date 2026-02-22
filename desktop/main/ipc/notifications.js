/**
 * main/ipc/notifications.js — OS Native Notification Handler
 *
 * Listens for "show-notification" IPC messages from the renderer
 * and displays them via Electron's Notification API.
 *
 * The renderer (web app) can call:
 *   window.chttrixDesktop.showNotification({ title, body, icon })
 *
 * This module also:
 *  - Suppresses notifications when the window is focused (web app handles those)
 *  - Emits badge update events when the app is in background
 */

"use strict";

const { ipcMain, Notification, app } = require("electron");
const log = require("electron-log");
const path = require("path");

/**
 * Register all notification IPC handlers.
 *
 * @param {import('electron').BrowserWindow} win
 */
function registerNotificationHandlers(win) {
    ipcMain.on("show-notification", (event, options) => {
        // Validate input from renderer
        if (!options || typeof options.title !== "string" || !options.title.trim()) {
            log.warn("show-notification: invalid options received", options);
            return;
        }

        // Suppress OS notification if the window is currently focused
        // (the web app already shows an in-app toast in that case)
        if (win.isFocused()) {
            return;
        }

        if (!Notification.isSupported()) {
            log.warn("OS notifications are not supported on this platform.");
            return;
        }

        const note = new Notification({
            title: options.title,
            body: typeof options.body === "string" ? options.body : "",
            icon: path.join(__dirname, "../../assets/icon.png"),
            silent: false,
        });

        // Clicking the OS notification focuses the app window
        note.on("click", () => {
            if (win.isMinimized()) win.restore();
            if (!win.isVisible()) win.show();
            win.focus();

            // Tell the web app which notification was clicked (so it can navigate)
            if (options.conversationId) {
                win.webContents.send("focus-window", {
                    conversationId: options.conversationId,
                });
            }
        });

        note.show();
        log.debug(`OS notification shown: "${options.title}"`);
    });

    // Badge count updates from renderer — propagate to app + tray
    ipcMain.on("set-badge-count", (_event, count) => {
        const n = parseInt(count, 10);
        if (isNaN(n) || n < 0) return;

        // macOS dock badge / Windows taskbar overlay
        if (process.platform !== "linux") {
            app.setBadgeCount(n);
        }

        // Notify tray module via app-level event
        app.emit("chttrix-badge-update", n);
        log.debug(`Badge count updated: ${n}`);
    });
}

module.exports = { registerNotificationHandlers };
