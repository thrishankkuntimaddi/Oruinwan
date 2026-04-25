const AIProvider = require('./ai-provider.model');

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

async function getProviders(workspaceId) {
  const providers = await AIProvider.find({ workspaceId }).lean();
  return providers.map(p => ({ ...p, apiKey: '••••••••' }));
}

async function switchProvider({ workspaceId, provider }) {
  
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

async function disconnectProvider({ workspaceId, provider }) {
  return AIProvider.findOneAndUpdate(
    { workspaceId, provider },
    { status: 'inactive', isDefault: false },
    { new: true }
  );
}

async function getActiveProvider(workspaceId) {
  const fallbackOrder = ['gemini', 'openai', 'claude', 'local_llm'];

  
  let provider = await AIProvider.findOne({
    workspaceId,
    isDefault: true,
    status: 'active'
  }).lean();

  if (provider) return provider;

  
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
