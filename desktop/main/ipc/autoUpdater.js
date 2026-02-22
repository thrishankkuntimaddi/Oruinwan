/**
 * main/ipc/autoUpdater.js — Electron Auto-Updater Integration
 *
 * Uses electron-updater to check for new releases from the configured
 * publish target (GitHub Releases by default — see electron.config.js).
 *
 * Update flow:
 *  1. main.js calls checkForUpdatesAndNotify() 10s after launch
 *  2. If an update is available, renderer receives "update-available" event
 *  3. When downloaded, renderer receives "update-downloaded"
 *  4. Renderer shows an in-app banner; user clicks "Restart to Update"
 *  5. Renderer sends "install-update" IPC → autoUpdater.quitAndInstall()
 *
 * The web app can react to these events via:
 *   window.chttrixDesktop.on('update-available', (info) => { ... })
 *   window.chttrixDesktop.on('update-downloaded', (info) => { ... })
 */

"use strict";

const { ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
const log = require("electron-log");

// Route electron-updater logs through electron-log
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = "info";

// Do not auto-install on quit by default — let user confirm
autoUpdater.autoInstallOnAppQuit = false;

/**
 * Register auto-updater event handlers and IPC channels.
 *
 * @param {import('electron').BrowserWindow} win
 */
function registerAutoUpdater(win) {
    // ── Updater Events ────────────────────────────────────────────────────────

    autoUpdater.on("checking-for-update", () => {
        log.info("Auto-updater: checking for update...");
    });

    autoUpdater.on("update-available", (info) => {
        log.info(`Auto-updater: update available — v${info.version}`);
        win.webContents.send("update-available", {
            version: info.version,
            releaseDate: info.releaseDate,
        });
    });

    autoUpdater.on("update-not-available", () => {
        log.info("Auto-updater: already on the latest version.");
    });

    autoUpdater.on("download-progress", (progress) => {
        log.debug(
            `Auto-updater: downloading — ${Math.round(progress.percent)}% ` +
            `(${(progress.bytesPerSecond / 1024).toFixed(1)} KB/s)`
        );
    });

    autoUpdater.on("update-downloaded", (info) => {
        log.info(`Auto-updater: update downloaded — v${info.version}, ready to install.`);
        win.webContents.send("update-downloaded", {
            version: info.version,
        });
    });

    autoUpdater.on("error", (err) => {
        log.error("Auto-updater error:", err.message);
        // Do not crash — updates are non-critical
    });

    // ── IPC: renderer requests install ───────────────────────────────────────
    ipcMain.on("install-update", () => {
        log.info("Auto-updater: renderer requested install. Quitting and installing...");
        autoUpdater.quitAndInstall(false, true);
    });

    log.info("Auto-updater handlers registered.");
}

module.exports = { registerAutoUpdater };
