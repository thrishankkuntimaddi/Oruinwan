// server/src/features/integrations/providers/linear.handler.js
async function handleWebhook(payload, headers, integration) {
  const type = payload.type; // 'Issue', 'Project', 'Cycle'
  const action = payload.action; // 'create', 'update', 'remove'
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
