/**
 * The `meeting:<id>` socket room is wanted by both the meeting page and a call
 * that holds the meeting (for its live transcript events). The server room is a
 * plain join/leave, so this counts holders and only leaves when the last one goes.
 */
const holders = new Map();

export function retainMeetingRoom(meetingId) {
    const id = String(meetingId);
    holders.set(id, (holders.get(id) || 0) + 1);
}

/** Returns true when the caller was the last holder (and should emit meeting:leave). */
export function releaseMeetingRoom(meetingId) {
    const id = String(meetingId);
    const n = (holders.get(id) || 0) - 1;
    if (n > 0) { holders.set(id, n); return false; }
    holders.delete(id);
    return true;
}

export const meetingRoomHolders = (meetingId) => holders.get(String(meetingId)) || 0;
