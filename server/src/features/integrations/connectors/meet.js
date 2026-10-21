'use strict';

/**
 * Google Meet: real Meet links via the Calendar API (an event with
 * conferenceData.createRequest of type hangoutsMeet) using a pasted OAuth
 * access token with the calendar.events scope. Without one, the client offers
 * "paste a Meet link" (validated by isMeetLink) — links are never invented.
 */

const crypto = require('crypto');
const { request, clip, httpError } = require('./http');
const google = require('./google');

const CAL_API = () => (process.env.GOOGLE_CALENDAR_API_URL || 'https://www.googleapis.com/calendar/v3').replace(/\/+$/, '');
const MEET_LINK = /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}(\?[^\s]*)?$/;

const isMeetLink = (url) => MEET_LINK.test(String(url || '').trim());

function cal(ctx, method, path, { data, params } = {}) {
  return request({
    label: 'Google Calendar', code: 'GMEET', method, url: `${CAL_API()}${path}`, data, params,
    headers: { Authorization: `Bearer ${ctx.secret('accessToken')}`, 'Content-Type': 'application/json' },
  });
}

module.exports = {
  type: 'google_meet',
  label: 'Google Meet',
  category: 'communication',
  description: 'Create real Google Meet links from Oruinwan (via Google Calendar).',
  setup: [
    'Paste an OAuth access token with the https://www.googleapis.com/auth/calendar.events scope (for example from the Google OAuth 2.0 Playground). The meeting is created on that account’s calendar.',
    'Access tokens expire after about an hour. Without a valid token, people can still paste an existing Meet link.',
  ],
  form: [{ key: 'accessToken', label: 'OAuth access token (calendar.events)', kind: 'secret', required: true, placeholder: 'ya29.…' }],
  secrets: ['accessToken'],
  generated: [],
  secretChecks: { accessToken: google.checkAccessToken },
  fields: {},
  defaults: () => ({}),
  toggles: [],
  routes: null,
  required: ['accessToken'],
  webhook: null,

  async test(ctx) {
    const c = await cal(ctx, 'get', '/calendars/primary', {});
    return { account: { name: c.summary || null, email: c.id || null } };
  },

  actions: {
    meeting: {
      method: 'POST',
      async run(ctx, { title, start, durationMinutes }) {
        const begin = start ? new Date(start) : new Date();
        if (Number.isNaN(begin.getTime())) throw httpError(400, 'start must be an ISO date');
        const minutes = Math.min(Math.max(parseInt(durationMinutes, 10) || 30, 5), 24 * 60);
        const end = new Date(begin.getTime() + minutes * 60_000);
        const ev = await cal(ctx, 'post', '/calendars/primary/events', {
          params: { conferenceDataVersion: 1 },
          data: {
            summary: clip(title, 200) || 'Oruinwan meeting',
            start: { dateTime: begin.toISOString() },
            end: { dateTime: end.toISOString() },
            conferenceData: { createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: 'hangoutsMeet' } } },
          },
        });
        const link = ev.hangoutLink || ev.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri;
        if (!link) throw httpError(502, 'Google Calendar created the event but returned no Meet link (is Meet enabled for this account?)', 'GMEET_NO_LINK');
        return { meeting: { joinUrl: link, eventId: ev.id, eventUrl: ev.htmlLink || null, title: ev.summary, start: ev.start?.dateTime || null, durationMinutes: minutes } };
      },
    },
    'check-link': {
      method: 'POST',
      allowDisconnected: true,
      async run(_ctx, { url }) {
        if (!isMeetLink(url)) throw httpError(400, 'That is not a Google Meet link (https://meet.google.com/abc-defg-hij)');
        return { meeting: { joinUrl: String(url).trim() } };
      },
    },
  },
  isMeetLink,
};
