'use strict';

/**
 * Chttrix Desktop — Persistent Settings Store
 *
 * Wraps electron-store to provide typed, schema-validated persistence
 * for user preferences (notification settings, window state, etc.)
 */

const Store = require('electron-store');

const schema = {
  // Window state — restored on next launch
  windowBounds: {
    type: 'object',
    properties: {
      x:      { type: 'number' },
      y:      { type: 'number' },
      width:  { type: 'number', minimum: 900 },
      height: { type: 'number', minimum: 600 },
    },
    default: { width: 1280, height: 800 },
  },
  windowMaximized: {
    type: 'boolean',
    default: false,
  },

  // Notification preferences
  notificationsEnabled: {
    type: 'boolean',
    default: true,
  },
  notificationSound: {
    type: 'boolean',
    default: true,
  },

  // Last loaded workspace URL (for deep-link restore)
  lastUrl: {
    type: 'string',
    default: '',
  },

  // DnD / Focus mode
  doNotDisturb: {
    type: 'boolean',
    default: false,
  },
};

const store = new Store({ schema, name: 'chttrix-settings' });

module.exports = store;
