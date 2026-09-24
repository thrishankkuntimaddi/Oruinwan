// End-to-end check of the message toolbar endpoints against a running server:
// bookmark, reminder, convert-task, edit, versions, restore, info, translate,
// thread summary and pin. Creates a throwaway workspace and deletes it at the end.
/* eslint-disable no-console */
require('dotenv').config();
const axios = require('axios');
const { io } = require('socket.io-client');
const B = process.env.E2E_BASE || 'http://localhost:8080';
axios.defaults.timeout = 60000;
const b64 = (s) => Buffer.from(s).toString('base64');
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
const status = async (p) => { try { const r = await p; return r.status; } catch (e) { return e.response?.status || e.message; } };

(async () => {
  const login = await axios.post(`${B}/api/auth/login`, { email: process.env.CHTTRIX_ADMIN_EMAIL, password: process.env.CHTTRIX_ADMIN_PASS });
  const token = login.data.accessToken;
  const h = { headers: { Authorization: `Bearer ${token}` } };
  const me = String(login.data.user?._id || login.data.user?.id || '');
  const ws = (await axios.post(`${B}/api/workspaces`, { name: 'Toolbar E2E ' + Date.now(), description: 'temp' }, h)).data.workspace;
  const channelId = ws.defaultChannels[0];
  const V = `${B}/api/v2/messages`;
  let sock;
  try {
    sock = io(B, { auth: { token }, transports: ['websocket'] });
    await new Promise((r, j) => { sock.on('connect', r); sock.on('connect_error', j); setTimeout(() => j(new Error('socket timeout')), 10000); });
    await new Promise((r) => { sock.emit('chat:join', channelId, r); setTimeout(r, 3000); });
    const events = [];
    ['message:edited', 'message-pinned', 'message-unpinned', 'message:task_created'].forEach((ev) => sock.on(ev, (p) => events.push({ ev, p })));

    const sent = (await axios.post(`${V}/channel`, { channelId, ciphertext: b64('original'), messageIv: b64('iv-1'), isEncrypted: true }, h)).data;
    const msg = sent.message || sent;
    const id = msg._id;
    check('post channel message', !!id, id);

    // 1-2 bookmarks
    const bm1 = (await axios.post(`${V}/${id}/bookmark`, {}, h)).data;
    const list1 = (await axios.get(`${V}/bookmarks?limit=10`, h)).data.messages;
    const bm2 = (await axios.post(`${V}/${id}/bookmark`, {}, h)).data;
    const list2 = (await axios.get(`${V}/bookmarks?limit=10`, h)).data.messages;
    check('bookmark toggle on/off', bm1.bookmarked === true && bm2.bookmarked === false && bm1.messageId === id, JSON.stringify([bm1, bm2]));
    check('bookmarks list reflects toggle', list1.some((m) => m._id === id) && !list2.some((m) => m._id === id), `${list1.length} -> ${list2.length}`);
    check('bookmark missing message -> 404', (await status(axios.post(`${V}/${'0'.repeat(24)}/bookmark`, {}, h))) === 404);
    const legacyBm = (await axios.post(`${B}/api/messages/${id}/bookmark`, {}, h)).data;
    await axios.post(`${B}/api/messages/${id}/bookmark`, {}, h);
    check('legacy /api/messages/:id/bookmark', legacyBm.bookmarked === true, JSON.stringify(legacyBm));

    // 3 reminders
    const rem = await axios.post(`${V}/${id}/reminder`, { remindAt: new Date(Date.now() + 3600e3).toISOString(), note: 'e2e' }, h);
    const rems = (await axios.get(`${V}/reminders`, h)).data.reminders;
    const del = await axios.delete(`${V}/reminders/${rem.data.reminder._id}`, h);
    check('reminder create/list/cancel', rem.status === 201 && rem.data.success && rems.some((r) => r._id === rem.data.reminder._id) && del.data.success);
    check('reminder in the past -> 400', (await status(axios.post(`${V}/${id}/reminder`, { remindAt: new Date(Date.now() - 1000).toISOString() }, h))) === 400);
    const legacyRem = await axios.post(`${B}/api/messages/${id}/remind`, { remindAt: new Date(Date.now() + 7200e3).toISOString() }, h);
    await axios.delete(`${B}/api/reminders/${legacyRem.data.reminder._id}`, h);
    check('legacy /api/messages/:id/remind', legacyRem.status === 201);

    // 4 convert-task
    check('convert-task without title -> 400', (await status(axios.post(`${V}/${id}/convert-task`, {}, h))) === 400);
    const task = await axios.post(`${V}/${id}/convert-task`, { title: 'E2E task', priority: 'high', workspaceId: '0'.repeat(24), assigneeIds: me ? [me] : undefined }, h);
    check('convert-task 201, workspace from message', task.status === 201 && String(task.data.task.workspace) === String(ws.id || ws._id), JSON.stringify(task.data.task));
    check('convert-task twice -> 409', (await status(axios.post(`${V}/${id}/convert-task`, { title: 'again' }, h))) === 409);

    // 7 edit
    check('empty edit -> 400', (await status(axios.patch(`${V}/${id}`, {}, h))) === 400);
    check('identical edit -> 400', (await status(axios.patch(`${V}/${id}`, { ciphertext: b64('original'), messageIv: b64('iv-9') }, h))) === 400);
    const edited = (await axios.patch(`${V}/${id}`, { ciphertext: b64('edited'), messageIv: b64('iv-2') }, h)).data.message;
    check('edit ok', edited.version === 2 && edited.payload.ciphertext === b64('edited'));

    // 5 versions
    const v1 = (await axios.get(`${V}/${id}/versions`, h)).data;
    check('versions shape', v1.canRestore === true && v1.current.version === 2 && v1.versions.length === 1 && v1.versions[0].ciphertext === b64('original') && v1.versions[0].version === 1,
      JSON.stringify({ current: v1.current.version, versions: v1.versions.map((x) => [x.index, x.version]) }));
    const diff = (await axios.get(`${V}/${id}/diff`, h)).data;
    check('legacy diff has versions + old fields', Array.isArray(diff.versions) && Array.isArray(diff.editHistory) && diff.version === 2);

    // 6 restore
    check('restore bad index -> 400', (await status(axios.post(`${V}/${id}/restore`, { versionIndex: 9 }, h))) === 400);
    const restored = (await axios.post(`${V}/${id}/restore`, { versionIndex: 0 }, h)).data.message;
    check('restore', restored.payload.ciphertext === b64('original') && restored.restoredFromVersion === 1 && restored.version === 3 && restored.editHistory.length === 2);
    const v2 = (await axios.get(`${V}/${id}/versions`, h)).data;
    check('versions after restore', v2.versions.length === 2 && v2.current.restoredFromVersion === 1 && v2.versions[1].ciphertext === b64('edited'));

    // 11 pin (before info so pinnedBy shows)
    const pinned = await axios.post(`${V}/${id}/pin`, { pin: true }, h);
    check('pin', pinned.data.message.isPinned === true);

    // 8 info
    const info = (await axios.get(`${V}/${id}/info`, h)).data;
    check('info fields', info.version === 3 && info.editCount === 2 && info.restoredFromVersion === 1 && info.isPinned === true && !!info.pinnedBy && Array.isArray(info.readByUsers) && Array.isArray(info.readBy),
      JSON.stringify({ version: info.version, editCount: info.editCount, restoredFromVersion: info.restoredFromVersion, isPinned: info.isPinned, pinnedBy: info.pinnedBy, readByUsers: info.readByUsers.length }));

    const unpinned = await axios.post(`${V}/${id}/pin`, { pin: false }, h);
    check('unpin', unpinned.data.message.isPinned === false);

    // 9 translate
    check('translate > 5000 chars -> 400', (await status(axios.post(`${V}/ai/translate`, { text: 'a'.repeat(5001), targetLang: 'es' }, h))) === 400);
    try {
      const tr = (await axios.post(`${V}/ai/translate`, { text: 'Good morning, the release is ready.', targetLang: 'Spanish', messageId: id }, h)).data;
      check('translate', typeof tr.translated === 'string' && tr.translated.length > 0 && tr.translated !== 'Good morning, the release is ready.', JSON.stringify(tr));
    } catch (e) { check('translate', false, `${e.response?.status} ${JSON.stringify(e.response?.data)}`); }

    // 10 thread summary
    try {
      const sum = (await axios.post(`${V}/ai/thread-summary`, { parentMessageId: id, parentText: 'Should we ship on Friday?', replies: [{ sender: 'bob', text: 'Yes, QA passed.' }, { sender: 'carol', text: 'Agreed, I will write release notes by Thursday.' }] }, h)).data;
      check('thread summary', typeof sum.summary === 'string' && sum.summary.length > 10, JSON.stringify(sum).slice(0, 200));
    } catch (e) { check('thread summary', false, `${e.response?.status} ${JSON.stringify(e.response?.data)}`); }

    await new Promise((r) => setTimeout(r, 1000));
    const evNames = events.map((e) => e.ev);
    check('socket events', ['message:edited', 'message-pinned', 'message-unpinned', 'message:task_created'].every((n) => evNames.includes(n)), evNames.join(','));
  } finally {
    if (sock) sock.close();
    await axios.delete(`${B}/api/workspaces/${ws.id || ws._id}`, h).then(() => console.log('cleanup: workspace deleted')).catch((e) => console.log('cleanup failed', e.response?.status));
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('E2E FAILED:', e.config?.url, e.response?.status, JSON.stringify(e.response?.data) || e.stack); process.exit(1); });
