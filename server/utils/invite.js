// server/utils/invite.js
const crypto = require("crypto");
const sha256 = (v) => crypto.createHash("sha256").update(v).digest("hex");
const Invite = require("../models/Invite");

/**
 * createInvite - creates an invite entry and returns rawToken
 * @param {Object} options - { email, companyId, workspaceId, role, invitedBy, daysValid }
 * @returns { rawToken, inviteDoc }
 */
async function createInvite({ email, companyId, workspaceId = null, role = "member", invitedBy = null, daysValid = 7 }) {
  const raw = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256(raw);
  const expiresAt = new Date(Date.now() + daysValid * 24 * 60 * 60 * 1000);

  const invite = await Invite.create({
    email,
    tokenHash,
    company: companyId,
    workspace: workspaceId,
    role,
    invitedBy,
    expiresAt
  });

  return { rawToken: raw, invite };
}

/**
 * verifyInvite - verifies a raw token and returns invite doc if valid
 * @param {string} rawToken
 * @returns inviteDoc or null
 */
async function verifyInvite(rawToken) {
  if (!rawToken) return null;
  const tokenHash = sha256(rawToken);
  const invite = await Invite.findOne({ tokenHash });
  if (!invite) return null;
  if (invite.used) return null;
  if (invite.expiresAt < new Date()) return null;
  return invite;
}

module.exports = { createInvite, verifyInvite, sha256 };
