'use strict';

/**
 * Token-based connectors (everything except GitHub, Jira and Zoom, which have
 * their own modules). See common.js for the connector contract.
 */

const gitlab = require('./gitlab');
const bitbucket = require('./bitbucket');
const linear = require('./linear');
const cicd = require('./cicd');
const slack = require('./slack');
const teams = require('./teams');
const meet = require('./meet');
const { googleDrive, onedrive, dropbox } = require('./files');
const { notion, confluence } = require('./pages');
const { zapier, make, n8n } = require('./automation');

const CONNECTORS = Object.freeze({
  gitlab, bitbucket, linear, cicd,
  slack, teams, google_meet: meet,
  google_drive: googleDrive, onedrive, dropbox,
  notion, confluence,
  zapier, make, n8n,
});

const isConnectorType = (type) => Object.prototype.hasOwnProperty.call(CONNECTORS, type);
const getConnector = (type) => (isConnectorType(type) ? CONNECTORS[type] : null);

/** What the settings UI needs to render a connector (no functions, no secrets). */
function describe(c) {
  return {
    type: c.type,
    label: c.label,
    category: c.category,
    description: c.description,
    setup: c.setup,
    form: c.form.map(f => ({ ...f, secret: f.kind === 'secret' || !!f.secret || c.secrets.includes(f.key) })),
    toggles: c.toggles || [],
    routes: c.routes ? { label: c.routes.label, placeholder: c.routes.placeholder, hint: c.routes.hint, events: c.routes.events || null, wildcard: !c.routes.noWildcard } : null,
    defaultChannel: !!c.defaultChannel,
    bridge: c.bridge ? { remoteLabel: c.bridge.remoteLabel, remotePlaceholder: c.bridge.remotePlaceholder, remoteRequired: !!c.bridge.remoteRequired } : null,
    webhook: c.webhook ? { how: c.webhook.how, tokenInUrl: !!c.webhook.tokenInUrl, generatedSecret: (c.generated || []).length > 0 } : null,
    actions: Object.fromEntries(Object.entries(c.actions || {}).map(([name, a]) => [name, { method: a.method, admin: !!a.admin, linksTask: !!a.linksTask, importsPage: !!a.importsPage }])),
    canAttach: !!c.actions?.item,
  };
}

module.exports = { CONNECTORS, isConnectorType, getConnector, describe };
