// server/models/IssueKeyCounter.js
/**
 * IssueKeyCounter — atomic counter for workspace issue keys
 *
 * Generates Jira-style keys like CHT-1, CHT-2, PROJ-42.
 * One document per workspace. Uses findOneAndUpdate + $inc for
 * atomic increment (safe under concurrent creates).
 */
const mongoose = require('mongoose');

const IssueKeyCounterSchema = new mongoose.Schema({
    workspace: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Workspace',
        required: true,
        unique: true
    },
    // Short uppercase prefix derived from workspace name, e.g. "CHT"
    prefix: { type: String, required: true, uppercase: true },
    // Current sequence — incremented atomically on each issue create
    seq: { type: Number, default: 0 }
}, { timestamps: false });

/**
 * Get next issue key for a workspace.
 * Creates counter document if it doesn't exist yet.
 *
 * @param {ObjectId|string} workspaceId
 * @param {string} workspaceName — used to derive prefix on first call
 * @returns {Promise<string>} e.g. "CHT-7"
 */
IssueKeyCounterSchema.statics.nextKey = async function (workspaceId, workspaceName) {
    // Derive prefix: first 3-4 uppercase letters of workspace name
    const prefix = (workspaceName || 'TSK')
        .replace(/[^A-Za-z]/g, '')
        .slice(0, 4)
        .toUpperCase() || 'TSK';

    const counter = await this.findOneAndUpdate(
        { workspace: workspaceId },
        { $inc: { seq: 1 }, $setOnInsert: { prefix } },
        { new: true, upsert: true }
    );

    return `${counter.prefix}-${counter.seq}`;
};

module.exports = mongoose.model('IssueKeyCounter', IssueKeyCounterSchema);
