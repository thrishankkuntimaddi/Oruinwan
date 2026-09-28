'use strict';

/**
 * Module registry. Each module in src/modules/<name>/index.js exports:
 *   name                      short id, used in logs
 *   register({ app, io, requireAuth })   mount its HTTP routes (required)
 *   registerSocket(io, socket)           attach Socket.IO handlers for one connection (optional)
 *   start({ io })                        start background jobs once the DB is connected (optional)
 *
 * New domains go here instead of adding more app.use lines to server.js. Areas
 * still under src/features/ move over as they are worked on.
 */

const MODULES = [
    require('./messages'),
    require('./threads'),
    require('./notifications'),
    require('./huddles'),
    require('./meetings'),
];

function registerModules(ctx) {
    for (const mod of MODULES) mod.register(ctx);
}

function registerModuleSockets(io, socket) {
    for (const mod of MODULES) {
        if (mod.registerSocket) mod.registerSocket(io, socket);
    }
}

function startModules(ctx) {
    for (const mod of MODULES) {
        if (mod.start) mod.start(ctx);
    }
}

module.exports = { MODULES, registerModules, registerModuleSockets, startModules };
