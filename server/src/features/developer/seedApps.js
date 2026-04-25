const App = require('./app.model');

const DEMO_APPS = [
  {
    name: 'GitHub Connector',
    description: 'Sync GitHub issues and pull requests directly into Chttrix tasks.',
    category: 'developer',
    developer: 'Chttrix',
    version: '1.2.0',
    config: { supports: ['issues', 'pull_requests', 'commits'] }
  },
  {
    name: 'Jira Bridge',
    description: 'Two-way sync between Chttrix tasks and Jira tickets.',
    category: 'productivity',
    developer: 'Chttrix',
    version: '1.0.0',
    config: { supports: ['tasks', 'epics', 'sprints'] }
  },
  {
    name: 'Slack Mirror',
    description: 'Mirror messages between Chttrix channels and Slack workspaces.',
    category: 'communication',
    developer: 'Chttrix',
    version: '1.1.0',
    config: { supports: ['messages', 'files'] }
  },
  {
    name: 'Analytics Dashboard Pro',
    description: 'Advanced analytics with custom reports and export to CSV/PDF.',
    category: 'analytics',
    developer: 'Chttrix',
    version: '2.0.0',
    config: { supports: ['tasks', 'messages', 'meetings'] }
  },
  {
    name: 'Zapier Integration',
    description: 'Connect Chttrix to 5,000+ apps via Zapier automation workflows.',
    category: 'automation',
    developer: 'Zapier',
    version: '1.0.0',
    config: { supportsWebhooks: true }
  },
  {
    name: 'Google Calendar Sync',
    description: 'Sync Chttrix meetings with Google Calendar automatically.',
    category: 'productivity',
    developer: 'Chttrix',
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
    console.log('✅ [Developer] Marketplace apps seeded');
  } catch (err) {
    console.error('❌ [Developer] App seed error:', err.message);
  }
}

module.exports = { seedApps };
