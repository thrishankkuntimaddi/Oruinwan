// server/src/modules/messages/index.js
/**
 * Messages Module - Public API
 * 
 * Central export point for messages module
 */

const messagesService = require('./messages.service');
const messagesController = require('./messages.controller');
const messagesRoutes = require('./messages.routes');

module.exports = {
    service: messagesService,
    controller: messagesController,
    routes: messagesRoutes
};
