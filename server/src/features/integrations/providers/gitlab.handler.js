// server/src/features/integrations/providers/gitlab.handler.js
// GitLab integration — lightweight webhook handler
async function handleWebhook(payload, headers, integration) {
  const event = headers['x-gitlab-event'] || '';
  const results = [];

  if (event === 'Issue Hook') {
    const attrs = payload.object_attributes || {};
    if (attrs.action === 'open') {
      results.push({
        action: 'task.create',
        data: {
          title: `[GitLab] ${attrs.title}`,
          description: attrs.description || '',
          externalId: `gitlab-issue-${attrs.iid}`,
          externalUrl: attrs.url,
          source: 'gitlab',
          status: 'todo'
        }
      });
    }
    if (attrs.action === 'close') {
      results.push({ action: 'task.complete', data: { externalId: `gitlab-issue-${attrs.iid}`, source: 'gitlab' } });
    }
  }

  if (event === 'Push Hook') {
    results.push({
      action: 'activity.create',
      data: {
        type: 'push',
        ref: payload.ref,
        commitCount: payload.total_commits_count,
        committer: payload.user_name,
        lastCommitMessage: payload.commits?.[0]?.message,
        source: 'gitlab'
      }
    });
  }

  if (event === 'Merge Request Hook') {
    const mr = payload.object_attributes || {};
    results.push({
      action: 'activity.create',
      data: { type: 'merge_request', title: mr.title, url: mr.url, state: mr.state, source: 'gitlab' }
    });
  }

  return { handled: true, event, results };
}

module.exports = { handleWebhook };
