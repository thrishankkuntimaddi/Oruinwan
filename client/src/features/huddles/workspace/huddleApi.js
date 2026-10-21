import api from '../../../services/api';

const base = (huddleId) => `/api/v2/huddles/${encodeURIComponent(huddleId)}`;

/**
 * REST side of a huddle run. Notes, action items and the summary belong to the
 * call's meeting record now (features/meetings/meetingApi, docs/api/meetings-unified.md).
 */
export const huddleApi = {
    session: (huddleId) => api.get(`${base(huddleId)}/session`).then((r) => r.data.session),
    /** With `summary`, the posted text also becomes the meeting's summary. */
    wrapUp: (huddleId, messageId, summary) => api.post(`${base(huddleId)}/wrap-up`, summary ? { messageId, summary } : { messageId }).then((r) => r.data),
};

export const errorText = (err, fallback) => err?.response?.data?.message || err?.message || fallback;
