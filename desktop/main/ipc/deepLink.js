/**
 * main/ipc/deepLink.js — Deep Link Handler (chttrix:// protocol)
 *
 * Registers the app as the default handler for the "chttrix://" custom protocol.
 * This allows OS-level links (e.g. from a browser or email) to open the
 * Chttrix desktop app and navigate directly to a workspace, channel, or DM.
 *
 * Example deep links:
 *   chttrix://workspace/abc123
 *   chttrix://dm/user456
 *   chttrix://channel/general
 *   chttrix://invite/token789
 *
 * Security:
 *   - Only URLs matching the chttrix:// schema are processed
 *   - The URL is passed to the renderer as a string; the renderer validates routing
 *   - On macOS, handled via 'open-url' event
 *   - On Windows/Linux, parsed from argv of the second instance
 */

"use strict";

const { app, ipcMain } = require("electron");
const log = require("electron-log");
const { getMainWindow, focusMainWindow } = require("../windowManager");

const PROTOCOL = "chttrix";

/**
 * Register deep link protocol and IPC handlers.
 *
 * @param {import('electron').BrowserWindow} win
 */
function registerDeepLinkHandlers(win) {
    // Register as default handler for the chttrix:// protocol
    if (process.defaultApp) {
        // Development: argv[1] is the script path
        if (process.argv.length >= 2) {
            app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [process.argv[1]]);
        }
    } else {
        app.setAsDefaultProtocolClient(PROTOCOL);
    }

    // macOS: deep link arrives via 'open-url' event on the app object
    app.on("open-url", (event, url) => {
        event.preventDefault();
        log.info(`Deep link received (macOS open-url): ${url}`);
        _handleDeepLink(url, win);
    });

    // Windows/Linux: deep link arrives in argv of a second instance
    // The second-instance handler in main.js passes it here via IPC
    // (no additional handler needed here — main.js already sends "deep-link" event)

    log.info(`Deep link protocol registered: ${PROTOCOL}://`);
}

/**
 * Parse and forward a deep link URL to the renderer.
 *
 * @param {string} url - The full deep link URL, e.g. "chttrix://workspace/abc123"
 * @param {import('electron').BrowserWindow} win
 */
function _handleDeepLink(url, win) {
    if (!url || !url.startsWith(`${PROTOCOL}://`)) {
        log.warn(`Invalid deep link URL: ${url}`);
        return;
    }

    focusMainWindow();

    const targetWin = win || getMainWindow();
    if (targetWin) {
        // Forward the raw URL to the web app's router — it owns navigation logic
        targetWin.webContents.send("deep-link", url);
        log.info(`Deep link forwarded to renderer: ${url}`);
    }
}

module.exports = { registerDeepLinkHandlers };
