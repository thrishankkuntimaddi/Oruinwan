const messagesService = require('./messages.service');
const messagesController = require('./messages.controller');
const messagesRoutes = require('./messages.routes');

module.exports = {
    service: messagesService,
    controller: messagesController,
    routes: messagesRoutes
};
