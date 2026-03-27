// server/src/features/integrations/providers/cicd.handler.js
// Generic CI/CD pipeline webhook handler (GitHub Actions, Jenkins, CircleCI, etc.)
async function handleWebhook(payload, headers, integration) {
  const results = [];
  const status = payload.status || payload.state || payload.conclusion || 'unknown';
  const name = payload.name || payload.pipeline?.name || payload.workflow?.name || 'CI/CD Pipeline';
  const url = payload.html_url || payload.url || payload.build_url;

  results.push({
    action: 'activity.create',
    data: {
      type: 'cicd',
      name,
      status,
      url,
      source: 'cicd',
      branch: payload.ref || payload.branch
    }
  });

  return { handled: true, results };
}

module.exports = { handleWebhook };
