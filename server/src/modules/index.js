'use strict';

/**
 * Module registry. Each module in src/modules/<name>/index.js exports:
 *   name                      short id, used in logs
 *   register({ app, io, requireAuth })   mount its HTTP routes (required)
 *   registerSocket(io, socket)           attach Socket.IO handlers for one connection (optional)
 *   start({ io, jobs })                  start background work once the DB is connected (optional);
 *                                        jobs=false means: no scheduled jobs on this process
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

/**
 * Start each module's background work once the DB is connected.
 * ctx.jobs (default true) is false on processes that must not run scheduled
 * jobs (PROCESS_ROLE=api|realtime); modules still start shared-state plumbing.
 */
function startModules(ctx) {
    const context = { jobs: true, ...ctx };
    for (const mod of MODULES) {
        if (mod.start) mod.start(context);
    }
}

module.exports = { MODULES, registerModules, registerModuleSockets, startModules };
