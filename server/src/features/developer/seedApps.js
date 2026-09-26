const logger = require('../../../utils/logger');
const App = require('./app.model');

const DEMO_APPS = [
  {
    name: 'GitHub Connector',
    description: 'Sync GitHub issues and pull requests directly into Oruinwan tasks.',
    category: 'developer',
    developer: 'Oruinwan',
    version: '1.2.0',
    config: { supports: ['issues', 'pull_requests', 'commits'] }
  },
  {
    name: 'Jira Bridge',
    description: 'Two-way sync between Oruinwan tasks and Jira tickets.',
    category: 'productivity',
    developer: 'Oruinwan',
    version: '1.0.0',
    config: { supports: ['tasks', 'epics', 'sprints'] }
  },
  {
    name: 'Slack Mirror',
    description: 'Mirror messages between Oruinwan channels and Slack workspaces.',
    category: 'communication',
    developer: 'Oruinwan',
    version: '1.1.0',
    config: { supports: ['messages', 'files'] }
  },
  {
    name: 'Analytics Dashboard Pro',
    description: 'Advanced analytics with custom reports and export to CSV/PDF.',
    category: 'analytics',
    developer: 'Oruinwan',
    version: '2.0.0',
    config: { supports: ['tasks', 'messages', 'meetings'] }
  },
  {
    name: 'Zapier Integration',
    description: 'Connect Oruinwan to 5,000+ apps via Zapier automation workflows.',
    category: 'automation',
    developer: 'Zapier',
    version: '1.0.0',
    config: { supportsWebhooks: true }
  },
  {
    name: 'Google Calendar Sync',
    description: 'Sync Oruinwan meetings with Google Calendar automatically.',
    category: 'productivity',
    developer: 'Oruinwan',
    version: '1.3.0',
    config: { supports: ['meetings', 'scheduled_meetings'] }
  }
];

async function seedApps() {
  try {
    for (const appData of DEMO_APPS) {
      await App.findOneAndUpdate(
        { name: appData.name },
        { $setOnInsert: appData },
        { upsert: true, new: true }
      );
    }
    logger.info('✅ [Developer] Marketplace apps seeded');
  } catch (err) {
    logger.error('❌ [Developer] App seed error:', err.message);
  }
}

module.exports = { seedApps };
