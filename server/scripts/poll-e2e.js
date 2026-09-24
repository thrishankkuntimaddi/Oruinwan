// End-to-end poll check against a running server: create a workspace + channel
// poll, listen on a second socket, vote, change vote, end poll, then clean up.
require('dotenv').config();
const axios = require('axios');
const { io } = require('socket.io-client');
const B = process.env.E2E_BASE || 'http://localhost:8080';
const step = (m) => console.log('step:', m);
const withTimeout = (p, ms, what) => Promise.race([p, new Promise((_, j) => setTimeout(() => j(new Error('timeout: ' + what)), ms))]);
axios.defaults.timeout = 15000;
(async () => {
  const login = await axios.post(`${B}/api/auth/login`, { email: process.env.CHTTRIX_ADMIN_EMAIL, password: process.env.CHTTRIX_ADMIN_PASS });
  const h = { headers: { Authorization: `Bearer ${login.data.accessToken}` } };
  const ws = (await axios.post(`${B}/api/workspaces`, { name: 'Poll E2E ' + Date.now(), description: 'temp' }, h)).data.workspace;
  const channelId = ws.defaultChannels[0];
  const sock = io(B, { auth: { token: login.data.accessToken }, transports: ['websocket'] });
  step('login+workspace ok');
  await withTimeout(new Promise((r, j) => { sock.on('connect', r); sock.on('connect_error', j); }), 10000, 'socket connect');
  step('socket connected');
  const ack = await withTimeout(new Promise((r) => sock.emit('chat:join', channelId, r)), 8000, 'chat:join ack').catch(e => e.message);
  step('chat:join -> ' + JSON.stringify(ack));
  const seen = [];
  sock.on('new-message', (m) => { if (m.type === 'poll') seen.push(`new-message(sender=${m.sender?.username})`); });
  sock.on('poll:vote_updated', (p) => seen.push(`vote_updated(total=${p.poll.totalVotes}, active=${p.poll.isActive}, voter=${p.poll.options.flatMap(o => o.votes.map(v => v.username)).join('|') || '-'})`));
  const t0 = Date.now();
  const created = (await axios.post(`${B}/api/v2/messages/poll`, { channelId, poll: { question: 'Ship Friday?', options: ['Yes', 'No'] } }, h)).data.message;
  const id = created._id;
  const v1 = (await axios.post(`${B}/api/v2/messages/${id}/vote`, { optionIndices: [0] }, h)).data.message.poll;
  const v2 = (await axios.post(`${B}/api/v2/messages/${id}/vote`, { optionIndices: [1] }, h)).data.message.poll;
  const closed = (await axios.post(`${B}/api/v2/messages/${id}/poll/close`, {}, h)).data.message.poll;
  let lateVote = 'n/a';
  try { await axios.post(`${B}/api/v2/messages/${id}/vote`, { optionIndices: [0] }, h); lateVote = 'ACCEPTED (bad)'; } catch (e) { lateVote = `${e.response.status} ${e.response.data.message}`; }
  await new Promise((r) => setTimeout(r, 800));
  console.log('vote 1 counts:', v1.options.map(o => o.votes.length).join('/'), '| vote 2 counts:', v2.options.map(o => o.votes.length).join('/'), '| total:', v2.totalVotes);
  console.log('closed isActive:', closed.isActive, '| vote after close:', lateVote);
  console.log('socket events:', seen.join(' -> '), `| elapsed ${Date.now() - t0}ms`);
  sock.close();
  await axios.delete(`${B}/api/workspaces/${ws.id}`, h);
  console.log('cleanup: workspace deleted');
  process.exit(0);
})().catch((e) => { console.error('E2E FAILED:', e.response?.status, e.response?.data || e.message); process.exit(1); });
