'use strict';

/**
 * A person's own sticker library (made from a photo, uploaded, saved from a chat or from
 * GIPHY), shared by the web, desktop and phone apps. A sticker is sent as an image message
 * whose attachment has variant 'sticker' (a GIF from GIPHY: variant 'gif').
 */

const mongoose = require('mongoose');
const Sticker = require('./sticker.model');
const giphy = require('./giphy');
const { uploadObject, objectHandle } = require('../../modules/uploads/upload.service');
const { canAccessFile } = require('../../modules/uploads/upload.access');
const { objectPathOf } = require('../../modules/uploads/attachmentSanitizer');

const MAX_STICKERS = 500;
const MAX_STICKER_BYTES = 5 * 1024 * 1024;
const MAX_STICKER_LABEL = '5 MB';
const DEFAULT_PACK = 'My stickers';
const STICKER_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const EXT = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif' };

const fail = (status, message, code) => Object.assign(new Error(message), { status, code });

/** A pack name: trimmed, 1–40 characters, the default when empty. */
function cleanPack(name) {
    const p = String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
    return p || DEFAULT_PACK;
}

const dim = (v) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n > 0 && n <= 10000 ? n : null;
};

/** Is this picture animated (a GIF with frames, an animated WebP or an APNG)? */
function isAnimatedImage(buffer, mimeType) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 16) return false;
    const mt = String(mimeType || '').toLowerCase();
    if (mt === 'image/gif') {
        // More than one graphic control block means more than one frame.
        let count = 0;
        for (let i = 0; i < buffer.length - 2; i++) {
            if (buffer[i] === 0x21 && buffer[i + 1] === 0xf9 && buffer[i + 2] === 0x04 && ++count > 1) return true;
        }
        return false;
    }
    if (mt === 'image/webp') return buffer.includes('ANIM');
    if (mt === 'image/png') return buffer.includes('acTL');
    return false;
}

/** The attachment a sticker is sent as. */
function attachmentOf(s) {
    return {
        type: 'image',
        url: s.url,
        name: s.name || 'sticker',
        size: s.size || undefined,
        mimeType: s.mimeType || undefined,
        width: s.width || undefined,
        height: s.height || undefined,
        variant: 'sticker',
    };
}

function serialize(s) {
    return {
        id: String(s._id),
        url: s.url,
        name: s.name,
        mimeType: s.mimeType,
        size: s.size,
        width: s.width,
        height: s.height,
        animated: !!s.animated,
        pack: s.pack || DEFAULT_PACK,
        source: s.source,
        createdAt: s.createdAt,
        attachment: attachmentOf(s),
    };
}

async function ownerInfo(userId) {
    const user = await require('../../identity').users.findById(userId);
    return { userId, companyId: user?.companyId || undefined };
}

async function ensureRoom(userId) {
    const count = await Sticker.countDocuments({ owner: userId });
    if (count >= MAX_STICKERS) throw fail(409, `You can keep up to ${MAX_STICKERS} stickers. Remove some to add more.`, 'STICKER_LIMIT');
}

function checkFile({ mimetype, size }) {
    if (!STICKER_TYPES.has(String(mimetype || '').toLowerCase())) {
        throw fail(415, 'Stickers can be PNG, JPEG, WebP or GIF pictures', 'STICKER_TYPE');
    }
    if (size > MAX_STICKER_BYTES) throw fail(413, `Stickers can be up to ${MAX_STICKER_LABEL}`, 'STICKER_TOO_LARGE');
}

async function store(userId, { buffer, mimeType, name }) {
    const owner = await ownerInfo(userId);
    const base = String(name || 'sticker').replace(/\.[a-z0-9]+$/i, '').slice(0, 60) || 'sticker';
    return uploadObject({
        buffer,
        size: buffer.length,
        mimetype: mimeType,
        originalname: `${base}${EXT[mimeType] || ''}`,
    }, 'stickers', owner);
}

async function list(userId) {
    const rows = await Sticker.find({ owner: userId }).sort({ createdAt: -1 }).limit(MAX_STICKERS).lean();
    return rows.map(serialize);
}

/** A picture uploaded straight into the library (made from a photo, or added as is). */
async function addFile(userId, file, { pack, width, height, made = false } = {}) {
    if (!file?.buffer) throw fail(400, 'No picture provided');
    checkFile(file);
    await ensureRoom(userId);
    const mimeType = String(file.mimetype).toLowerCase();
    const stored = await store(userId, { buffer: file.buffer, mimeType, name: file.originalname });
    const row = await Sticker.create({
        owner: userId,
        url: stored.url,
        name: stored.name,
        mimeType,
        size: file.buffer.length,
        width: dim(width),
        height: dim(height),
        animated: isAnimatedImage(file.buffer, mimeType),
        pack: cleanPack(pack),
        source: made ? 'made' : 'upload',
    });
    return serialize(row);
}

