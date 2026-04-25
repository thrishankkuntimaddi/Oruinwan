const Integration = require('./integration.model');
const Webhook = require('./webhook.model');
const webhookTrigger = require('./webhook.trigger');

const githubHandler = require('./providers/github.handler');
const gitlabHandler = require('./providers/gitlab.handler');
const bitbucketHandler = require('./providers/bitbucket.handler');
const linearHandler = require('./providers/linear.handler');
const jiraHandler = require('./providers/jira.handler');
const cicdHandler = require('./providers/cicd.handler');
const googleDriveHandler = require('./providers/google-drive.handler');
const onedriveHandler = require('./providers/onedrive.handler');
const dropboxHandler = require('./providers/dropbox.handler');
const notionHandler = require('./providers/notion.handler');
const confluenceHandler = require('./providers/confluence.handler');
const slackHandler = require('./providers/slack.handler');
const zoomHandler = require('./providers/zoom.handler');
const googleMeetHandler = require('./providers/google-meet.handler');
const teamsHandler = require('./providers/teams.handler');
const zapierHandler = require('./providers/zapier.handler');

const HANDLERS = {
  github: githubHandler,
  gitlab: gitlabHandler,
  bitbucket: bitbucketHandler,
  linear: linearHandler,
  jira: jiraHandler,
  cicd: cicdHandler,
  google_drive: googleDriveHandler,
  onedrive: onedriveHandler,
  dropbox: dropboxHandler,
  notion: notionHandler,
  confluence: confluenceHandler,
  slack: slackHandler,
  zoom: zoomHandler,
  google_meet: googleMeetHandler,
  teams: teamsHandler,
  zapier: zapierHandler,
  make: zapierHandler, 
  n8n: zapierHandler,
  webhook: zapierHandler
};

async function connectIntegration({ workspaceId, type, config, label, userId }) {
  const handler = HANDLERS[type];

  
  let verifiedConfig = config;
  if (handler && typeof handler.verify === 'function') {
    verifiedConfig = await handler.verify(config);
  }

  const integration = await Integration.findOneAndUpdate(
    { workspaceId, type },
    {
      config: verifiedConfig,
      status: 'connected',
      label: label || type,
      connectedBy: userId,
      lastEventAt: new Date()
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  
  await webhookTrigger.fire(workspaceId, 'integration.connected', {
    type,
    integrationId: integration._id
  });

  return integration;
}

async function disconnectIntegration({ workspaceId, type }) {
  const integration = await Integration.findOneAndUpdate(
    { workspaceId, type },
    { status: 'disconnected', config: {}, lastEventAt: new Date() },
    { new: true }
  );

  if (!integration) {
    throw Object.assign(new Error('Integration not found'), { statusCode: 404 });
  }

  await webhookTrigger.fire(workspaceId, 'integration.disconnected', { type });

  return integration;
}

async function getIntegrations(workspaceId) {
  return Integration.find({ workspaceId })
    .select('-config') 
    .lean();
}

async function handleWebhook({ type, payload, headers, workspaceId }) {
  const handler = HANDLERS[type];
  if (!handler || typeof handler.handleWebhook !== 'function') {
    throw Object.assign(new Error(`No webhook handler for type: ${type}`), { statusCode: 400 });
  }

  
  const integration = workspaceId
    ? await Integration.findOne({ workspaceId, type }).lean()
    : null;

  return handler.handleWebhook(payload, headers, integration);
}

async function triggerIntegrationEvent(workspaceId, event, data) {
  return webhookTrigger.fire(workspaceId, event, data);
}

module.exports = {
  connectIntegration,
  disconnectIntegration,
  getIntegrations,
  handleWebhook,
  triggerIntegrationEvent
};
