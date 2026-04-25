async function handleWebhook(payload, headers, integration) {
  const event = headers['x-event-key'] || '';
  const results = [];

  if (event === 'issue:created') {
    const issue = payload.issue || {};
    results.push({
      action: 'task.create',
      data: {
        title: `[Bitbucket] ${issue.title}`,
        description: issue.content?.raw || '',
        externalId: `bitbucket-issue-${issue.id}`,
        externalUrl: issue.links?.html?.href,
        source: 'bitbucket',
        status: 'todo'
      }
    });
  }

  if (event === 'repo:push') {
    const pushes = payload.push?.changes || [];
    results.push({
      action: 'activity.create',
      data: {
        type: 'push',
        commitCount: pushes.reduce((s, c) => s + (c.commits?.length || 0), 0),
        author: payload.actor?.display_name,
        source: 'bitbucket'
      }
    });
  }

  return { handled: true, event, results };
}

module.exports = { handleWebhook };
