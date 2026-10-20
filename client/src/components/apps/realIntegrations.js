import { GitPullRequest, TicketCheck, Video, Webhook } from 'lucide-react';

/**
 * The integrations Oruinwan really ships (server/src/features/integrations, docs/integrations.md).
 * `type` matches the Integration record type returned by GET /api/v2/integrations; webhooks are
 * workspace-level outgoing webhooks (GET /api/v2/integrations/webhooks).
 * Setup for all of them lives in Settings → Integrations.
 */
export const REAL_INTEGRATIONS = [
  {
    id: 'github',
    type: 'github',
    name: 'GitHub',
    Icon: GitPullRequest,
    summary: 'Pull requests, pushes, checks and issues as cards in your channels.',
    description: 'Pull requests, pushes, checks and issues arrive as cards in the channels you choose. Task keys in a PR link it to Oruinwan tasks, and Oruinwan AI can review the diff.',
    useCases: [
      'One card per pull request, updated as reviews and checks come in',
      'Linked tasks move to review and done as the PR progresses',
      'Create GitHub issues from chat with /github',
      'Optional AI review when a PR is opened',
    ],
    needs: [
      'A GitHub personal access token for the repositories you route',
      'A webhook on the repo or organisation (Oruinwan gives you the URL and secret)',
    ],
    docs: '/docs/integrations/github',
  },
  {
    id: 'jira',
    type: 'jira',
    name: 'Jira',
    Icon: TicketCheck,
    summary: 'Jira Cloud issues sync with tasks, both ways.',
    description: 'New Jira issues can create linked tasks in a channel, and status changes keep both sides in step. Create Jira issues from chat with /jira.',
    useCases: [
      'New issues in a routed project create a linked task',
      'To do, In progress and Done stay in sync with the task',
      'Create Jira issues from a conversation with /jira',
    ],
    needs: [
      'Your Jira Cloud address, account email and an API token',
      'A Jira webhook for issue created, updated and deleted events',
    ],
    docs: '/docs/integrations/jira-zoom',
  },
  {
    id: 'zoom',
    type: 'zoom',
    name: 'Zoom',
    Icon: Video,
    summary: 'Start or schedule Zoom meetings from chat.',
    description: 'Type /zoom in any conversation to create an instant or scheduled Zoom meeting and share the join link.',
    useCases: [
      'Instant meetings with /zoom',
      'Scheduled meetings with a start time and length',
    ],
    needs: [
      'A Zoom Server-to-Server OAuth app (account ID, client ID and client secret)',
      'The meeting:write scope on that app',
    ],
    docs: '/docs/integrations/jira-zoom',
  },
  {
    id: 'webhooks',
    type: 'webhook',
    name: 'Webhooks',
    Icon: Webhook,
    summary: 'Send workspace events to any service that accepts a webhook.',
    description: 'Oruinwan posts a signed JSON request to your URL when tasks change, messages are sent or integrations connect. Use it with Zapier, Make, n8n or your own service.',
    useCases: [
      'Task created, updated or completed',
      'Messages in public channels (ids and metadata only)',
      'Integrations connected or disconnected',
    ],
    needs: [
      'An https address that accepts POST requests',
    ],
    docs: '/docs/integrations/webhooks',
    alwaysAvailable: true,
  },
];

/** Services with a basic (generic webhook / token) connection in Settings → Integrations. */
export const BASIC_CONNECTIONS = ['GitLab', 'Bitbucket', 'Linear', 'Notion', 'Google Drive', 'Slack', 'Microsoft Teams', 'Zapier', 'Make', 'n8n'];

/**
 * Marketplace listings the server seeds as examples (server/src/features/developer/seedApps.js).
 * Installing one records the install but doesn't connect anything, so the UI labels them "Sample".
 */
export const SAMPLE_APP_NAMES = new Set([
  'GitHub Connector', 'Jira Bridge', 'Slack Mirror', 'Analytics Dashboard Pro', 'Zapier Integration', 'Google Calendar Sync',
]);
