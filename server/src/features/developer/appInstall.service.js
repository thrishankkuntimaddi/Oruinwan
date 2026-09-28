'use strict';

/**
 * Install / uninstall a marketplace App into a workspace. Shared by
 * /api/marketplace/* and /api/developer/apps/*. Callers must already have
 * checked that the requester is an owner/admin of the workspace.
 *
 * Throws HttpError(400|404|409).
 */

const App = require('./app.model');
const { HttpError, isValidId } = require('../../shared/utils/workspaceAccess');

async function installApp(appId, workspaceId) {
    if (!appId || !isValidId(appId)) throw new HttpError(400, 'Invalid appId');
    const app = await App.findById(appId).select('name isPublished installedIn');
    if (!app || app.isPublished === false) throw new HttpError(404, 'App not found');
    if ((app.installedIn || []).some(id => String(id) === String(workspaceId))) {
        throw new HttpError(409, 'App already installed in this workspace');
    }
    await App.updateOne({ _id: app._id }, { $addToSet: { installedIn: workspaceId } });
    return { appId: String(app._id), name: app.name, installed: true };
}

async function uninstallApp(appId, workspaceId) {
    if (!appId || !isValidId(appId)) throw new HttpError(400, 'Invalid appId');
    const app = await App.findById(appId).select('name installedIn');
    if (!app) throw new HttpError(404, 'App not found');
    if (!(app.installedIn || []).some(id => String(id) === String(workspaceId))) {
        throw new HttpError(404, 'App is not installed in this workspace');
    }
    await App.updateOne({ _id: app._id }, { $pull: { installedIn: workspaceId } });
    return { appId: String(app._id), name: app.name, installed: false };
}

/** Strip installedIn from an App doc and replace it with installed/installCount. */
function toPublicApp(app, workspaceId) {
    const { installedIn, ...rest } = app;
    const list = installedIn || [];
    return {
        ...rest,
        installCount: list.length,
        installed: workspaceId ? list.some(id => String(id) === String(workspaceId)) : false,
    };
}

module.exports = { installApp, uninstallApp, toPublicApp };
