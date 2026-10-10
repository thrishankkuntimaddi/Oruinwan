// The demo workspace. Every timestamp is relative to "now" so the data always looks current.
// Content is original and fictional.
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export function buildSeed(now = Date.now()) {
  const ago = (ms) => new Date(now - ms).toISOString();
  const ahead = (ms) => new Date(now + ms).toISOString();

  const users = {
    me: { id: 'me', name: 'Sam Carter', username: 'sam', email: 'sam@oruinwan.demo', title: 'Product lead', presence: 'active', about: 'Shipping the mobile app 📱' },
    priya: { id: 'priya', name: 'Priya Nair', username: 'priya', title: 'Engineering manager', presence: 'active' },
    daniel: { id: 'daniel', name: 'Daniel Okafor', username: 'daniel', title: 'Backend engineer', presence: 'away' },
    mei: { id: 'mei', name: 'Mei Lin', username: 'mei', title: 'Product designer', presence: 'active' },
    lucas: { id: 'lucas', name: 'Lucas Moreau', username: 'lucas', title: 'Mobile engineer', presence: 'dnd' },
    aisha: { id: 'aisha', name: 'Aisha Rahman', username: 'aisha', title: 'QA lead', presence: 'offline' },
    tomas: { id: 'tomas', name: 'Tomás Silva', username: 'tomas', title: 'DevOps', presence: 'active' },
  };

  const workspaces = [
    { id: 'ws-product', name: 'Product', description: 'Everything we build and ship', color: '#b8956a', memberCount: 7, role: 'admin' },
    { id: 'ws-design', name: 'Design Guild', description: 'Critique, systems and research', color: '#6a8f86', memberCount: 4, role: 'member' },
    { id: 'ws-personal', name: 'Personal', description: 'Just you', color: '#7c6a8f', memberCount: 1, role: 'owner', isPersonal: true },
  ];

  const channels = [
    { id: 'c-general', ws: 'ws-product', name: 'general', topic: 'Company-wide chatter and wins', isMember: true, memberIds: Object.keys(users), unread: 0 },
    { id: 'c-announce', ws: 'ws-product', name: 'announcements', topic: 'Read-only updates from leads', isMember: true, broadcast: true, memberIds: Object.keys(users), unread: 1 },
    { id: 'c-eng', ws: 'ws-product', name: 'engineering', topic: 'Builds, reviews and incidents', isMember: true, memberIds: ['me', 'priya', 'daniel', 'lucas', 'tomas', 'aisha'], unread: 4, mentions: 1 },
    { id: 'c-mobile', ws: 'ws-product', name: 'mobile-launch', topic: 'Android 1.0 — ship it carefully', isMember: true, private: true, memberIds: ['me', 'lucas', 'mei', 'aisha', 'priya'], unread: 2 },
    { id: 'c-design', ws: 'ws-product', name: 'design-review', topic: 'Post work in progress, get eyes on it', isMember: true, memberIds: ['me', 'mei', 'lucas', 'priya'], unread: 0 },
    { id: 'c-random', ws: 'ws-product', name: 'random', topic: 'Coffee, music, cat photos', isMember: true, muted: true, memberIds: Object.keys(users), unread: 6 },
    { id: 'c-support', ws: 'ws-product', name: 'customer-support', topic: 'Escalations from the help desk', isMember: false, memberIds: ['aisha', 'daniel'], unread: 0 },
    { id: 'c-crit', ws: 'ws-design', name: 'critique', topic: 'Weekly crit sessions', isMember: true, memberIds: ['me', 'mei', 'lucas'], unread: 1 },
    { id: 'c-systems', ws: 'ws-design', name: 'design-system', topic: 'Tokens, components, icons', isMember: true, memberIds: ['me', 'mei'], unread: 0 },
    { id: 'c-inbox', ws: 'ws-personal', name: 'inbox', topic: 'Notes to self', isMember: true, memberIds: ['me'], unread: 0 },
  ];

  const dms = [
    { id: 'd-priya', ws: 'ws-product', memberIds: ['me', 'priya'], unread: 2 },
    { id: 'd-lucas', ws: 'ws-product', memberIds: ['me', 'lucas'], unread: 0 },
    { id: 'd-mei', ws: 'ws-product', memberIds: ['me', 'mei'], unread: 1 },
    { id: 'd-daniel', ws: 'ws-product', memberIds: ['me', 'daniel'], unread: 0 },
    { id: 'd-aisha', ws: 'ws-product', memberIds: ['me', 'aisha'], unread: 0 },
    { id: 'd-mei-design', ws: 'ws-design', memberIds: ['me', 'mei'], unread: 0 },
  ];

  let n = 0;
  const m = (conv, author, text, at, extra = {}) => ({ id: `m${(n += 1)}`, conv, author, text, at: ago(at), reactions: {}, ...extra });

  const messages = [
    // #engineering
    m('c-eng', 'tomas', 'Staging is green again. The flaky socket test was a race in the reconnect handler.', 5 * HOUR),
    m('c-eng', 'daniel', 'Nice. I pushed the pagination fix for threads — `before` cursors now use the message id, not the timestamp.', 4 * HOUR, { reactions: { '🎉': ['priya', 'tomas'] } }),
    m('c-eng', 'priya', 'Reminder: code freeze for the mobile release is Thursday 18:00. Anything not merged by then rolls to 1.1.', 3 * HOUR, { replyCount: 3, replyIds: ['lucas', 'aisha'], lastReplyAt: ago(2 * HOUR) }),
    m('c-eng', 'lucas', 'Android build is down to 3.4 MB. Capacitor + the system WebView instead of bundling a browser engine.', 90 * MIN, { reactions: { '🔥': ['me', 'tomas', 'priya'] } }),
    m('c-eng', 'daniel', '```\nGET /api/v2/messages/channel/:id?limit=40&before=<id>\n```\nSame shape for DMs. Mobile can reuse the web client paging.', 45 * MIN),
    m('c-eng', 'aisha', '@Sam can you sign off the release checklist once QA finishes the update flow? Last item.', 12 * MIN, { mentionsMe: true }),
    // #mobile-launch
    m('c-mobile', 'mei', 'Final icon set is in Figma — one stroke weight everywhere, 1.75px.', 26 * HOUR),
    m('c-mobile', 'lucas', 'In-app updates work end to end: the app checks the release manifest, downloads the APK, verifies the checksum and hands it to the installer.', 7 * HOUR, { reactions: { '👏': ['me', 'aisha'] } }),
    m('c-mobile', 'aisha', 'Tested on Android 16 and 12. Back button behaves: closes sheets first, then screens, then minimises.', 3 * HOUR),
    m('c-mobile', 'priya', 'Let us keep huddles behind the remote flag for 1.0 and roll it to 10% next week.', 30 * MIN),
    // #general
    m('c-general', 'priya', 'Welcome Tomás to the team! 👋', 3 * DAY, { reactions: { '👋': ['me', 'mei', 'daniel', 'lucas'] } }),
    m('c-general', 'tomas', 'Thanks all — happy to be here. Ping me for anything infra.', 3 * DAY - 20 * MIN),
    m('c-general', 'mei', 'Friday demo moved to 16:00 so the London folks can join.', 6 * HOUR),
    // #announcements
    m('c-announce', 'priya', 'Oruinwan for Android 1.0 is ready for internal testing. Install it from the releases page and report anything odd in #mobile-launch.', 2 * HOUR),
    // #design-review
    m('c-design', 'mei', 'Settings redesign: grouped rows, one icon family, destructive actions always confirm. Thoughts?', 20 * HOUR, { replyCount: 2, replyIds: ['me', 'lucas'], lastReplyAt: ago(18 * HOUR) }),
    // #random
    m('c-random', 'daniel', 'Who left the oat milk in the fridge with a label that says "do not touch — production"?', 2 * HOUR),
    m('c-random', 'tomas', 'Infra owns it now. It has an SLA.', 100 * MIN, { reactions: { '😂': ['daniel', 'mei', 'priya'] } }),
    // design guild
    m('c-crit', 'mei', 'Crit tomorrow: onboarding flow v3. Bring opinions.', 9 * HOUR),
    // DMs
    m('d-priya', 'priya', 'Have a minute today to go through the rollout plan?', 50 * MIN),
    m('d-priya', 'priya', 'Mostly the staged rollout for huddles and who gets 1.1 first.', 48 * MIN),
    m('d-lucas', 'me', 'Signed APK verified with apksigner — permanent key, not the debug one.', 5 * HOUR),
    m('d-lucas', 'lucas', 'Perfect. Then updates install over the top without uninstalling.', 4 * HOUR),
    m('d-mei', 'me', 'Where should the AI tab sit in the tab bar?', 75 * MIN),
    m('d-mei', 'mei', 'Middle, slightly raised, in gold. It is the thing people will try first.', 70 * MIN),
    m('d-daniel', 'daniel', 'Thread endpoints are deployed. Let me know if mobile needs anything else.', DAY),
    m('d-aisha', 'me', 'Thanks for the thorough test pass 🙏', 2 * DAY),
    m('d-mei-design', 'mei', 'Sending the token sheet over shortly.', 2 * DAY),
  ];

  const threadReplies = {
    m3: [
      m('c-eng', 'lucas', 'Mobile is on track. Only the release notes left.', 2.5 * HOUR, { parentId: 'm3' }),
      m('c-eng', 'aisha', 'QA will finish regression Wednesday night.', 2.2 * HOUR, { parentId: 'm3' }),
      m('c-eng', 'lucas', 'I will tag 1.0.0 right after freeze.', 2 * HOUR, { parentId: 'm3' }),
    ],
  };
  threadReplies.m15 = [
    m('c-design', 'me', 'Love it. Can the danger zone live at the very bottom?', 19 * HOUR, { parentId: 'm15' }),
    m('c-design', 'lucas', '+1, and a two-step confirm for delete.', 18 * HOUR, { parentId: 'm15' }),
  ];

  const tasks = [
    { id: 't1', ws: 'ws-product', title: 'Sign off the mobile release checklist', status: 'review', priority: 'highest', due: ahead(4 * HOUR), assignees: ['me'], project: 'Mobile 1.0', subtasks: [3, 4], comments: 5 },
    { id: 't2', ws: 'ws-product', title: 'Write release notes for Android 1.0', status: 'in_progress', priority: 'high', due: ahead(DAY), assignees: ['me', 'lucas'], project: 'Mobile 1.0', subtasks: [1, 3], comments: 2 },
    { id: 't3', ws: 'ws-product', title: 'Staged rollout plan for huddles', status: 'todo', priority: 'medium', due: ahead(3 * DAY), assignees: ['me'], project: 'Mobile 1.1', comments: 1 },
    { id: 't4', ws: 'ws-product', title: 'Review thread pagination PR', status: 'todo', priority: 'medium', due: ago(DAY), assignees: ['me'], project: 'Platform', comments: 0 },
    { id: 't5', ws: 'ws-product', title: 'Settings screen: devices & sessions', status: 'done', priority: 'low', due: ago(2 * DAY), assignees: ['lucas'], project: 'Mobile 1.0' },
    { id: 't6', ws: 'ws-product', title: 'Fix socket reconnect race on staging', status: 'done', priority: 'high', due: ago(DAY), assignees: ['tomas'], project: 'Platform' },
    { id: 't7', ws: 'ws-product', title: 'Push notifications via FCM', status: 'backlog', priority: 'high', assignees: ['daniel', 'lucas'], project: 'Mobile 1.1' },
    { id: 't8', ws: 'ws-product', title: 'Update onboarding copy', status: 'blocked', priority: 'low', due: ahead(5 * DAY), assignees: ['mei'], project: 'Growth', blockedReason: 'Waiting on legal review' },
    { id: 't9', ws: 'ws-product', title: 'Regression pass on Android 12–16', status: 'in_progress', priority: 'high', due: ahead(2 * DAY), assignees: ['aisha'], project: 'Mobile 1.0', subtasks: [7, 12] },
    { id: 't10', ws: 'ws-product', title: 'Prepare Friday demo', status: 'todo', priority: 'low', due: ahead(4 * DAY), assignees: ['me', 'mei'], project: 'Team' },
    { id: 't11', ws: 'ws-design', title: 'Audit icon stroke widths', status: 'in_progress', priority: 'medium', due: ahead(2 * DAY), assignees: ['me'], project: 'Design system' },
    { id: 't12', ws: 'ws-personal', title: 'Book dentist appointment', status: 'todo', priority: 'low', due: ahead(6 * DAY), assignees: ['me'] },
  ].map((t) => ({ ...t, createdBy: t.createdBy || 'priya', updatedAt: ago(3 * HOUR), description: t.description || '' }));
  tasks[0].description = 'Go through every item in the release checklist note and tick it off. Blockers go in #mobile-launch.';
  tasks[1].description = 'Short, friendly notes. Cover: install, updates, what is new, known limitations (push arrives in 1.1).';

  const notes = [
    {
      id: 'n1', ws: 'ws-product', type: 'sop', title: 'Mobile release checklist', pinned: true, owner: 'me', sharedWith: ['lucas', 'aisha'], updatedAt: ago(2 * HOUR),
      content: '<h2>Before tagging</h2><ul data-type="checklist"><li data-checked="true">Version bumped in package.json</li><li data-checked="true">Lint, tests and build are green</li><li data-checked="true">Release APK signed with the permanent key</li><li data-checked="false">QA sign-off on Android 12 and 16</li></ul><h2>After publishing</h2><ul data-type="checklist"><li data-checked="false">Download the APK and verify the signer</li><li data-checked="false">Update Remote Config with the new version</li><li data-checked="false">Announce in #announcements</li></ul>',
    },
    {
      id: 'n2', ws: 'ws-product', type: 'meeting', title: 'Sprint 14 planning', owner: 'priya', sharedWith: ['me'], updatedAt: ago(DAY),
      content: '<p><strong>Attendees:</strong> Priya, Sam, Lucas, Daniel, Aisha</p><h2>Goals</h2><ol><li>Ship Android 1.0 to internal testers</li><li>Thread pagination on the server</li><li>Plan FCM push for 1.1</li></ol><h2>Decisions</h2><ul><li>Huddles stay behind a remote flag</li><li>Code freeze Thursday 18:00</li></ul>',
    },
    {
      id: 'n3', ws: 'ws-product', type: 'techdesign', title: 'In-app updates', owner: 'lucas', sharedWith: ['me', 'daniel'], updatedAt: ago(3 * DAY),
      content: '<p>The app reads a small manifest (version, APK URL, SHA-256, minimum version). If newer, it offers the update; below the minimum, it blocks until updated.</p><h2>Why a checksum</h2><p>The installer already checks the signature. The checksum also catches truncated downloads before Android shows a confusing error.</p>',
    },
    {
      id: 'n4', ws: 'ws-product', type: 'brainstorm', title: 'Onboarding ideas', owner: 'mei', sharedWith: ['me'], updatedAt: ago(5 * DAY),
      content: '<ul><li>Explore a demo workspace before signing in</li><li>One screen to connect to a self-hosted server</li><li>Explain end-to-end encryption in one sentence</li></ul>',
    },
    {
      id: 'n5', ws: 'ws-product', type: 'note', title: 'Scratchpad', owner: 'me', updatedAt: ago(30 * MIN),
      content: '<p>Ask Priya about rollout percentages for 1.1.</p><p>Idea: AI summary of unread channels on the Home screen.</p>',
    },
    {
      id: 'n6', ws: 'ws-design', type: 'documentation', title: 'Colour tokens', owner: 'mei', sharedWith: ['me'], updatedAt: ago(4 * DAY),
      content: '<p>Base <code>#0c0c0c</code>, surface <code>#111111</code>, accent gold <code>#b8956a</code>. Light theme uses warm paper <code>#f7f5f1</code> with a deeper gold for contrast.</p>',
    },
  ];

  const knowledge = [
    { id: 'k1', ws: 'ws-product', parentId: null, title: 'Engineering handbook', icon: '📘', updatedAt: ago(6 * DAY), excerpt: 'How we build, review and ship.' },
    { id: 'k2', ws: 'ws-product', parentId: 'k1', title: 'Release process', icon: '🚀', updatedAt: ago(2 * DAY), excerpt: 'Tags, signing, rollout and rollback.' },
    { id: 'k3', ws: 'ws-product', parentId: 'k1', title: 'Code review guide', icon: '🔍', updatedAt: ago(9 * DAY), excerpt: 'Small PRs, clear descriptions, kind comments.' },
    { id: 'k4', ws: 'ws-product', parentId: null, title: 'Onboarding', icon: '👋', updatedAt: ago(12 * DAY), excerpt: 'Your first week at Oruinwan Labs.' },
    { id: 'k5', ws: 'ws-product', parentId: null, title: 'Security & encryption', icon: '🔐', updatedAt: ago(20 * DAY), excerpt: 'How end-to-end encryption protects messages.' },
  ];

  const files = [
    { id: 'f1', ws: 'ws-product', name: 'release-notes-1.0.pdf', size: 184_000, kind: 'pdf', owner: 'lucas', at: ago(5 * HOUR) },
    { id: 'f2', ws: 'ws-product', name: 'settings-redesign.png', size: 1_240_000, kind: 'image', owner: 'mei', at: ago(20 * HOUR) },
    { id: 'f3', ws: 'ws-product', name: 'q4-roadmap.xlsx', size: 48_000, kind: 'sheet', owner: 'priya', at: ago(3 * DAY) },
    { id: 'f4', ws: 'ws-product', name: 'api-threads-v2.md', size: 9_000, kind: 'doc', owner: 'daniel', at: ago(4 * DAY) },
  ];

  const notifications = [
    { id: 'x1', ws: 'ws-product', type: 'mention', actor: 'aisha', text: 'mentioned you in #engineering', preview: 'can you sign off the release checklist once QA finishes…', at: ago(12 * MIN), read: false, target: { kind: 'channel', id: 'c-eng' } },
    { id: 'x2', ws: 'ws-product', type: 'dm', actor: 'priya', text: 'sent you a message', preview: 'Have a minute today to go through the rollout plan?', at: ago(48 * MIN), read: false, target: { kind: 'dm', id: 'd-priya' } },
    { id: 'x3', ws: 'ws-product', type: 'task', actor: 'priya', text: 'assigned you a task', preview: 'Sign off the mobile release checklist', at: ago(3 * HOUR), read: false, target: { kind: 'task', id: 't1' } },
    { id: 'x4', ws: 'ws-product', type: 'thread', actor: 'lucas', text: 'replied to a thread you follow', preview: 'I will tag 1.0.0 right after freeze.', at: ago(2 * HOUR), read: true, target: { kind: 'thread', id: 'm3', conv: 'c-eng' } },
    { id: 'x5', ws: 'ws-product', type: 'meeting', actor: 'mei', text: 'Friday demo starts at 16:00', preview: 'Calendar · 45 min', at: ago(6 * HOUR), read: true, target: null },
    { id: 'x6', ws: 'ws-product', type: 'reaction', actor: 'tomas', text: 'reacted 🔥 to your message', preview: 'Signed APK verified with apksigner…', at: ago(4 * HOUR), read: true, target: { kind: 'dm', id: 'd-lucas' } },
  ];

  const integrations = [
    { id: 'github', name: 'GitHub', description: 'Link pull requests and issues to tasks; post commits to channels.', connected: true, detail: 'oruinwan-labs · 4 repos', category: 'Development' },
    { id: 'gitlab', name: 'GitLab', description: 'Merge request and pipeline updates in channels.', connected: false, category: 'Development' },
    { id: 'jira', name: 'Jira', description: 'Two-way sync between Jira issues and Oruinwan tasks.', connected: false, category: 'Project management' },
    { id: 'zoom', name: 'Zoom', description: 'Start meetings from a channel and share recordings.', connected: true, detail: 'sam@oruinwan.demo', category: 'Meetings' },
    { id: 'webhooks', name: 'Outgoing webhooks', description: 'Send workspace events to your own services.', connected: true, detail: '2 active', category: 'Developer' },
    { id: 'api', name: 'API keys', description: 'Personal tokens for scripts and the JavaScript SDK.', connected: false, category: 'Developer' },
  ];

  const sessions = [
    { id: 's1', device: 'Pixel 7', os: 'Android 16', client: 'Oruinwan app', lastActive: ago(0), current: true, location: 'Bengaluru, IN' },
    { id: 's2', device: 'MacBook Pro', os: 'macOS', client: 'Chrome', lastActive: ago(2 * HOUR), location: 'Bengaluru, IN' },
    { id: 's3', device: 'Windows PC', os: 'Windows 11', client: 'Oruinwan desktop', lastActive: ago(3 * DAY), location: 'Hyderabad, IN' },
  ];

  return { users, workspaces, channels, dms, messages, threadReplies, tasks, notes, knowledge, files, notifications, integrations, sessions, aiThreads: [] };
}
