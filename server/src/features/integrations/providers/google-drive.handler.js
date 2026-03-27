// server/src/features/integrations/providers/google-drive.handler.js
// Google Drive — attach file references (metadata only, no full sync)

async function verify(config) {
  if (!config.accessToken && !config.refreshToken) {
    throw Object.assign(new Error('Google Drive: accessToken or refreshToken required'), { statusCode: 400 });
  }
  return config;
}

/**
 * Attach a Google Drive file reference to the workspace.
 * Returns a file reference object — we never download the actual file.
 */
function attachFile({ fileId, fileName, mimeType, webViewLink }) {
  return {
    source: 'google_drive',
    externalId: fileId,
    name: fileName,
    mimeType,
    url: webViewLink,
    attachedAt: new Date().toISOString()
  };
}

async function handleWebhook(payload, headers, integration) {
  // Google Drive push notifications use X-Goog-Resource-State header
  const state = headers['x-goog-resource-state'];
  const results = [];

  if (['update', 'add'].includes(state)) {
    results.push({
      action: 'file.reference_update',
      data: { resourceId: headers['x-goog-resource-id'], state, source: 'google_drive' }
    });
  }

  return { handled: true, state, results };
}

module.exports = { verify, attachFile, handleWebhook };
