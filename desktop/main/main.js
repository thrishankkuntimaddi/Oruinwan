/**
 * main/main.js — Electron Main Process
 *
 * Responsibilities:
 *  - Create and manage the BrowserWindow
 *  - Load the Chttrix web app (remote URL or local dev server)
 *  - Set up IPC handlers (notifications, deep links, auto-updater)
 *  - Manage system tray
 *
 * Security posture:
 *  - nodeIntegration: FALSE
 *  - contextIsolation: TRUE
 *  - All Node.js access is via a typed preload bridge only
 *
 * BACKEND IS UNTOUCHED. This file never imports from server/ or client/.
 */

"use strict";

const { app, BrowserWindow, ipcMain, shell, nativeTheme } = require("electron");
const path = require("path");
const log = require("electron-log");
const { setupTray } = require("./tray");
const { registerWindowManager, getMainWindow } = require("./windowManager");
const { registerNotificationHandlers } = require("./ipc/notifications");
const { registerDeepLinkHandlers } = require("./ipc/deepLink");
const { registerAutoUpdater } = require("./ipc/autoUpdater");

// ── Configuration ─────────────────────────────────────────────────────────────

/**
 * The URL of the deployed Chttrix web app.
 * In dev mode, override via CHTTRIX_URL env var to point at localhost:3000.
 * In production, point to the live domain.
 */
const CHTTRIX_WEB_URL =
    process.env.CHTTRIX_URL || "https://app.chttrix.com";

const isDev = process.env.NODE_ENV === "development" || process.env.CHTTRIX_URL !== undefined;

// ── Logging ───────────────────────────────────────────────────────────────────
log.transports.file.level = "info";
log.transports.console.level = isDev ? "debug" : "warn";
log.info(`Chttrix Desktop starting — isDev=${isDev}, url=${CHTTRIX_WEB_URL}`);

// ── Single-instance lock ──────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
    log.warn("Another instance is already running. Quitting.");
    app.quit();
}

app.on("second-instance", (_event, argv) => {
    // When a second instance is launched (e.g. from a deep link), focus the existing window.
    const win = getMainWindow();
    if (win) {
        if (win.isMinimized()) win.restore();
        win.focus();
    }
    // Handle deep link from second-instance argv
    const url = argv.find((arg) => arg.startsWith("chttrix://"));
    if (url) {
        const win2 = getMainWindow();
        win2 && win2.webContents.send("deep-link", url);
    }
});

// ── Window Creation ───────────────────────────────────────────────────────────

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        title: "Chttrix",
        backgroundColor: nativeTheme.shouldUseDarkColors ? "#0f0f1a" : "#ffffff",
        icon: path.join(__dirname, "../assets/icon.png"),
        show: false, // show only after ready-to-show to avoid flash
        webPreferences: {
            // ── Security: critical settings ──────────────────────────────────
            nodeIntegration: false,         // No direct Node.js access in renderer
            contextIsolation: true,         // Isolates preload from renderer world
            // sandbox: true is intentionally omitted — it prevents React CRA bundles
            // from executing. nodeIntegration:false + contextIsolation:true already
            // provides the necessary isolation.
            webSecurity: true,              // Enforce same-origin policy
            allowRunningInsecureContent: false,
            // ── Preload bridge ───────────────────────────────────────────────
            preload: path.join(__dirname, "preload.js"),
        },
    });

    // Register this window with the manager
    registerWindowManager(win);

    // Load the web app — identical to opening it in a browser
    win.loadURL(CHTTRIX_WEB_URL);

    // Show window only when fully loaded to prevent white flash
    win.once("ready-to-show", () => {
        win.show();
    });

    // Log load failures to the terminal for easier debugging
    win.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
        log.error(`Failed to load ${validatedURL}: [${errorCode}] ${errorDescription}`);
    });

    // In dev: open DevTools with Cmd+Option+I (keeps window unobscured on launch)
    if (isDev) {
        const { globalShortcut } = require("electron");
        globalShortcut.register("CommandOrControl+Alt+I", () => {
            win.webContents.toggleDevTools();
        });
    }

    // Open external links in the default browser, not in Electron
    win.webContents.setWindowOpenHandler(({ url }) => {
        if (!url.startsWith(CHTTRIX_WEB_URL)) {
            shell.openExternal(url);
            return { action: "deny" };
        }
        return { action: "allow" };
    });

    // Handle page title changes for taskbar
    win.webContents.on("page-title-updated", (_e, title) => {
        win.setTitle(title || "Chttrix");
    });

    log.info(`Main window created, loading: ${CHTTRIX_WEB_URL}`);
    return win;
}

// ── App Lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
    const win = createWindow();

    // Register IPC channels (must happen after window creation)
    registerNotificationHandlers(win);
    registerDeepLinkHandlers(win);
    registerAutoUpdater(win);

    // System tray (always-visible even when window is hidden)
    setupTray(win);

    // macOS: re-create window when dock icon is clicked with no open windows
    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });

    // Check for updates 10 seconds after launch (non-blocking)
    if (!isDev) {
        setTimeout(() => {
            const { autoUpdater } = require("electron-updater");
            autoUpdater.checkForUpdatesAndNotify().catch((err) => {
                log.warn("Auto-update check failed:", err.message);
            });
        }, 10_000);
    }
});

// Quit when all windows are closed, except on macOS (menu-bar app convention)
app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

// ── IPC: Open URL in browser ──────────────────────────────────────────────────
ipcMain.on("open-external", (_event, url) => {
    if (typeof url === "string" && (url.startsWith("https://") || url.startsWith("http://"))) {
        shell.openExternal(url);
    }
});

// ── IPC: Set badge count (macOS dock / Windows taskbar) ──────────────────────
ipcMain.on("set-badge-count", (_event, count) => {
    const n = parseInt(count, 10);
    if (!isNaN(n) && n >= 0) {
        app.setBadgeCount(n);
    }
});

// ── Crash / error handling ────────────────────────────────────────────────────
process.on("uncaughtException", (err) => {
    log.error("Uncaught exception in main process:", err);
});