async function readObject(objectPath, max) {
    const chunks = [];
    let total = 0;
    for await (const chunk of objectHandle(objectPath).createReadStream()) {
        total += chunk.length;
        if (total > max) throw fail(413, `Stickers can be up to ${MAX_STICKER_LABEL}`, 'STICKER_TOO_LARGE');
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}

/**
 * Saves a picture someone sent (a sticker, GIF or photo) to the library. A file the person
 * didn't upload is copied, so it stays theirs after they leave that conversation.
 */
async function addFromUrl(userId, { url, pack, width, height } = {}) {
    const objectPath = objectPathOf(url);
    if (!objectPath) throw fail(400, 'Only pictures shared in Oruinwan can be saved as stickers');

    const existing = await Sticker.findOne({ owner: userId, $or: [{ url }, { origin: url }] }).lean();
    if (existing) return { sticker: serialize(existing), existed: true };

    let meta;
    try {
        [meta] = await objectHandle(objectPath).getMetadata();
    } catch (err) {
        if (err && err.code === 404) throw fail(404, 'That picture is no longer available');
        throw err;
    }
    const custom = meta?.metadata || {};
    if (!(await canAccessFile(objectPath, userId, custom))) throw fail(403, 'You cannot save this picture');
    const mimeType = String(meta?.contentType || '').toLowerCase();
    checkFile({ mimetype: mimeType, size: Number(meta?.size) || 0 });
    await ensureRoom(userId);

    const buffer = await readObject(objectPath, MAX_STICKER_BYTES);
    const mine = String(custom.uploadedBy || '') === String(userId);
    const stored = mine ? { url, name: custom.originalName || 'sticker' } : await store(userId, { buffer, mimeType, name: custom.originalName });
    const row = await Sticker.create({
        owner: userId,
        url: stored.url,
        name: stored.name,
        mimeType,
        size: buffer.length,
        width: dim(width),
        height: dim(height),
        animated: isAnimatedImage(buffer, mimeType),
        pack: cleanPack(pack),
        source: 'saved',
        origin: mine ? null : url,
    });
    return { sticker: serialize(row), existed: false };
}

const validId = (id) => mongoose.isValidObjectId(String(id || ''));

async function update(userId, id, { pack } = {}) {
    if (!validId(id)) throw fail(400, 'Invalid sticker');
    const row = await Sticker.findOneAndUpdate({ _id: id, owner: userId }, { $set: { pack: cleanPack(pack) } }, { new: true }).lean();
    if (!row) throw fail(404, 'Sticker not found');
    return serialize(row);
}

/** Removes a sticker from the library. Messages that already carry it keep showing it. */
async function remove(userId, id) {
    if (!validId(id)) throw fail(400, 'Invalid sticker');
    const { deletedCount } = await Sticker.deleteOne({ _id: id, owner: userId });
    if (!deletedCount) throw fail(404, 'Sticker not found');
}

async function renamePack(userId, from, to) {
    const { modifiedCount } = await Sticker.updateMany({ owner: userId, pack: cleanPack(from) }, { $set: { pack: cleanPack(to) } });
    return modifiedCount;
}

async function removePack(userId, name) {
    const { deletedCount } = await Sticker.deleteMany({ owner: userId, pack: cleanPack(name) });
    return deletedCount;
}

/**
 * A GIF or sticker picked from GIPHY, copied to our storage so the conversation never loads
 * it from GIPHY. Returns { attachment } (and { sticker } when `save` adds it to the library).
 */
async function fromGiphy(userId, { id, kind = 'gifs', save = false, pack } = {}, opts = {}) {
    if (!giphy.enabled(opts.env)) throw fail(503, 'GIF search is not set up on this server', 'GIPHY_OFF');
    const asSticker = kind === 'stickers';
    const origin = `giphy:${id}`;
    if (save) {
        const existing = await Sticker.findOne({ owner: userId, origin }).lean();
        if (existing) return { attachment: attachmentOf(existing), sticker: serialize(existing) };
        await ensureRoom(userId);
    }
    const got = await giphy.download(id, kind, opts);
    const stored = await store(userId, { buffer: got.buffer, mimeType: got.mimeType, name: got.title || (asSticker ? 'sticker' : 'gif') });
    const base = {
        url: stored.url,
        name: stored.name,
        mimeType: got.mimeType,
        size: got.buffer.length,
        width: dim(got.width),
        height: dim(got.height),
    };
    const attachment = { type: 'image', ...base, variant: asSticker ? 'sticker' : 'gif' };
    if (!save) return { attachment };
    const row = await Sticker.create({
        owner: userId, ...base, animated: true, pack: cleanPack(pack), source: 'giphy', origin,
    });
    return { attachment, sticker: serialize(row) };
}

module.exports = {
    list, addFile, addFromUrl, update, remove, renamePack, removePack, fromGiphy,
    isAnimatedImage, cleanPack, attachmentOf, serialize,
    MAX_STICKERS, MAX_STICKER_BYTES, DEFAULT_PACK,
};
