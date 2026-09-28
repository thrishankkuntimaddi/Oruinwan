// Notifications: the rules, settings, quiet, email, mobile push.
export default {
    id: 'notifications',
    title: 'Notifications',
    icon: 'Bell',
    blurb: 'How Oruinwan decides when to alert you, and how to tune it per workspace, per conversation and per device.',
    pages: [
        {
            id: 'how-it-works',
            title: 'How notifications work',
            summary: 'Nothing for the chat you are looking at, a toast for DMs and mentions elsewhere, one OS notification per conversation when you are away.',
            keywords: 'notification notifications rules toast os desktop bell badge viewing background focus tab alert how',
            blocks: [
                'Oruinwan tries to alert you only when it matters. What happens to a new message depends on **where your attention is**:',
                { figure: 'notify-rules', caption: 'The same new message, three situations.' },
                { table: { caption: 'Notification rules', head: ['You are…', 'What happens'], rows: [
                    ['Looking at that conversation (or that thread) in the active window', 'Nothing pops up. The message is on screen, so it is marked read.'],
                    ['Elsewhere in Oruinwan, window active', 'A quiet in-app toast, but only for **DMs** and **@mentions**. Several messages from one conversation within a few seconds share one toast (“3 new messages from Maya”). Never an OS notification.'],
                    ['Away: the tab is hidden or another app has focus', 'An OS (desktop) notification, if you allowed them: **one per conversation**, replaced as new messages arrive, and shown by only one of your open tabs.'],
                    ['Another Oruinwan tab is the active one', 'That tab decides; the others just update their counters.'],
                ] } },
                { h: 'The bell' },
                'Everything lands in the **bell** (the notifications list), including things that never pop up: reactions, edits, deleted messages. Task, meeting and note notifications also show a toast unless you already have that page open, and an OS notification when you are away.',
                { h: 'Thread replies and reminders' },
                { list: [
                    'Thread replies never show a toast (they are not DMs or mentions); you get an OS notification when you are away, unless the thread is open on screen.',
                    'A **Remind me** reminder always alerts you: a toast when you are active, an OS notification when you are away.',
                ] },
                { h: 'Channels vs DMs' },
                { list: [
                    'In **channels**, only messages that mention you (by name, `@here` or `@channel`) alert you. Other messages just update the unread count.',
                    'In **DMs**, every message alerts you, unless you turned off direct message notifications or muted the DM.',
                ] },
            ],
        },
        {
            id: 'settings',
            title: 'Notification settings',
            summary: 'Desktop alerts, sound, mentions-only, email, and per-workspace choices.',
            keywords: 'notification settings desktop alerts sound mentions only direct messages test email digest product news workspace',
            blocks: [
                { h: 'Your account: Settings → Notifications' },
                { table: { caption: 'Account notification settings', head: ['Setting', 'What it does'], rows: [
                    ['Desktop notifications', 'Allow OS notifications when Oruinwan is in the background. Your browser asks for permission the first time. Use **Send a test** to check.'],
                    ['Sound', 'Play the system sound with notifications.'],
                    ['Only mentions and direct messages', 'Mute pop-ups for everything else (tasks, meetings, reactions…). They still appear in the bell.'],
                    ['Activity digest (email)', 'A summary of what you missed, sent to your inbox.'],
                    ['Product news (email)', 'Tips, offers and Oruinwan news.'],
                ] } },
                { h: 'Per workspace' },
                '**Workspace notifications** (the link in Settings, or the settings tab on the Notifications page) chooses which activity notifies you in the current workspace:',
                { list: [
                    '**Messages & Mentions**: new messages, @mentions and DMs.',
                    '**Thread Replies**: replies in threads you follow.',
                    '**Tasks**: assignments, status changes and due date reminders.',
                    '**Meetings**: scheduled meetings and reminders.',
                    '**Email Notifications**: email for important events (task assigned, meeting).',
                    '**Desktop Push**: OS notifications when the app is in the background.',
                ] },
            ],
        },
        {
            id: 'quiet',
            title: 'Mute and Do not disturb',
            summary: 'Silence one conversation, or everything for a while.',
            keywords: 'mute do not disturb dnd quiet silence status pause',
            blocks: [
                { list: [
                    '**Mute a DM**: header menu → **Mute Notifications**. A muted DM never alerts you.',
                    '**Muted channels** alert you only for a direct `@name` mention, never for `@channel` or `@here`.',
                    '**Do not disturb**: set your status from your profile menu to pause everything for a while.',
                    '**Desktop app**: the tray menu has its own **Do Not Disturb** and **Notifications on/off**.',
                ] },
            ],
        },
        {
            id: 'mobile-push',
            title: 'Mobile push notifications',
            summary: 'Push to your phone only when you are not active on the web, and silent for the chat already on screen.',
            keywords: 'mobile push phone ios android expo notification',
            blocks: [
                { list: [
                    'The mobile app registers for push notifications on a physical phone (not in a simulator or on the web).',
                    'The server sends a push only when you are **not actively using** Oruinwan on the web, so you are not alerted twice.',
                    'A push about the conversation already open on your phone stays silent.',
                    'Turn pushes off per workspace with **Desktop Push** in workspace notification settings, or in your phone’s settings.',
                ] },
                { callout: 'note', text: 'Push uses Expo’s push service to reach Apple and Google. See [Desktop and mobile apps](/docs/platforms/apps).' },
            ],
        },
    ],
};
