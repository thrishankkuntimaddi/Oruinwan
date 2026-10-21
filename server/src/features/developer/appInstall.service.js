'use strict';

/**
 * Install / uninstall a marketplace App into a workspace. Shared by
 * /api/marketplace/* and /api/developer/apps/*. Callers must already have
 * checked that the requester is an owner/admin of the workspace.
 *
 * Installing an app that declares scopes issues an app token: an ApiKey bound to
 * the workspace with exactly those scopes (appId set), usable on the public API.
 * An app that declares a bot user also gets a Bot in the workspace. The raw
 * tokens are returned once to the installer and, when the app has a webhook URL,
 * delivered to it in a signed `app.installed` POST. Uninstalling revokes both
 * and sends `app.uninstalled`.
 *
 * Throws HttpError(400|404|409).
 */

const crypto = require('crypto');
const App = require('./app.model');
const ApiKey = require('./apiKey.model');
const Bot = require('./bot.model');
const logger = require('../../../utils/logger');
const { HttpError, isValidId } = require('../../shared/utils/workspaceAccess');

const BOT_SCOPES = ['messages:read', 'messages:write', 'tasks:read', 'tasks:write'];

function isApproved(app) {
    return app && app.isPublished !== false && (!app.status || app.status === 'approved');
}

/** HMAC-SHA256 of the raw body, hex, prefixed like outgoing webhooks. */
function signBody(body, secret) {
    return 'sha256=' + crypto.createHmac('sha256', String(secret)).update(body).digest('hex');
}

/**
 * POST a lifecycle event to the app's webhook URL. Best effort: returns
 * { delivered, status?, error? } and never throws.
 */
async function deliverAppEvent(app, event, data) {
    if (!app.webhookUrl) return { delivered: false, error: 'no webhook URL' };
    try {
        const { assertNotSSRF } = require('../../modules/linkPreview/linkPreview.service');
        await assertNotSSRF(app.webhookUrl);
        const body = JSON.stringify({ event, appId: String(app._id), data, timestamp: new Date().toISOString() });
        const headers = { 'Content-Type': 'application/json', 'X-Oruinwan-Event': event };
        if (app.signingSecret) headers['X-Oruinwan-Signature'] = signBody(body, app.signingSecret);
        const res = await fetch(app.webhookUrl, { method: 'POST', headers, body, signal: AbortSignal.timeout(8000), redirect: 'error' });
        return { delivered: res.ok, status: res.status };
    } catch (err) {
        logger.warn(`[Apps] ${event} delivery to app ${app._id} failed: ${err.message}`);
        return { delivered: false, error: err.message };
    }
}

async function installApp(appId, workspaceId, { userId } = {}) {
    if (!appId || !isValidId(appId)) throw new HttpError(400, 'Invalid appId');
    const app = await App.findById(appId)
        .select('name isPublished status installedIn scopes botUser webhookUrl +signingSecret');
    if (!app || !isApproved(app)) throw new HttpError(404, 'App not found');

    // Atomic: only one concurrent install can add the workspace.
    const upd = await App.updateOne({ _id: app._id, installedIn: { $ne: workspaceId } }, { $addToSet: { installedIn: workspaceId } });
    const changed = upd.modifiedCount ?? upd.nModified ?? 0;
    if (!changed) throw new HttpError(409, 'App already installed in this workspace');

    const scopes = Array.isArray(app.scopes) ? [...app.scopes] : [];
    let appToken = null;
    let botToken = null;
    try {
        if (scopes.length && userId) {
            const { rawKey, keyHash, keyPrefix } = ApiKey.generateKey();
            await ApiKey.create({
                workspaceId, name: `App: ${app.name}`.slice(0, 100), keyHash, keyPrefix,
                permissions: scopes, createdBy: userId, appId: app._id,
            });
            appToken = rawKey;
        }
        if (app.botUser?.enabled && userId) {
            const botScopes = scopes.filter((s) => BOT_SCOPES.includes(s));
            if (scopes.includes('messages:read') && !botScopes.includes('messages:write')) botScopes.push('messages:write');
            const { rawToken, tokenHash, tokenPrefix } = Bot.generateToken();
            await Bot.create({
                name: (app.botUser.name || app.name).slice(0, 80),
                description: `Bot user of the ${app.name} app`.slice(0, 300),
                workspaceId, tokenHash, tokenPrefix,
                permissions: botScopes.length ? botScopes : ['messages:read', 'messages:write'],
                createdBy: userId, appId: app._id,
            });
            botToken = rawToken;
        }
    } catch (err) {
        // Roll back so the workspace isn't left "installed" without its token.
        await App.updateOne({ _id: app._id }, { $pull: { installedIn: workspaceId } }).catch(() => {});
        await ApiKey.updateMany({ appId: app._id, workspaceId, isActive: true }, { isActive: false }).catch(() => {});
        await Bot.updateMany({ appId: app._id, workspaceId, isActive: true }, { isActive: false }).catch(() => {});
        throw err;
    }

    const delivery = await deliverAppEvent(app, 'app.installed', {
        workspaceId: String(workspaceId), installedBy: userId ? String(userId) : null, scopes,
        token: appToken, botToken,
    });

    return {
        appId: String(app._id), name: app.name, installed: true, scopes,
        appToken, botToken, webhookDelivered: delivery.delivered,
    };
}

async function uninstallApp(appId, workspaceId) {
    if (!appId || !isValidId(appId)) throw new HttpError(400, 'Invalid appId');
    const app = await App.findById(appId).select('name installedIn webhookUrl +signingSecret');
    if (!app) throw new HttpError(404, 'App not found');
    if (!(app.installedIn || []).some(id => String(id) === String(workspaceId))) {
        throw new HttpError(404, 'App is not installed in this workspace');
    }
    await App.updateOne({ _id: app._id }, { $pull: { installedIn: workspaceId } });
    const revoked = await revokeAppTokens(app._id, workspaceId);
    await deliverAppEvent(app, 'app.uninstalled', { workspaceId: String(workspaceId) });
    return { appId: String(app._id), name: app.name, installed: false, ...revoked };
}

/** Deactivate an app's tokens and bot users in one workspace, or everywhere when workspaceId is null. */
async function revokeAppTokens(appId, workspaceId = null) {
    const q = { appId, isActive: true, ...(workspaceId ? { workspaceId } : {}) };
    const [k, b] = await Promise.all([
        ApiKey.updateMany(q, { isActive: false }),
        Bot.updateMany(q, { isActive: false }),
    ]);
    return { revokedTokens: k?.modifiedCount ?? 0, revokedBots: b?.modifiedCount ?? 0 };
}

/** Strip installedIn (and secrets) from an App doc and replace it with installed/installCount. */
function toPublicApp(app, workspaceId) {
    // eslint-disable-next-line no-unused-vars
    const { installedIn, signingSecret, ...rest } = app;
    const list = installedIn || [];
    return {
        ...rest,
        installCount: list.length,
        installed: workspaceId ? list.some(id => String(id) === String(workspaceId)) : false,
    };
}

module.exports = { installApp, uninstallApp, revokeAppTokens, toPublicApp, deliverAppEvent, signBody, isApproved };
