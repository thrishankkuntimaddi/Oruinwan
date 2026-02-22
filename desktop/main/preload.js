/**
 * main/preload.js — Electron Preload Script (Context Bridge)
 *
 * This is the ONLY bridge between the web app renderer and the Electron main process.
 *
 * Security rules:
 *  - contextIsolation is ON  → renderer cannot access this file directly
 *  - Only explicitly listed APIs are exposed via contextBridge
 *  - No raw ipcRenderer reference is exposed (prevents arbitrary channel access)
 *  - No Node.js built-ins are exposed to the renderer
 */

"use strict";

const { contextBridge, ipcRenderer } = require("electron");

// ── Allowed IPC send channels (renderer → main) ───────────────────────────────
const ALLOWED_SEND_CHANNELS = [
    "set-badge-count",   // Update unread badge on dock/taskbar
    "open-external",     // Open a URL in the default browser
    "show-notification", // Trigger an OS notification
    "notify-ready",      // Web app signals it's mounted and ready
];

// ── Allowed IPC receive channels (main → renderer) ────────────────────────────
const ALLOWED_RECEIVE_CHANNELS = [
    "deep-link",          // Received when app is opened via chttrix:// URL
    "update-available",   // Auto-updater signals a new release
    "update-downloaded",  // Auto-updater: ready to install
    "focus-window",       // Main process requests renderer focus a conversation
];

// ── Exposed API ───────────────────────────────────────────────────────────────
contextBridge.exposeInMainWorld("chttrixDesktop", {
    /**
     * platform — lets the web app know it's running inside Electron
     * Usage: if (window.chttrixDesktop?.platform === 'electron') { ... }
     */
    platform: "electron",

    /**
     * setBadgeCount(count: number) — sets the unread badge on the app icon
     */
    setBadgeCount: (count) => {
        if (typeof count === "number" && count >= 0) {
            ipcRenderer.send("set-badge-count", count);
        }
    },

    /**
     * openExternal(url: string) — opens a URL in the system browser
     */
    openExternal: (url) => {
        if (typeof url === "string") {
            ipcRenderer.send("open-external", url);
        }
    },

    /**
     * showNotification(options: { title, body, icon? }) — triggers an OS notification
     */
    showNotification: (options) => {
        if (options && typeof options.title === "string") {
            ipcRenderer.send("show-notification", options);
        }
    },

    /**
     * notifyReady() — called by the web app after it has mounted
     * Allows main process to know when Socket.IO context is live
     */
    notifyReady: () => {
        ipcRenderer.send("notify-ready");
    },

    /**
     * on(channel, callback) — subscribe to events from the main process
     * Only channels in ALLOWED_RECEIVE_CHANNELS are permitted.
     *
     * Returns an unsubscribe function.
     */
    on: (channel, callback) => {
        if (!ALLOWED_RECEIVE_CHANNELS.includes(channel)) {
            console.warn(`[Chttrix Desktop] Blocked ipcRenderer.on for unknown channel: ${channel}`);
            return () => { };
        }
        const handler = (_event, ...args) => callback(...args);
        ipcRenderer.on(channel, handler);
        // Return unsubscribe
        return () => ipcRenderer.removeListener(channel, handler);
    },

    /**
     * once(channel, callback) — subscribe to a one-time event
     */
    once: (channel, callback) => {
        if (!ALLOWED_RECEIVE_CHANNELS.includes(channel)) return;
        ipcRenderer.once(channel, (_event, ...args) => callback(...args));
    },
});
