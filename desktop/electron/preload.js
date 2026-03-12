'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Secure preload bridge between the Electron main process and renderer.
 *
 * Only exposes a minimal, explicit API surface via contextBridge.
 * No additional IPC channels or OS features are exposed at this stage.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * A simple health-check ping.
   * @returns {string} 'pong'
   */
  ping: () => 'pong',
});
