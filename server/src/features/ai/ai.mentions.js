'use strict';

/**
 * People @mentioned in an AI chat ("tell @muzamil the build is green").
 *
 * The client sends structured mentions ({ id, name }) and, for its own direct
 * messages with that person, the recent messages it decrypted itself
 * (`transcript`). Messages stay end-to-end encrypted: the server never opens
 * them; it only checks who the people are.
 *
 * Here every mention is resolved against the workspace: only active members,
 * never the requester, with their real name and username from the directory
 * (the client's name is ignored), whether the requester already has a 1:1 DM
 * with them, and whether either side blocked the other. A transcript is kept
 * only when the requester really has a DM with that person and the caller
 * allows it (the private assistant chat or a private chat with an agent, never
 * a shared conversation where everyone reads the answer).
 */

const mongoose = require('mongoose');
const logger = require('../../../utils/logger');

const MAX_MENTIONS = 5;
const MAX_TRANSCRIPT = 150;
const MAX_TEXT = 1000;

const isId = (v) => typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v);
const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');

function cleanTranscript(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(-MAX_TRANSCRIPT)
    .filter((m) => m && typeof m === 'object' && typeof m.text === 'string' && m.text.trim())
    .map((m) => ({
      from: str(m.from || m.sender, 80) || (m.isMe ? 'You' : 'Them'),
      isMe: !!m.isMe,
      text: m.text.slice(0, MAX_TEXT),
      at: str(m.at, 40) || null,
    }));
}

/** Client input → [{ id, transcript }], deduplicated, at most MAX_MENTIONS. */
function cleanMentions(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const m of raw) {
    const id = m && typeof m === 'object' ? String(m.id || m._id || m.userId || '') : '';
    if (!isId(id) || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, transcript: cleanTranscript(m.transcript) });
    if (out.length >= MAX_MENTIONS) break;
  }
  return out;
}

const displayName = (u) => (u && (u.name || u.displayName || [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username)) || 'Someone';

/**
 * @param {Array} raw  mentions from the request body
 * @param {{ userId: string, workspaceId: string, allowTranscripts?: boolean }} opts
 * @returns {Promise<Array<{ id, name, username, hasDirectMessage, blocked, transcript? }>>}
 */
async function resolveMentions(raw, { userId, workspaceId, allowTranscripts = true } = {}) {
  const wanted = cleanMentions(raw).filter((m) => m.id !== String(userId));
  if (!wanted.length || !workspaceId || !userId) return [];
  try {
    const identity = require('../../identity');
    const ws = await identity.workspaces.findById(workspaceId);
    const active = new Set((ws?.members || []).filter((m) => m.status !== 'removed').map((m) => String(m.user?._id || m.user)));
    if (!active.has(String(userId))) return [];
    const members = wanted.filter((m) => active.has(m.id));
    if (!members.length) return [];

    const users = await identity.users.findManyByIds(members.map((m) => m.id));
    const DMSession = require('../../../models/DMSession');
    const me = new mongoose.Types.ObjectId(String(userId));
    const dms = await DMSession.find({
      workspace: workspaceId,
      isGroup: { $ne: true },
      participants: { $all: [me], $size: 2 },
    }).select('participants blockedBy').lean();
    const dmWith = new Map();
    for (const dm of dms) {
      const other = (dm.participants || []).map(String).find((p) => p !== String(userId));
      if (other) dmWith.set(other, dm);
    }

    return members.map((m) => {
      const u = users.get(m.id) || users.get(String(m.id));
      const dm = dmWith.get(m.id) || null;
      const blocks = dm?.blockedBy || [];
      const blocked = blocks.some((b) => String(b.user) === String(userId)) ? 'you'
        : blocks.length ? 'them' : null;
      const out = {
        id: m.id,
        name: displayName(u),
        username: u?.username || null,
        hasDirectMessage: !!dm,
        blocked,
      };
      if (allowTranscripts && dm && m.transcript.length) out.transcript = m.transcript;
      return out;
    });
  } catch (err) {
    logger.warn({ err: err.message }, '[AI] could not resolve mentions');
    return [];
  }
}

module.exports = { resolveMentions, cleanMentions, cleanTranscript, MAX_MENTIONS, MAX_TRANSCRIPT };
