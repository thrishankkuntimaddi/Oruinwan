/**
 * main/tray.js — System Tray Integration
 *
 * Creates a persistent tray icon so the app remains accessible
 * even when the main window is hidden (macOS) or minimized (Windows/Linux).
 *
 * Features:
 *  - Left-click: show/focus main window
 *  - Context menu: Show, Mute Notifications, Quit
 *  - Badge-style title on macOS tray for unread count
 */

"use strict";

const { Tray, Menu, nativeImage, app } = require("electron");
const path = require("path");
const log = require("electron-log");
const { focusMainWindow } = require("./windowManager");

/** @type {Tray | null} */
let _tray = null;

/** Current unread count (reflected in tray tooltip) */
let _unreadCount = 0;

/** Whether notifications are muted */
let _muted = false;

/**
 * Initialise the system tray.
 * Call this once from main.js after the app is ready.
 *
 * @param {import('electron').BrowserWindow} win
 */
function setupTray(win) {
    const iconPath = path.join(__dirname, "../assets/tray-icon.png");
    const icon = nativeImage.createFromPath(iconPath);

    // Use a template image on macOS (adapts to light/dark menu bar)
    const trayIcon = process.platform === "darwin"
        ? icon.resize({ width: 16, height: 16 })
        : icon.resize({ width: 20, height: 20 });

    _tray = new Tray(trayIcon);
    _tray.setToolTip("Chttrix");

    _buildContextMenu(win);

    // Left-click → show window
    _tray.on("click", () => {
        focusMainWindow();
    });

    // Listen for badge count updates from IPC (set in ipc/notifications.js)
    app.on("chttrix-badge-update", (count) => {
        _unreadCount = count;
        _tray.setToolTip(_unreadCount > 0 ? `Chttrix (${_unreadCount} unread)` : "Chttrix");
        _buildContextMenu(win);
    });

    log.info("System tray initialised");
    return _tray;
}

/**
 * Rebuild the tray context menu.
 * Called whenever state changes (mute toggle, count update).
 *
 * @param {import('electron').BrowserWindow} win
 */
function _buildContextMenu(win) {
    if (!_tray) return;

    const unreadLabel = _unreadCount > 0
        ? `${_unreadCount} Unread Message${_unreadCount !== 1 ? "s" : ""}`
        : "No new messages";

    const contextMenu = Menu.buildFromTemplate([
        {
            label: "Chttrix",
            enabled: false,
        },
        {
            label: unreadLabel,
            enabled: false,
            icon: _unreadCount > 0
                ? nativeImage.createFromDataURL(_getRedDotDataURL())
                : undefined,
        },
        { type: "separator" },
        {
            label: "Show Chttrix",
            click: () => focusMainWindow(),
        },
        {
            label: _muted ? "Unmute Notifications" : "Mute Notifications",
            type: "checkbox",
            checked: _muted,
            click: (menuItem) => {
                _muted = menuItem.checked;
                win.webContents.send("mute-notifications", _muted);
                _buildContextMenu(win);
                log.info(`Notifications ${_muted ? "muted" : "unmuted"} via tray`);
            },
        },
        { type: "separator" },
        {
            label: "Quit Chttrix",
            role: "quit",
        },
    ]);

    _tray.setContextMenu(contextMenu);
}

/**
 * Returns a tiny red dot as a data URL for the unread indicator icon.
 * Pure inline — no external asset needed.
 */
function _getRedDotDataURL() {
    return (
        "data:image/png;base64," +
        "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAB" +
        "HNCSVQICAgIfAhkiAAAAAlwSFlzAAALEgAACxIB0t1+/AAAAB" +
        "l0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAB" +
        "USURBVBhXY2AYdOD/////MzAwMAIxEwMDA4MREwMDA8P/MzAw" +
        "MABxAwMDA4MREwMDA8P/MzAwMABxAwMDA4MREwMDA8P/MzAwMA" +
        "BxAwMUAAIMABhjBRsAAAAASUVORK5CYII="
    );
}

module.exports = { setupTray };
