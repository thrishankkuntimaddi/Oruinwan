'use strict';

/**
 * A workspace's profile: logo and cover images, tagline, website and location (with its name,
 * description, icon and colour). Owners and admins edit it; everyone in the workspace (and an
 * invitation page) sees it. Images live under workspace-profiles/ in object storage, readable by
 * link like profile pictures (upload.access.js SHARED_PREFIXES).
 */

const express = require('express');
const multer = require('multer');
const identity = require('../../identity');
const logger = require('../../shared/utils/logger');

const IMAGE_KINDS = { logo: 'logo', cover: 'cover' };
const TEXT_FIELDS = { tagline: 120, website: 200, location: 80 };

/** What the apps get: no storage paths. */
function publicProfile(ws) {
  const p = (ws && ws.profile) || {};
  return {
    logoUrl: p.logoUrl || null,
    coverUrl: p.coverUrl || null,
    tagline: p.tagline || '',
    website: p.website || '',
    location: p.location || '',
  };
}

/**
 * The text part of a profile update ({ tagline, website, location }) → { patch } or { error }.
 * Empty strings clear a field; a website must be an http(s) address.
 */
function profileTextPatch(input) {
  if (input === undefined) return { patch: null };
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'profile must be an object' };
  const patch = {};
  for (const [key, max] of Object.entries(TEXT_FIELDS)) {
    if (input[key] === undefined) continue;
    if (input[key] !== null && typeof input[key] !== 'string') return { error: `profile.${key} must be text` };
    let value = String(input[key] || '').trim();
    if (value.length > max) return { error: `profile.${key} can be at most ${max} characters` };
    if (key === 'website' && value) {
      if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
      try {
        const u = new URL(value);
        if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) throw new Error('bad');
        value = u.toString();
      } catch {
        return { error: 'profile.website must be a web address' };
      }
    }
    patch[key] = value;
  }
  return { patch };
}

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // No SVG: it can carry script and these images are readable by link.
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)) {
      return cb(Object.assign(new Error('Use a JPG, PNG, WebP or GIF image'), { status: 400 }), false);
    }
    return cb(null, true);
  },
});

function emitUpdated(req, ws) {
  const io = req.app?.get?.('io');
  if (!io) return;
  const payload = { workspaceId: String(ws._id), profile: publicProfile(ws) };
  io.to(`workspace:${ws._id}`).to(`workspace_${ws._id}`).emit('workspace-updated', payload);
}

/** POST/DELETE /:workspaceId/profile/:kind (kind: logo | cover), behind the admin gate. */
function profileImageRouter(gate) {
  const router = express.Router({ mergeParams: true });
  const { uploadObject, deleteObject } = require('../../modules/uploads/upload.service');

  const load = async (req, res) => {
    const kind = IMAGE_KINDS[req.params.kind];
    if (!kind) {
      res.status(404).json({ message: 'Unknown image' });
      return null;
    }
    const ws = req.workspace || (await identity.workspaces.findById(req.params.workspaceId));
    if (!ws) {
      res.status(404).json({ message: 'Workspace not found' });
      return null;
    }
    return { kind, ws };
  };
  const removeOld = async (ws, kind) => {
    const old = ws.profile?.[`${kind}Path`];
    if (old) await deleteObject(old).catch((err) => logger.warn({ err: err.message }, '[Workspace] old profile image not removed'));
  };

  router.post('/:workspaceId/profile/:kind', ...gate, (req, res, next) => imageUpload.single('image')(req, res, (err) => {
    if (err) return res.status(err.status || 400).json({ message: err.code === 'LIMIT_FILE_SIZE' ? 'Images can be at most 5 MB' : err.message });
    return next();
  }), async (req, res) => {
    try {
      const found = await load(req, res);
      if (!found) return undefined;
      if (!req.file) return res.status(400).json({ message: 'Choose an image' });
      const { kind, ws } = found;
      const stored = await uploadObject(req.file, 'workspace-profiles', { userId: req.user.sub });
      await removeOld(ws, kind);
      const next = await identity.workspaces.update(ws._id, { profile: { $merge: true, [`${kind}Url`]: stored.url, [`${kind}Path`]: stored.gcsPath } });
      emitUpdated(req, next);
      return res.json({ profile: publicProfile(next) });
    } catch (err) {
      logger.error({ err: err.message }, '[Workspace] profile image upload failed');
      return res.status(500).json({ message: 'Upload failed' });
    }
  });

  router.delete('/:workspaceId/profile/:kind', ...gate, async (req, res) => {
    try {
      const found = await load(req, res);
      if (!found) return undefined;
      const { kind, ws } = found;
      await removeOld(ws, kind);
      const next = await identity.workspaces.update(ws._id, { profile: { $merge: true, [`${kind}Url`]: null, [`${kind}Path`]: null } });
      emitUpdated(req, next);
      return res.json({ profile: publicProfile(next) });
    } catch (err) {
      logger.error({ err: err.message }, '[Workspace] profile image removal failed');
      return res.status(500).json({ message: 'Could not remove the image' });
    }
  });
  return router;
}

module.exports = { publicProfile, profileTextPatch, profileImageRouter, emitUpdated };
