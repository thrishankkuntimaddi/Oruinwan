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

/**
 * Release my hold and leave the room once nobody holds it. The leave waits a moment and is
 * skipped if someone took the room again meanwhile: a re-render releases and re-joins in the
 * same moment, and a leave sent after that join took the person out of the room, so they
 * stopped seeing live agenda, notes and transcript changes.
 */
export function releaseAndLeave(socket, meetingId) {
    if (!releaseMeetingRoom(meetingId)) return;
    const id = String(meetingId);
    setTimeout(() => {
        if (!holders.get(id)) socket?.emit('meeting:leave', { meetingId });
    }, 0);
}
