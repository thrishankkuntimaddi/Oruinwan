import api from '../../../services/api';

const base = (huddleId) => `/api/v2/huddles/${encodeURIComponent(huddleId)}`;

/** REST side of the huddle workspace (sessions, shared notes, linked tasks, wrap-up). */
export const huddleApi = {
    session: (huddleId) => api.get(`${base(huddleId)}/session`).then((r) => r.data.session),
    ensureNotes: (huddleId) => api.post(`${base(huddleId)}/notes`).then((r) => r.data),
    linkTask: (huddleId, taskId) => api.post(`${base(huddleId)}/tasks`, { taskId }).then((r) => r.data.taskIds || []),
    unlinkTask: (huddleId, taskId) => api.delete(`${base(huddleId)}/tasks/${taskId}`).then((r) => r.data.taskIds || []),
    wrapUp: (huddleId, messageId) => api.post(`${base(huddleId)}/wrap-up`, { messageId }).then((r) => r.data),
};

/** Send one notes operation over the socket; resolves with the server's ack. */
export function sendNotesOp(socket, huddleId, op, timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
        if (!socket?.connected) { reject(new Error('Not connected')); return; }
        const t = setTimeout(() => reject(new Error('The notes did not save in time')), timeoutMs);
        socket.emit('huddle:notes_op', { huddleId, op }, (res) => {
            clearTimeout(t);
            if (res?.ok) resolve(res);
            else reject(new Error(res?.message || 'Could not save the notes'));
        });
    });
}

export const errorText = (err, fallback) => err?.response?.data?.message || err?.message || fallback;
