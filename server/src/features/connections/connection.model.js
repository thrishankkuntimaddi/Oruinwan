'use strict';

/**
 * A person's own connection to an outside service, inside one workspace: their own Claude or
 * ChatGPT key, their own GitHub account, their own Jira login. Only that person's requests use it.
 *
 * Workspace-wide installs stay where they were (AIProvider for agents, Integration for tools), so
 * nothing that reads those can ever pick up somebody's personal key.
 *
 * `secret` (API key, OAuth access token, personal access token) is sealed under SERVER_KEK before
 * it is saved, the same way workspace keys are, and is never sent to any client.
 */

const mongoose = require('mongoose');

const PROVIDERS = ['anthropic', 'openai', 'gemini', 'xai', 'github', 'jira'];

const connectionSchema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  provider: { type: String, required: true, enum: PROVIDERS },
  kind: { type: String, enum: ['agent', 'tool'], required: true },
  // api_key: pasted and checked live; oauth: authorized at the provider; token: a pasted access token.
  method: { type: String, enum: ['api_key', 'oauth', 'token'], required: true },
  secret: { type: String, required: true },
  // Non-secret settings: { model } for agents, { baseUrl, email } for Jira.
  config: { type: mongoose.Schema.Types.Mixed, default: {} },
  // Who the provider says this is (GitHub login, Jira display name…), shown to the owner only.
  account: {
    id: { type: String, default: null },
    login: { type: String, default: null },
    name: { type: String, default: null },
    avatar: { type: String, default: null },
  },
  scopes: { type: [String], default: [] },
  lastUsedAt: { type: Date, default: null },
}, { timestamps: true, collection: 'userconnections' });

connectionSchema.index({ workspaceId: 1, userId: 1, provider: 1 }, { unique: true });

module.exports = mongoose.models.UserConnection || mongoose.model('UserConnection', connectionSchema);
module.exports.PROVIDERS = PROVIDERS;
