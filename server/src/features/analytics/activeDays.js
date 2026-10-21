'use strict';

/**
 * Daily active members, for counts-only engagement charts.
 *
 * One row per (company, member, UTC day) the member had the app open. Rows are
 * only ever read back as counts (members active per day / per week) — never
 * listed per person — and expire after ~13 months. Nothing about messages, who
 * someone talked to, or what they did is stored.
 *
 * markActive() is called from presence (socket connect / idle). It writes at
 * most once per member per day per instance and never throws.
 */

const mongoose = require('mongoose');

const RETENTION_DAYS = 400;
const DAY_MS = 24 * 60 * 60 * 1000;

const schema = new mongoose.Schema({
    company: { type: String, required: true },
    user: { type: String, required: true },
    day: { type: String, required: true }, // YYYY-MM-DD (UTC)
    expireAt: { type: Date, required: true },
}, { versionKey: false });
schema.index({ company: 1, day: 1, user: 1 }, { unique: true });
schema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

const MemberActiveDay = mongoose.models.MemberActiveDay || mongoose.model('MemberActiveDay', schema);

const dayKey = (d) => new Date(d).toISOString().slice(0, 10);

// Members already written today on this instance: `${company}|${user}|${day}`.
const seen = new Set();
let seenDay = null;

async function markActive(userId, companyId, now = new Date()) {
    try {
        if (!userId || !companyId) return false;
        if (mongoose.connection.readyState !== 1) return false;
        const day = dayKey(now);
        if (seenDay !== day) { seen.clear(); seenDay = day; }
        const key = `${companyId}|${userId}|${day}`;
        if (seen.has(key)) return false;
        seen.add(key);
        await MemberActiveDay.updateOne(
            { company: String(companyId), user: String(userId), day },
            { $setOnInsert: { expireAt: new Date(now.getTime() + RETENTION_DAYS * DAY_MS) } },
            { upsert: true }
        );
        return true;
    } catch {
        return false;
    }
}

/** Monday (UTC) of the week containing d, as YYYY-MM-DD. */
function weekStartKey(d) {
    const x = new Date(d);
    const dow = (x.getUTCDay() + 6) % 7; // Mon = 0
    return dayKey(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate() - dow));
}

/**
 * Build the series from (user, day) rows. Pure, for tests.
 *   daily:  [{ date, active }] for each of the last `days` days (zeros included)
 *   weekly: [{ weekStart, active }] distinct members per Monday-based UTC week
 */
function buildActiveSeries(rows, days, now = new Date()) {
    const perDay = new Map();
    const perWeek = new Map();
    for (const r of rows) {
        if (!perDay.has(r.day)) perDay.set(r.day, new Set());
        perDay.get(r.day).add(String(r.user));
        const wk = weekStartKey(`${r.day}T00:00:00Z`);
        if (!perWeek.has(wk)) perWeek.set(wk, new Set());
        perWeek.get(wk).add(String(r.user));
    }
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const daily = [];
    for (let i = days - 1; i >= 0; i--) {
        const date = dayKey(today - i * DAY_MS);
        daily.push({ date, active: perDay.get(date)?.size || 0 });
    }
    const weekly = [];
    const firstWeek = weekStartKey(today - (days - 1) * DAY_MS);
    for (let t = Date.parse(`${firstWeek}T00:00:00Z`); t <= today; t += 7 * DAY_MS) {
        const weekStart = dayKey(t);
        weekly.push({ weekStart, active: perWeek.get(weekStart)?.size || 0 });
    }
    return { daily, weekly };
}

/** Counts of active members per day and per week over the last `days` days. */
async function getActiveMembers(companyId, days = 30, now = new Date()) {
    const span = Math.max(1, Math.min(Number(days) || 30, 365));
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    // Start at the Monday of the first week so the first weekly bucket is complete.
    const from = weekStartKey(today - (span - 1) * DAY_MS);
    const rows = await MemberActiveDay.find({ company: String(companyId), day: { $gte: from } })
        .select('user day -_id').lean();
    const series = buildActiveSeries(rows, span, now);
    const daysWithData = series.daily.filter((d) => d.active > 0).length;
    return {
        ...series,
        summary: {
            avgDailyActive: span ? Math.round(series.daily.reduce((a, d) => a + d.active, 0) / span) : 0,
            peakDailyActive: Math.max(0, ...series.daily.map((d) => d.active)),
            daysWithData,
        },
    };
}

module.exports = { markActive, getActiveMembers, buildActiveSeries, weekStartKey, MemberActiveDay, _resetForTests: () => { seen.clear(); seenDay = null; } };
