const AIProvider = require('./ai-provider.model');
const { sealSecret } = require('../../modules/conversations/cryptoUtils');

const MASK = '••••••••';

function publicView(record) {
  if (!record) return null;
  const r = typeof record.toObject === 'function' ? record.toObject() : record;
  return { ...r, apiKey: MASK, hasKey: !!r.apiKey };
}

/** Keys are sealed under SERVER_KEK before they touch the database. */
async function connectProvider({ workspaceId, provider, apiKey, config = {}, userId }) {
  const record = await AIProvider.findOneAndUpdate(
    { workspaceId, provider },
    { apiKey: sealSecret(apiKey), config, status: 'active', connectedBy: userId },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  require('../ai/ai.provider.resolver').invalidate(workspaceId);
  return record;
}

async function getProviders(workspaceId) {
  const providers = await AIProvider.find({ workspaceId }).lean();
  return providers.map(publicView);
}

async function switchProvider({ workspaceId, provider }) {
  await AIProvider.updateMany({ workspaceId }, { isDefault: false });
  const updated = await AIProvider.findOneAndUpdate(
    { workspaceId, provider },
    { isDefault: true, status: 'active' },
    { new: true }
  );
  if (!updated) {
    throw Object.assign(new Error(`Provider '${provider}' not connected for this workspace.`), { statusCode: 404 });
  }
  require('../ai/ai.provider.resolver').invalidate(workspaceId);
  return updated;
}

async function disconnectProvider({ workspaceId, provider }) {
  const updated = await AIProvider.findOneAndUpdate(
    { workspaceId, provider },
    { status: 'inactive', isDefault: false },
    { new: true }
  );
  require('../ai/ai.provider.resolver').invalidate(workspaceId);
  return updated;
}

async function getActiveProvider(workspaceId) {
  const fallbackOrder = ['gemini', 'openai', 'anthropic', 'claude', 'local_llm'];
  let provider = await AIProvider.findOne({ workspaceId, isDefault: true, status: 'active' }).lean();
  if (provider) return provider;
  for (const name of fallbackOrder) {
    provider = await AIProvider.findOne({ workspaceId, provider: name, status: 'active' }).lean();
    if (provider) return provider;
  }
  return null;
}

module.exports = { connectProvider, getProviders, switchProvider, disconnectProvider, getActiveProvider, publicView };
