async function handleWebhook(payload, headers, integration) {
  const type = payload.type; 
  const action = payload.action; 
  const results = [];

  if (type === 'Issue') {
    const issue = payload.data || {};
    if (action === 'create') {
      results.push({
        action: 'task.create',
        data: {
          title: `[Linear] ${issue.title}`,
          description: issue.description || '',
          externalId: `linear-issue-${issue.identifier}`,
          externalUrl: issue.url,
          source: 'linear',
          status: 'todo'
        }
      });
    }
    if (action === 'update' && issue.completedAt) {
      results.push({
        action: 'task.complete',
        data: { externalId: `linear-issue-${issue.identifier}`, source: 'linear' }
      });
    }
  }

  return { handled: true, type, action, results };
}

module.exports = { handleWebhook };
