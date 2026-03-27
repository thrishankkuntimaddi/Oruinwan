// server/src/features/integrations/providers/github.handler.js
// GitHub integration — handles webhooks for push, issues, pull_request events
const axios = require('axios');

/**
 * Verify the GitHub config by hitting the /user or /rate_limit endpoint.
 * Returns the config if valid.
 */
async function verify(config) {
  if (!config.token) throw Object.assign(new Error('GitHub: token is required'), { statusCode: 400 });

  try {
    const resp = await axios.get('https://api.github.com/rate_limit', {
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Chttrix-Integration'
      },
      timeout: 8000
    });
    return { ...config, rateLimit: resp.data.resources?.core };
  } catch (err) {
    throw Object.assign(
      new Error(`GitHub token validation failed: ${err.response?.data?.message || err.message}`),
      { statusCode: 400 }
    );
  }
}

/**
 * Handle incoming GitHub webhook events.
 * Maps GitHub events → Chttrix internal actions (task creation, activity feed).
 */
async function handleWebhook(payload, headers, integration) {
  const event = headers['x-github-event'];
  const results = [];

  if (event === 'issues') {
    const action = payload.action; // opened, edited, closed, reopened
    const issue = payload.issue;

    if (['opened', 'reopened'].includes(action)) {
      // Create a task from the GitHub issue
      results.push({
        action: 'task.create',
        data: {
          title: `[GitHub] ${issue.title}`,
          description: issue.body || '',
          externalId: `github-issue-${issue.number}`,
          externalUrl: issue.html_url,
          source: 'github',
          status: 'todo'
        }
      });
    }

    if (action === 'closed') {
      results.push({
        action: 'task.complete',
        data: {
          externalId: `github-issue-${issue.number}`,
          source: 'github'
        }
      });
    }
  }

  if (event === 'pull_request') {
    const pr = payload.pull_request;
    results.push({
      action: 'activity.create',
      data: {
        type: 'pull_request',
        title: pr.title,
        url: pr.html_url,
        state: pr.state,
        author: pr.user?.login,
        source: 'github'
      }
    });
  }

  if (event === 'push') {
    const commits = payload.commits || [];
    results.push({
      action: 'activity.create',
      data: {
        type: 'push',
        ref: payload.ref,
        commitCount: commits.length,
        committer: payload.pusher?.name,
        lastCommitMessage: commits[0]?.message,
        source: 'github'
      }
    });
  }

  return { handled: true, event, results };
}

module.exports = { verify, handleWebhook };
