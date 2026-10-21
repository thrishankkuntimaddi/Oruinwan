import api from '@services/api';

/**
 * POST /api/v2/meetings/suggest-time. Needs no meeting (or socket), so the schedule
 * dialog calls it directly; the raw answer goes through utils/meetingSlots.
 * (The meeting record itself lives in features/meetings/useMeetingRecord.)
 */
export async function suggestMeetingTime(participantIds = [], durationMinutes = 30) {
    const { data } = await api.post('/api/v2/meetings/suggest-time', { participantIds, durationMinutes });
    return data;
}
