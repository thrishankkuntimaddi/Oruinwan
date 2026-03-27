// server/src/features/integrations/ai-provider.service.js
// AI Provider framework — connect, switch, fallback between AI providers
const AIProvider = require('./ai-provider.model');

/**
 * Connect (add/update) an AI provider for a workspace.
 */
async function connectProvider({ workspaceId, provider, apiKey, config = {}, userId }) {
  const record = await AIProvider.findOneAndUpdate(
    { workspaceId, provider },
    {
      apiKey,
      config,
      status: 'active',
      connectedBy: userId
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return record;
}

/**
 * Get all AI providers for a workspace (masks apiKey).
 */
async function getProviders(workspaceId) {
  const providers = await AIProvider.find({ workspaceId }).lean();
  return providers.map(p => ({ ...p, apiKey: '••••••••' }));
}

/**
 * Switch the default AI provider for a workspace.
 */
async function switchProvider({ workspaceId, provider }) {
  // Unset all defaults for this workspace
  await AIProvider.updateMany({ workspaceId }, { isDefault: false });

  const updated = await AIProvider.findOneAndUpdate(
    { workspaceId, provider },
    { isDefault: true, status: 'active' },
    { new: true }
  );

  if (!updated) {
    throw Object.assign(
      new Error(`Provider '${provider}' not connected for this workspace.`),
      { statusCode: 404 }
    );
  }

  return updated;
}

/**
 * Disconnect an AI provider.
 */
async function disconnectProvider({ workspaceId, provider }) {
  return AIProvider.findOneAndUpdate(
    { workspaceId, provider },
    { status: 'inactive', isDefault: false },
    { new: true }
  );
}

/**
 * Get the active default provider config for the workspace.
 * Falls back through the provider chain: gemini → openai → claude → local_llm
 */
async function getActiveProvider(workspaceId) {
  const fallbackOrder = ['gemini', 'openai', 'claude', 'local_llm'];

  // Try default first
  let provider = await AIProvider.findOne({
    workspaceId,
    isDefault: true,
    status: 'active'
  }).lean();

  if (provider) return provider;

  // Fallback chain
  for (const name of fallbackOrder) {
    provider = await AIProvider.findOne({
      workspaceId,
      provider: name,
      status: 'active'
    }).lean();
    if (provider) return provider;
  }

  return null;
}

module.exports = {
  connectProvider,
  getProviders,
  switchProvider,
  disconnectProvider,
  getActiveProvider
};
