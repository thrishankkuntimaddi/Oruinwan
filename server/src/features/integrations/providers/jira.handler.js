// server/src/features/integrations/providers/jira.handler.js
async function handleWebhook(payload, headers, integration) {
  const webhookEvent = payload.webhookEvent || '';
  const results = [];

  const issue = payload.issue || {};
  const fields = issue.fields || {};

  if (webhookEvent === 'jira:issue_created') {
    results.push({
      action: 'task.create',
      data: {
        title: `[Jira] ${fields.summary}`,
        description: fields.description?.content?.[0]?.content?.[0]?.text || '',
        externalId: `jira-issue-${issue.key}`,
        externalUrl: `${integration?.config?.baseUrl}/browse/${issue.key}`,
        source: 'jira',
        status: 'todo'
      }
    });
  }

  if (webhookEvent === 'jira:issue_updated' && fields.status?.name === 'Done') {
    results.push({
      action: 'task.complete',
      data: { externalId: `jira-issue-${issue.key}`, source: 'jira' }
    });
  }

  return { handled: true, webhookEvent, results };
}

module.exports = { handleWebhook };
