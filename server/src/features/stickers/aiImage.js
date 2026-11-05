'use strict';

/**
 * Fun AI pictures for stickers: "turn me into a cat". The photo and a style go to Google Gemini's
 * image model, which sends back an edited picture; the app then cuts it out and styles it like
 * any sticker. Nothing is stored here: the picture only becomes a sticker if the person saves it.
 *
 * Settings (server/.env). Off by default: image models need billing on the Google project.
 *   AI_IMAGES_ENABLED=1        switch it on (the AI button in the sticker sheet appears)
 *   GEMINI_API_KEY             the same key as Gemini chat (ai/config.js); needed too
 *   GEMINI_IMAGE_MODEL         default gemini-3.1-flash-image (about $0.03–0.07 a picture)
 *   AI_IMAGES_FREE_DAILY       pictures per person per day on Free (default 3)
 *   AI_IMAGES_PRO_DAILY        on Pro (default 20); Enterprise and company accounts: no cap
 */

const counters = require('../../shared/plans/planCounters');
const plans = require('../../shared/plans/plans');

const API = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-3.1-flash-image';
const MAX_INPUT_BYTES = 8 * 1024 * 1024;
const PROMPT_MAX = 200;

/** Ready-made looks; `custom` uses the person's own words. */
const STYLES = {
    cat: 'a cute cartoon cat',
    dog: 'a friendly cartoon dog',
    lion: 'a majestic cartoon lion',
    panda: 'a cuddly cartoon panda',
    monkey: 'a cheeky cartoon monkey',
    bunny: 'a fluffy cartoon bunny',
    fox: 'a clever cartoon fox',
    owl: 'a wise cartoon owl',
};

const clean = (v) => (typeof v === 'string' ? v.trim() : '');

function enabled(env = process.env) {
    const on = ['1', 'true', 'yes'].includes(clean(env.AI_IMAGES_ENABLED).toLowerCase());
    return on && Boolean(clean(env.GEMINI_API_KEY) || clean(env.GOOGLE_AI_KEY));
}

function dailyLimit(plan, env = process.env) {
    if (plans.isUnlimitedServer(env) || plan === 'enterprise' || plan === 'company') return null;
    const n = (v, d) => (Number.isFinite(Number(v)) && String(v).trim() !== '' ? Math.max(0, Number(v)) : d);
    return plan === 'pro' ? n(env.AI_IMAGES_PRO_DAILY, 20) : n(env.AI_IMAGES_FREE_DAILY, 3);
}

/** The instruction for a style (or the person's own description). */
function promptFor(style, custom) {
    const own = clean(custom).replace(/\s+/g, ' ').slice(0, PROMPT_MAX);
    const look = style === 'custom' ? own : STYLES[style];
    if (!look) return null;
    return [
        `Turn the main person (or subject) in this photo into ${look}, keeping their expression, pose, hairstyle and clothes recognisable.`,
        'Fun sticker style: bold clean outlines, bright colours, one character centred, the whole character in frame.',
        'Plain flat light background so it can be cut out. No text, no watermark.',
    ].join(' ');
}

/** Count one picture for today; throws a PLAN_LIMIT error past the plan's daily cap. */
async function takeOne(userId, plan, now = new Date()) {
    const max = dailyLimit(plan);
    if (max === null) return { used: null, max: null };
    const day = now.toISOString().slice(0, 10);
    const key = `ai:img:u:${userId}:${day}`;
    const used = await counters.incr(key, 1, 2 * 86400);
    if (used > max) {
        await counters.incr(key, -1, 2 * 86400).catch(() => {});
        const err = new plans.PlanLimitError('ai.userDaily', {
            max, used: used - 1, plan,
            message: `You've made ${max} AI pictures today, your plan's limit. ${plan === 'pro' ? 'More tomorrow.' : 'Upgrade to Pro for more.'}`,
        });
        throw err;
    }
    return { used, max, give: () => counters.incr(key, -1, 2 * 86400).catch(() => {}) };
}

/** The first picture in a Gemini answer: { mimeType, data } (base64), or null. */
function pictureFrom(body) {
    for (const c of body?.candidates || []) {
        for (const p of c?.content?.parts || []) {
            const d = p.inlineData || p.inline_data;
            if (d?.data) return { mimeType: d.mimeType || d.mime_type || 'image/png', data: d.data };
        }
    }
    return null;
}

/**
 * Edit a photo into the chosen look. Resolves { mimeType, data } (base64).
 * `http` is axios-like so tests can pass a fake.
 */
async function makePicture({ buffer, mimeType, style, prompt }, { env = process.env, http = require('axios') } = {}) {
    if (!enabled(env)) throw Object.assign(new Error('AI pictures are not set up on this server'), { status: 503, code: 'AI_IMAGES_OFF' });
    if (!buffer?.length) throw Object.assign(new Error('Pick a photo'), { status: 400 });
    if (buffer.length > MAX_INPUT_BYTES) throw Object.assign(new Error('That photo is too large'), { status: 413 });
    if (!/^image\/(png|jpe?g|webp)$/i.test(String(mimeType || ''))) throw Object.assign(new Error('Pick a JPEG, PNG or WebP photo'), { status: 400 });
    const text = promptFor(style, prompt);
    if (!text) throw Object.assign(new Error('Choose a look, or describe one'), { status: 400 });
    const model = clean(env.GEMINI_IMAGE_MODEL) || DEFAULT_MODEL;
    let res;
    try {
        res = await http.request({
            method: 'post',
            url: `${API}/${encodeURIComponent(model)}:generateContent`,
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': clean(env.GEMINI_API_KEY) || clean(env.GOOGLE_AI_KEY) },
            timeout: 90_000,
            data: {
                contents: [{ role: 'user', parts: [{ text }, { inline_data: { mime_type: mimeType, data: buffer.toString('base64') } }] }],
                generationConfig: { responseModalities: ['IMAGE'] },
            },
        });
    } catch (err) {
        const status = err?.response?.status;
        const e = err?.response?.data?.error || {};
        // Out of quota (or the key's Google project has no billing for images): not the person's fault.
        if (status === 429 || e.status === 'RESOURCE_EXHAUSTED') {
            require('../../../utils/logger').warn({ model, msg: String(e.message || '').slice(0, 300) }, '[Stickers] Gemini image quota');
            throw Object.assign(new Error("AI pictures aren't available right now. Try again later."), { status: 503, code: 'AI_IMAGES_BUSY' });
        }
        if (status === 503 || e.status === 'UNAVAILABLE') {
            throw Object.assign(new Error('The AI is busy right now. Try again in a minute.'), { status: 503, code: 'AI_IMAGES_BUSY' });
        }
        if (status === 400 && /safety|blocked|policy/i.test(String(e.message))) {
            throw Object.assign(new Error("The AI won't make a picture from that photo. Try another photo or look."), { status: 422 });
        }
        require('../../../utils/logger').warn({ model, status, msg: String(e.message || err?.message || '').slice(0, 300) }, '[Stickers] Gemini image failed');
        throw Object.assign(new Error("The AI couldn't make that picture. Try again."), { status: 502 });
    }
    const picture = pictureFrom(res.data);
    if (!picture) {
        throw Object.assign(new Error("The AI didn't make a picture from that photo (it may break its safety rules). Try another photo or look."), { status: 422 });
    }
    return picture;
}

module.exports = { STYLES, DEFAULT_MODEL, enabled, dailyLimit, promptFor, takeOne, pictureFrom, makePicture };
