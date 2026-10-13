// The sample workspace behind "Explore the demo" in the desktop and tablet apps (src/appMode/demo).
// Same people and story as the phone app's demo (mobile/src/data/demo/seed.js), in the shapes the
// Oruinwan server returns. Every time is relative to "now", so it always looks current.
// Content is original and fictional.

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** 24-hex ids, like the server's ObjectIds (the client checks for that shape). */
export const demoId = (group, n) => `de${group}${String(n).padStart(20, '0')}`;

export const WORKSPACE_ID = demoId('b0', 1);
export const ME = demoId('a0', 1);

export function buildDemoSeed(now = Date.now()) {
  const ago = (ms) => new Date(now - ms).toISOString();
  const ahead = (ms) => new Date(now + ms).toISOString();

  const people = [
    { key: 'me', username: 'Sam', name: 'Sam Carter', email: 'sam@oruinwan.demo', jobTitle: 'Product lead', status: 'online', role: 'owner' },
    { key: 'priya', username: 'Priya', name: 'Priya Nair', email: 'priya@oruinwan.demo', jobTitle: 'Engineering manager', status: 'online', role: 'admin' },
    { key: 'daniel', username: 'Daniel', name: 'Daniel Okafor', email: 'daniel@oruinwan.demo', jobTitle: 'Backend engineer', status: 'away', role: 'member' },
    { key: 'mei', username: 'Mei', name: 'Mei Lin', email: 'mei@oruinwan.demo', jobTitle: 'Product designer', status: 'online', role: 'member' },
    { key: 'lucas', username: 'Lucas', name: 'Lucas Moreau', email: 'lucas@oruinwan.demo', jobTitle: 'Mobile engineer', status: 'busy', role: 'member' },
    { key: 'aisha', username: 'Aisha', name: 'Aisha Rahman', email: 'aisha@oruinwan.demo', jobTitle: 'QA lead', status: 'offline', role: 'member' },
    { key: 'tomas', username: 'Tomás', name: 'Tomás Silva', email: 'tomas@oruinwan.demo', jobTitle: 'DevOps', status: 'online', role: 'member' },
  ].map((p, i) => ({ ...p, id: demoId('a0', i + 1) }));
  const user = Object.fromEntries(people.map((p) => [p.key, p]));

  const workspace = {
    id: WORKSPACE_ID,
    name: 'Oruinwan Labs',
    description: 'Everything we build and ship',
    icon: '🚀',
    color: '#b8956a',
    createdAt: ago(90 * DAY),
  };

  const channels = [
    { key: 'general', name: 'general', description: 'Company-wide chatter and wins', members: people.map((p) => p.key), isDefault: true, read: true },
    { key: 'announcements', name: 'announcements', description: 'Updates from leads', members: people.map((p) => p.key), postingPolicy: 'admins', unread: 1 },
    { key: 'engineering', name: 'engineering', description: 'Builds, reviews and incidents', members: ['me', 'priya', 'daniel', 'lucas', 'tomas', 'aisha'], unread: 3 },
    { key: 'mobile', name: 'mobile-launch', description: 'Android 1.0: ship it carefully', members: ['me', 'lucas', 'mei', 'aisha', 'priya'], isPrivate: true, unread: 2 },
    { key: 'design', name: 'design-review', description: 'Post work in progress, get eyes on it', members: ['me', 'mei', 'lucas', 'priya'], read: true },
    { key: 'random', name: 'random', description: 'Coffee, music, cat photos', members: people.map((p) => p.key), unread: 2 },
  ].map((c, i) => ({ ...c, id: demoId('c0', i + 1), createdAt: ago((60 - i) * DAY) }));
  const channel = Object.fromEntries(channels.map((c) => [c.key, c]));

  const dms = [
    { key: 'priya', other: 'priya', unread: 2 },
    { key: 'lucas', other: 'lucas', unread: 0 },
    { key: 'mei', other: 'mei', unread: 1 },
    { key: 'daniel', other: 'daniel', unread: 0 },
  ].map((d, i) => ({ ...d, id: demoId('d0', i + 1) }));
  const dm = Object.fromEntries(dms.map((d) => [d.key, d]));

  let n = 0;
  const msg = (where, author, text, at, extra = {}) => ({
    id: demoId('e0', (n += 1)),
    channelId: where.startsWith('#') ? channel[where.slice(1)].id : null,
    dmId: where.startsWith('@') ? dm[where.slice(1)].id : null,
    author: user[author].id,
    text,
    createdAt: ago(at),
    reactions: [],
    ...extra,
  });
  const react = (emoji, ...who) => who.map((k) => ({ emoji, userId: user[k].id }));

  const releaseThread = msg('#engineering', 'priya', 'Reminder: code freeze for the mobile release is Thursday 18:00. Anything not merged by then rolls to 1.1.', 3 * HOUR);
  const settingsThread = msg('#design', 'mei', 'Settings redesign: grouped rows, one icon family, destructive actions always confirm. Thoughts?', 20 * HOUR);

  const messages = [
    msg('#engineering', 'tomas', 'Staging is green again. The flaky socket test was a race in the reconnect handler.', 5 * HOUR),
    msg('#engineering', 'daniel', 'Nice. I pushed the pagination fix for threads: `before` cursors now use the message id, not the timestamp.', 4 * HOUR, { reactions: react('🎉', 'priya', 'tomas') }),
    releaseThread,
    msg('#engineering', 'lucas', 'Android build is down to 3.6 MB. Capacitor and the system WebView instead of bundling a browser engine.', 90 * MIN, { reactions: react('🔥', 'me', 'tomas', 'priya') }),
    msg('#engineering', 'daniel', '```\nGET /api/v2/messages/channel/:id?limit=40&before=<id>\n```\nSame shape for DMs. The apps reuse the web client paging.', 45 * MIN),
    msg('#engineering', 'aisha', '@Sam can you sign off the release checklist once QA finishes the update flow? Last item.', 12 * MIN),

    msg('#mobile', 'mei', 'Final icon set is in Figma: one stroke weight everywhere, 1.75px.', 26 * HOUR),
    msg('#mobile', 'lucas', 'In-app updates work end to end: the app checks the release manifest, downloads the APK, verifies the checksum and hands it to the installer.', 7 * HOUR, { reactions: react('👏', 'me', 'aisha') }),
    msg('#mobile', 'aisha', 'Tested on Android 16 and 12, phones and tablets. Tablets get the full workspace now, phones the phone app.', 3 * HOUR),
    msg('#mobile', 'priya', 'Let us keep huddles behind the remote flag for 1.0 and roll it to 10% next week.', 30 * MIN),

    msg('#general', 'priya', 'Welcome Tomás to the team! 👋', 3 * DAY, { reactions: react('👋', 'me', 'mei', 'daniel', 'lucas') }),
    msg('#general', 'tomas', 'Thanks all, happy to be here. Ping me for anything infra.', 3 * DAY - 20 * MIN),
    msg('#general', 'mei', 'Friday demo moved to 16:00 so the London folks can join.', 6 * HOUR),

    msg('#announcements', 'priya', 'Oruinwan 1.2 is out: the desktop apps and tablets run the full workspace, and iPhone and iPad are coming through TestFlight. Report anything odd in #mobile-launch.', 2 * HOUR),

    settingsThread,

    msg('#random', 'daniel', 'Who left the oat milk in the fridge with a label that says "do not touch: production"?', 2 * HOUR),
    msg('#random', 'tomas', 'Infra owns it now. It has an SLA.', 100 * MIN, { reactions: react('😂', 'daniel', 'mei', 'priya') }),

    msg('@priya', 'priya', 'Have a minute today to go through the rollout plan?', 50 * MIN),
    msg('@priya', 'priya', 'Mostly the staged rollout for huddles and who gets 1.3 first.', 48 * MIN),
    msg('@lucas', 'me', 'Signed APK verified with apksigner: permanent key, not the debug one.', 5 * HOUR),
    msg('@lucas', 'lucas', 'Perfect. Then updates install over the top without uninstalling.', 4 * HOUR),
    msg('@mei', 'me', 'Does the tablet layout need its own spacing scale?', 75 * MIN),
    msg('@mei', 'mei', 'No, it uses the desktop one. Tablets get the same workspace as the desktop app.', 70 * MIN),
    msg('@daniel', 'daniel', 'Thread endpoints are deployed. Let me know if the apps need anything else.', DAY),
  ];

  const replies = [
    msg('#engineering', 'lucas', 'Mobile is on track. Only the release notes left.', 2.5 * HOUR, { parentId: releaseThread.id }),
    msg('#engineering', 'aisha', 'QA will finish regression Wednesday night.', 2.2 * HOUR, { parentId: releaseThread.id }),
    msg('#engineering', 'lucas', 'I will tag the release right after freeze.', 2 * HOUR, { parentId: releaseThread.id }),
    msg('#design', 'me', 'Love it. Can the danger zone live at the very bottom?', 19 * HOUR, { parentId: settingsThread.id }),
    msg('#design', 'lucas', '+1, and a two-step confirm for delete.', 18 * HOUR, { parentId: settingsThread.id }),
  ];

  const task = (t, i) => ({
    id: demoId('f0', i + 1),
    issueKey: `OL-${i + 1}`,
    description: '',
    createdBy: user[t.by || 'priya'].id,
    assignees: (t.to || ['me']).map((k) => user[k].id),
    createdAt: ago((14 - i) * DAY),
    updatedAt: ago((i + 1) * HOUR),
    dueDate: null,
    ...t,
  });
  const tasks = [
    { title: 'Sign off the release checklist', status: 'review', priority: 'highest', dueDate: ahead(4 * HOUR), description: 'Go through every item in the release checklist note and tick it off. Blockers go in #mobile-launch.', tags: ['release'] },
    { title: 'Write release notes for 1.2', status: 'in_progress', priority: 'high', dueDate: ahead(DAY), by: 'me', description: 'Short and friendly: install, updates, what is new, known limitations.', tags: ['release'] },
    { title: 'Staged rollout plan for huddles', status: 'todo', priority: 'medium', dueDate: ahead(3 * DAY), by: 'me', tags: ['huddles'] },
    { title: 'Review thread pagination PR', status: 'todo', priority: 'medium', dueDate: ago(DAY), by: 'daniel', tags: ['platform'] },
    { title: 'Tablet layout pass on iPad mini', status: 'in_progress', priority: 'high', dueDate: ahead(2 * DAY), by: 'me', to: ['mei'], tags: ['design'] },
    { title: 'Regression pass on Android 12 to 16', status: 'in_progress', priority: 'high', dueDate: ahead(2 * DAY), to: ['aisha'], tags: ['qa'] },
    { title: 'Fix socket reconnect race on staging', status: 'done', priority: 'high', dueDate: ago(DAY), to: ['tomas'], tags: ['platform'] },
    { title: 'Push notifications for phones', status: 'backlog', priority: 'high', to: ['daniel', 'lucas'], tags: ['mobile'] },
    { title: 'Update onboarding copy', status: 'blocked', priority: 'low', dueDate: ahead(5 * DAY), to: ['mei'], blockedReason: 'Waiting on legal review' },
    { title: 'Prepare Friday demo', status: 'todo', priority: 'low', dueDate: ahead(4 * DAY), by: 'me', tags: ['team'] },
    { title: 'Book the offsite venue', status: 'done', priority: 'low', dueDate: ago(3 * DAY), by: 'me', tags: ['team'] },
  ].map(task);

  const block = (type, content, meta = {}) => ({ type, content, meta });
  const checklist = (...items) => block('checklist', JSON.stringify(items.map(([text, done], i) => ({ id: `c${i}`, text, done }))));
  const note = (n, i) => ({ id: demoId('f1', i + 1), createdAt: ago((30 - i) * DAY), tags: [], ...n, content: JSON.stringify(n.blocks) });
  const notes = [
    {
      title: 'Release checklist', type: 'sop', isPinned: true, owner: 'me', updatedAt: ago(2 * HOUR), tags: ['release'],
      blocks: [
        block('heading', 'Before tagging', { level: 2 }),
        checklist(['Version bumped in mobile/package.json', true], ['Lint, tests and builds are green', true], ['Release notes written', false], ['QA sign-off on phones and tablets', false]),
        block('heading', 'After publishing', { level: 2 }),
        checklist(['Download each installer and check it opens', false], ['Check the Android update offer on a phone', false], ['Announce in #announcements', false]),
      ],
    },
    {
      title: 'Sprint 14 planning', type: 'meeting', owner: 'priya', updatedAt: ago(DAY),
      blocks: [
        block('text', 'Attendees: Priya, Sam, Lucas, Daniel, Aisha'),
        block('heading', 'Goals', { level: 2 }),
        block('text', '1. Ship the desktop and tablet apps\n2. Thread pagination on the server\n3. Plan push notifications for phones'),
        block('heading', 'Decisions', { level: 2 }),
        block('callout', 'Huddles stay behind a remote flag. Code freeze Thursday 18:00.', { variant: 'info' }),
      ],
    },
    {
      title: 'In-app updates', type: 'techdesign', owner: 'lucas', updatedAt: ago(3 * DAY),
      blocks: [
        block('text', 'The apps read a small manifest (version, download links, SHA-256, minimum version). If newer, they offer the update; below the minimum, the phone app blocks until updated.'),
        block('heading', 'Why a checksum', { level: 2 }),
        block('text', 'The installer already checks the signature. The checksum also catches truncated downloads before Android shows a confusing error.'),
      ],
    },
    {
      title: 'Onboarding ideas', type: 'brainstorm', owner: 'mei', updatedAt: ago(5 * DAY),
      blocks: [
        block('callout', 'Capture every idea, refine later.', { variant: 'info' }),
        checklist(['Explore a demo workspace before signing in', true], ['One screen to connect to a self-hosted server', true], ['Explain end-to-end encryption in one sentence', false]),
      ],
    },
    {
      title: 'Scratchpad', type: 'note', owner: 'me', updatedAt: ago(30 * MIN),
      blocks: [block('text', 'Ask Priya about rollout percentages for 1.3.'), block('text', 'Idea: AI summary of unread channels on Home.')],
    },
  ].map(note);

  return { now, people, user, workspace, channels, dms, messages, replies, tasks, notes };
}
