/**
 * Oruinwan help content: one source for the in-app Help panel
 * (components/help), the profile menu's help search and the public /help page.
 *
 * Every claim here was checked against the app (routes in App.js, Settings tabs
 * in pages/Settings.jsx, the feature components). When a feature changes,
 * update its article here.
 *
 * Article: { id, topic, title, summary, body, keywords, appPath?, appLabel? }
 *   body blocks: 'paragraph' | { steps: [] } | { list: [] } | { note: '' }
 *   (**bold** and `code` are rendered inside text)
 *   appPath: absolute ('/settings?tab=security') or workspace-relative ('tasks').
 */

export const TOPICS = [
    { id: 'getting-started', title: 'Getting started', blurb: 'Create a workspace, invite your team and join with an invite link.' },
    { id: 'messaging', title: 'Messaging', blurb: 'Channels, direct messages, threads, mentions and everything you can do with a message.' },
    { id: 'ai', title: 'Oruinwan AI', blurb: 'Ask the assistant in any chat or in the AI panel, teach it what to remember, and review code.' },
    { id: 'tasks', title: 'Tasks', blurb: 'Plan work on a list, board, sprint or timeline, and turn messages into tasks.' },
    { id: 'notes', title: 'Notes', blurb: 'Write with blocks, share with people or the whole workspace, and use AI writing tools.' },
    { id: 'huddles', title: 'Huddles & meetings', blurb: 'Start a voice or video huddle, or schedule a meeting.' },
    { id: 'files', title: 'Files & knowledge', blurb: 'Find shared files and build the workspace knowledge base.' },
    { id: 'notifications', title: 'Notifications', blurb: 'Choose what alerts you, how, and when to stay quiet.' },
    { id: 'security', title: 'Security & privacy', blurb: 'Encryption, two-factor sign-in, devices and privacy controls.' },
    { id: 'account', title: 'Account & data', blurb: 'Profile, emails, password, data export, retention, deactivation and deletion.' },
];

export const ARTICLES = [
    // ── Getting started ────────────────────────────────────────────────────
    {
        id: 'create-workspace',
        topic: 'getting-started',
        title: 'Create a workspace',
        summary: 'Start a new workspace from the workspace list, from a template or blank.',
        keywords: 'new workspace create start template blank setup',
        appPath: '/workspaces',
        appLabel: 'Go to your workspaces',
        body: [
            'A workspace is where a team talks, plans and keeps its knowledge. You can belong to several and switch between them on the **Workspaces** page.',
            { steps: [
                'Open **Workspaces** and choose **Create New Workspace**.',
                'Pick a template, or **Blank workspace**.',
                'Give it a name and an optional description, then choose an icon and a color.',
                'Confirm the owner responsibilities.',
                'Invite your team by entering email addresses (separated by commas or new lines), or choose **Skip & Launch** and invite people later.',
            ] },
            { note: 'Personal accounts can own up to 3 workspaces. In company accounts, members may not be allowed to create workspaces; ask your admin.' },
        ],
    },
    {
        id: 'invite-people',
        topic: 'getting-started',
        title: 'Invite people to a workspace',
        summary: 'Send email invites or share a one-time invite link.',
        keywords: 'invite add member teammate email link share join',
        appPath: 'home',
        body: [
            { steps: [
                'Open the workspace and click the workspace name at the top of the Home panel.',
                'Choose **Invite people**.',
                'Under **Invite via**, pick **Email address** to send invitations, or **Shareable link** to copy a link.',
            ] },
            'Each shareable link is one-time use and expires after 7 days. Pending invites are listed in the same dialog, where you can revoke them.',
            { note: 'If a workspace admin has turned off member invites, only admins can invite.' },
        ],
    },
    {
        id: 'join-workspace',
        topic: 'getting-started',
        title: 'Join a workspace with an invite',
        summary: 'Open the invite link, or paste it into “Join a workspace”.',
        keywords: 'join invite link accept token',
        appPath: '/workspaces',
        appLabel: 'Go to your workspaces',
        body: [
            'Opening an invite link shows who invited you, how many members the workspace has and the role you will get. Sign in (or create an account) and accept.',
            'Already signed in? On the **Workspaces** page choose **Join a workspace** and paste the invite link.',
            'Company invitations sent by email take you to a page where you set your name and password first.',
        ],
    },

    // ── Messaging ──────────────────────────────────────────────────────────
    {
        id: 'channels',
        topic: 'messaging',
        title: 'Channels: public and private',
        summary: 'Create a channel for a topic or team and decide who can find it.',
        keywords: 'channel create public private discoverable announcement members',
        appPath: 'channels',
        body: [
            'Open **Channels** in the sidebar and choose **Create channel**.',
            { list: [
                '**Public**: anyone in the workspace can join. Tick **Discoverable** so others can find it.',
                '**Private**: only people who are added can see it.',
            ] },
            'Use the channel header menu for **Channel info**, **Manage channel**, **View members** and **Copy channel link**. Channels also have tabs for **Threads**, **Tasks** and **Canvas**.',
            { note: 'Admins can make a channel announcement-only (only admins post) and limit who may use @channel and @here.' },
        ],
    },
    {
        id: 'direct-messages',
        topic: 'messaging',
        title: 'Direct messages',
        summary: 'Start a private conversation with one person.',
        keywords: 'dm direct message private chat new message mute',
        appPath: 'messages',
        body: [
            'Open **Messages** and choose **New message**, then pick a person.',
            'In the conversation header you can **Mute notifications** or **View profile**.',
        ],
    },
    {
        id: 'threads',
        topic: 'messaging',
        title: 'Reply in a thread',
        summary: 'Keep side conversations tidy by replying under a message.',
        keywords: 'thread reply replies side conversation resolve summarize',
        body: [
            'Hover a message and choose **Reply in thread**. The thread opens next to the conversation.',
            'Channels have a **Threads** tab listing their threads. Threads can be marked resolved, and **Summarize thread** (in a message’s More menu) asks Oruinwan AI for a recap.',
        ],
    },
    {
        id: 'mentions',
        topic: 'messaging',
        title: 'Mention people, @here and @channel',
        summary: 'Type @ to notify someone, everyone online, or the whole channel.',
        keywords: 'mention @ at notify here channel everyone tag',
        body: [
            'Type `@` in the composer and choose from the list. Press **Enter** or **Tab** to pick the highlighted suggestion.',
            { list: [
                '`@name` notifies that person.',
                '`@here` notifies members who are online.',
                '`@channel` notifies everyone in the channel.',
                '`@Oruinwan` asks Oruinwan AI to answer in the conversation.',
            ] },
        ],
    },
    {
        id: 'message-actions',
        topic: 'messaging',
        title: 'React, forward, copy and more',
        summary: 'Everything in a message’s hover toolbar and More menu.',
        keywords: 'reaction emoji react forward copy message info delete more menu actions',
        body: [
            'Hover a message to **React**, **Reply in thread**, **Forward** or open **More**. The More menu also has **Copy text**, **Translate**, **Pin**, **Save**, **Remind me**, **Convert to task**, **Message info**, and **Edit** / **Delete** for your own messages.',
            '**Delete for me** hides a message only for you. **Delete for everyone** is available to the sender and channel admins.',
        ],
    },
    {
        id: 'edit-history',
        topic: 'messaging',
        title: 'Edit a message and see its history',
        summary: 'Fix a message you sent; earlier versions stay visible in Edit history.',
        keywords: 'edit change fix typo edited history versions',
        body: [
            'Open **More → Edit message** on a text message you sent. Press **Enter** to save or **Esc** to cancel.',
            'Edited messages show **Edit history** in their More menu so anyone in the conversation can see what changed.',
        ],
    },
    {
        id: 'pin-save',
        topic: 'messaging',
        title: 'Pin and save messages',
        summary: 'Pin for everyone in the conversation; save for yourself.',
        keywords: 'pin pinned save saved bookmark bookmarks star',
        body: [
            '**Pin message** (in More) keeps a message at hand for everyone in that conversation. Open the **Pinned messages** icon in the conversation header to see them; the list opens inside the conversation.',
            '**Save message** is private to you. The **Saved** icon in the header lists everything you have saved across conversations.',
        ],
    },
    {
        id: 'reminders',
        topic: 'messaging',
        title: 'Remind me about a message',
        summary: 'Get a notification to come back to a message later.',
        keywords: 'remind reminder later snooze follow up',
        body: [
            'Open **More → Remind me** and choose **In 20 minutes**, **In 1 hour**, **In 3 hours**, **Tomorrow at 9:00**, **Next week (Monday 9:00)** or a custom date and time. You can add a note.',
            'When it is time, you get a notification. Your upcoming reminders are listed under the **Reminders** icon in the conversation header.',
        ],
    },
    {
        id: 'translate',
        topic: 'messaging',
        title: 'Translate a message',
        summary: 'Read a message in another language with one click.',
        keywords: 'translate translation language spanish french german hindi arabic chinese japanese portuguese auto-translate',
        appPath: '/settings?tab=region',
        appLabel: 'Open Language & region',
        body: [
            'Open **More → Translate** and pick Spanish, French, German, Hindi, Arabic, Chinese, Japanese or Portuguese. Choose **Show original** to switch back.',
            'To translate incoming messages automatically, turn on **Auto-translate messages** in **Settings → Language & region**.',
            { note: 'Translation uses Oruinwan AI, so AI must be turned on for the workspace.' },
        ],
    },
    {
        id: 'slash-commands',
        topic: 'messaging',
        title: 'Slash commands',
        summary: 'Type / in the composer to start a call, a poll, a code block and more.',
        keywords: 'slash command / call video meet poll code shrug ai',
        body: [
            'Type `/` at the start of a message to see the commands:',
            { list: [
                '`/call`: start a voice huddle.',
                '`/video`: start a video call.',
                '`/meet`: schedule a meeting.',
                '`/poll`: create a poll (when polls are enabled for the workspace).',
                '`/code [language]`: insert a code block.',
                '`/shrug [message]`: add ¯\\_(ツ)_/¯.',
                '`/ai <question>`: ask in the Oruinwan AI panel.',
            ] },
            'In threads, only `/ai` is available.',
        ],
    },

    // ── Oruinwan AI ────────────────────────────────────────────────────────
    {
        id: 'ai-in-chats',
        topic: 'ai',
        title: 'Ask @Oruinwan in a conversation',
        summary: 'Mention @Oruinwan in a channel, DM or thread and it answers right there.',
        keywords: 'ai assistant mention @oruinwan @ai ask chat answer bot',
        body: [
            'Type `@Oruinwan` (or `@ai`) followed by your question, or use the **Ask Oruinwan AI** button in the composer, which adds the mention for you. The answer streams into the conversation as a message from Oruinwan AI.',
            'In shared conversations it only uses information everyone in that conversation can see. Your personal memory is never used there.',
        ],
    },
    {
        id: 'ai-follow-ups',
        topic: 'ai',
        title: 'Follow-up questions without mentioning again',
        summary: 'After it answers, your next message goes to the AI for 10 minutes.',
        keywords: 'follow up follow-up continue conversation ai no mention',
        body: [
            'After Oruinwan AI answers you, a banner says **Continuing with Oruinwan AI**. For the next 10 minutes your next message in that chat (or that thread) goes to the AI without a mention.',
            'It stops when you press **Stop** on the banner, when someone else posts there, or when you @mention a person.',
        ],
    },
    {
        id: 'ai-panel',
        topic: 'ai',
        title: 'The Oruinwan AI panel',
        summary: 'A private assistant chat beside your workspace.',
        keywords: 'ai panel assistant private chat toggle shortcut stream stop',
        body: [
            'Open it with the Oruinwan AI button in the top bar, with **Cmd/Ctrl + Shift + A**, or by typing `/ai <question>` in a composer.',
            'Answers stream in live, and you can press **Stop** at any time. Here the assistant can use your personal memory and search the workspace’s notes, tasks and knowledge pages you can see.',
        ],
    },
    {
        id: 'ai-memory',
        topic: 'ai',
        title: 'Teach it to remember (and forget)',
        summary: 'Say “remember …” or “forget …”, or manage memory in Settings.',
        keywords: 'memory remember forget personal preferences ai settings clear',
        appPath: '/settings?tab=ai',
        appLabel: 'Open Oruinwan AI settings',
        body: [
            'In the AI panel, say for example “remember that I prefer short answers” or “forget my old project name”.',
            'Go to **Settings → Oruinwan AI → Memory** to add, edit or remove memories, choose whether each one applies to **All workspaces** or **This workspace only**, or **Clear all**.',
            { note: 'Memory is private to you. It is used in your AI panel chats, never in answers posted to shared conversations.' },
        ],
    },
    {
        id: 'ai-code-review',
        topic: 'ai',
        title: 'Review code with AI',
        summary: 'Get a review of code someone posted in a message.',
        keywords: 'code review ai bug snippet programming',
        body: [
            'On a message that contains code, open **More → Review code with AI**. You can also paste code in the AI panel and ask for a review.',
        ],
    },
    {
        id: 'ai-knowledge',
        topic: 'ai',
        title: 'Ask about your workspace',
        summary: 'The assistant searches notes, tasks and knowledge pages by meaning.',
        keywords: 'knowledge search workspace find ai notes tasks pages semantic',
        body: [
            'Ask questions like “what did we decide about the launch date?”. Oruinwan AI searches the notes, tasks and knowledge pages you have access to, by meaning rather than exact words.',
            'Messages are end-to-end encrypted, so they are never indexed for AI search.',
        ],
    },
    {
        id: 'ai-engine',
        topic: 'ai',
        title: 'Where Oruinwan AI runs',
        summary: 'On Oruinwan’s own AI engine, not a third-party AI service.',
        keywords: 'engine privacy model third party provider data ai runs where',
        appPath: '/settings?tab=ai',
        appLabel: 'Open Oruinwan AI settings',
        body: [
            'Oruinwan AI runs on the Oruinwan Engine, our own AI engine. By default your questions are not sent to any third-party AI service.',
            'Workspace admins can see the engine’s status and usage in **Settings → Oruinwan AI**, and turn AI features on or off for the workspace. If an admin connects an outside AI provider to a workspace, Oruinwan AI tells you so there.',
        ],
    },

    // ── Tasks ──────────────────────────────────────────────────────────────
    {
        id: 'tasks-basics',
        topic: 'tasks',
        title: 'Create and track tasks',
        summary: 'Statuses, priorities and the task lists in the sidebar.',
        keywords: 'task create new status priority backlog todo in progress review blocked done cancelled assign',
        appPath: 'tasks',
        body: [
            'Open **Tasks** and create a task with a title, and optionally a description, assignee, priority and due date. Types are Task, Bug, Epic and Subtask.',
            'Statuses: **Backlog**, **To do**, **In progress**, **In review**, **Blocked**, **Done** and **Cancelled**. Priorities go from Lowest to Highest.',
            'The sidebar lists **My issues**, **Incoming**, **Given**, **All issues**, **Completed** and **Trash**.',
        ],
    },
    {
        id: 'tasks-views',
        topic: 'tasks',
        title: 'List, board, sprint, timeline and workload',
        summary: 'See the same tasks in the view that fits the job.',
        keywords: 'board kanban sprint timeline gantt workload list view',
        appPath: 'tasks',
        body: [
            'Switch views at the top of Tasks: **List**, **Board** (columns by status), **Sprint**, **Timeline** and **Workload** (who has what).',
        ],
    },
    {
        id: 'message-to-task',
        topic: 'tasks',
        title: 'Turn a message into a task',
        summary: 'Convert to task keeps the work linked to the conversation.',
        keywords: 'convert message task create from chat',
        body: [
            'Open **More → Convert to task** on a message, then fill in the title, description, priority and an optional due date. The message then shows a badge linking to the task.',
            'Each channel also has a **Tasks** tab for the tasks that belong to it.',
        ],
    },

    // ── Notes ──────────────────────────────────────────────────────────────
    {
        id: 'notes',
        topic: 'notes',
        title: 'Write notes with blocks',
        summary: 'Type / for headings, checklists, tables, code, media and more.',
        keywords: 'note notes write blocks slash heading checklist table code template favorite pdf history',
        appPath: 'notes',
        body: [
            'In an empty line, type `/` to insert a block: text, headings, code, checklist, toggle, callout, divider, table, image, video, audio or file.',
            'Start from a template, star notes as favorites, duplicate them, copy a link, download as PDF, or restore an earlier version from the history.',
            'AI tools can summarize, extract action items, expand bullets, rewrite professionally, proofread, shorten or continue writing.',
        ],
    },
    {
        id: 'share-notes',
        topic: 'notes',
        title: 'Share a note',
        summary: 'Keep it private, share with people, or open it to the workspace.',
        keywords: 'share note permission view edit workspace private',
        appPath: 'notes',
        body: [
            'As the owner, choose **Share** on a note. Set visibility to **Private** or **Workspace** (every member can view), add specific people, and decide whether they can **View** or **Edit**.',
            'Changes appear for others as they are saved.',
        ],
    },

    // ── Huddles ────────────────────────────────────────────────────────────
    {
        id: 'huddles',
        topic: 'huddles',
        title: 'Start, join or schedule a huddle',
        summary: 'Voice and video calls from the Huddles page or any conversation.',
        keywords: 'huddle call voice video meeting schedule join start',
        appPath: 'huddles',
        body: [
            'Open **Huddles** to **Start a huddle** or **Schedule a meeting**. The page shows what is **Live now**, **Scheduled** and **Recent**; select a live huddle to join it.',
            'From a conversation, use the call buttons in the header, or type `/call`, `/video` or `/meet`.',
        ],
    },

    // ── Files & knowledge ──────────────────────────────────────────────────
    {
        id: 'files',
        topic: 'files',
        title: 'Find and manage files',
        summary: 'Every file shared in the workspace, with details, comments and versions.',
        keywords: 'files upload attachment document search version comment',
        appPath: 'files',
        body: [
            'Open **Files** to search everything shared in the workspace. Open a file to see its size, type, tags and upload date, leave comments, and view its version history.',
        ],
    },
    {
        id: 'knowledge',
        topic: 'files',
        title: 'Build the knowledge base',
        summary: 'Linked Markdown pages with an AI summary and a graph view.',
        keywords: 'knowledge base wiki page markdown graph link docs',
        appPath: 'knowledge',
        body: [
            'Open **Knowledge** and choose **New page**. Pages are written in Markdown with a preview and can have tags.',
            'Use **Link a page** to connect related pages, **AI summary** for a quick recap, and the **Knowledge graph** to see how pages connect. Oruinwan AI can search these pages when you ask about your workspace.',
        ],
    },

    // ── Notifications ──────────────────────────────────────────────────────
    {
        id: 'notification-settings',
        topic: 'notifications',
        title: 'Choose your notifications',
        summary: 'Desktop alerts, sounds, email digests and per-workspace settings.',
        keywords: 'notifications desktop alerts sound email digest mentions direct messages test',
        appPath: '/settings?tab=notifications',
        appLabel: 'Open Notifications settings',
        body: [
            'In **Settings → Notifications** turn on **Desktop notifications**, choose whether you hear **Sound**, and whether you are alerted for everything or **Only mentions and direct messages**. Use **Send a test** to check it works.',
            'Under email, choose the **Activity digest** and **Product news**. **Workspace notifications** opens the settings for a specific workspace.',
        ],
    },
    {
        id: 'quiet',
        topic: 'notifications',
        title: 'Mute a conversation or go Do not disturb',
        summary: 'Silence one conversation, or everything for a while.',
        keywords: 'mute do not disturb dnd quiet silence status',
        body: [
            'In a direct message, open the header menu and choose **Mute notifications**. Muted channels only notify you when you are @mentioned directly.',
            'To pause everything, set your status to **Do not disturb** from your profile menu.',
        ],
    },

    // ── Security & privacy ─────────────────────────────────────────────────
    {
        id: 'encryption',
        topic: 'security',
        title: 'How your messages are encrypted',
        summary: 'Messages are encrypted in your browser before they are sent.',
        keywords: 'encryption e2ee end-to-end encrypted aes security keys unlock password',
        body: [
            'Messages are encrypted on your device with AES-256-GCM before they leave it, using a key for each conversation. Oruinwan’s servers store message text only in encrypted form, which is why messages are never indexed for search or AI.',
            'Your encryption keys are protected with your password. On a new browser you may be asked for your password to unlock your messages.',
            'So that new members can read a conversation they join, Oruinwan keeps a protected copy of each conversation key on its servers.',
        ],
    },
    {
        id: 'two-factor',
        topic: 'security',
        title: 'Turn on two-factor sign-in',
        summary: 'Use an authenticator app for a 6-digit code at every sign-in.',
        keywords: '2fa two-factor two factor authenticator totp otp code sign in login security',
        appPath: '/settings?tab=security',
        appLabel: 'Open Password & security',
        body: [
            { steps: [
                'Go to **Settings → Password & security**.',
                'Under two-factor authentication choose **Turn on**, then add Oruinwan to an authenticator app (Google Authenticator, 1Password, Authy…) by scanning the QR code, entering the setup key, or using **Open in authenticator app** on this device.',
                'Enter the 6-digit code from the app to confirm.',
            ] },
            'From then on, after your password Oruinwan asks for the 6-digit code from your authenticator app.',
            { note: 'Oruinwan supports authenticator apps only; codes are not sent by SMS.' },
        ],
    },
    {
        id: 'devices',
        topic: 'security',
        title: 'See where you are signed in',
        summary: 'Review devices and sign out of any of them.',
        keywords: 'devices sessions sign out logout other devices browser lost',
        appPath: '/settings?tab=sessions',
        appLabel: 'Open Devices',
        body: [
            '**Settings → Devices** lists your active sessions, with **This device** marked. **Sign out** ends one session; **Sign out others** ends every session except the one you are using.',
        ],
    },
    {
        id: 'privacy-controls',
        topic: 'security',
        title: 'Privacy controls',
        summary: 'Read receipts, typing indicator, discovery and blocked people.',
        keywords: 'privacy read receipts typing indicator discoverable email block blocked unblock',
        appPath: '/settings?tab=privacy',
        appLabel: 'Open Privacy settings',
        body: [
            'In **Settings → Privacy** you can turn off **Read receipts** and the **Typing indicator**, choose whether people can find you by email (**Discoverable by email**), and manage **Blocked people** (unblock them there).',
        ],
    },
    {
        id: 'password',
        topic: 'security',
        title: 'Change or reset your password',
        summary: 'Change it in Settings, or reset it from the sign-in page.',
        keywords: 'password change reset forgot',
        appPath: '/settings?tab=security',
        appLabel: 'Open Password & security',
        body: [
            'Signed in: **Settings → Password & security**, enter your current password and the new one twice.',
            'Forgot it: choose **Forgot password?** on the sign-in page and follow the emailed link.',
        ],
    },

    // ── Account & data ─────────────────────────────────────────────────────
    {
        id: 'profile-emails',
        topic: 'account',
        title: 'Profile, photo and email addresses',
        summary: 'Update how people see you and which emails you use.',
        keywords: 'profile name photo avatar bio phone email emails primary add verify',
        appPath: '/settings?tab=profile',
        appLabel: 'Open Profile',
        body: [
            '**Settings → Profile** holds your photo (upload, crop or choose an avatar), display name, bio and phone number.',
            'Under **Email addresses** you can add more emails (each is verified with a code), **Make primary** and remove them. Your primary email is used for sign-in and notifications.',
        ],
    },
    {
        id: 'appearance-region',
        topic: 'account',
        title: 'Theme, text size, dates and time',
        summary: 'Light or dark, message text size, time zone and date formats.',
        keywords: 'theme dark light system text size font reduce motion time zone date format 24-hour clock region',
        appPath: '/settings?tab=appearance',
        appLabel: 'Open Appearance',
        body: [
            '**Settings → Appearance**: Light, Dark or System theme, message text size, and **Reduce motion**.',
            '**Settings → Language & region**: time zone, date format (for example DD/MM/YYYY or YYYY-MM-DD), 12- or 24-hour clock, and auto-translate.',
        ],
    },
    {
        id: 'export-data',
        topic: 'account',
        title: 'Download your data',
        summary: 'Get a JSON file with your account data.',
        keywords: 'export download data gdpr json copy backup',
        appPath: '/settings?tab=data',
        appLabel: 'Open Your data',
        body: [
            'In **Settings → Your data** choose **Download your data**. A JSON file downloads right away with your profile and preferences, workspace memberships, tasks and notes, AI memories, notification settings and recent activity.',
            'Messages are not included: they are end-to-end encrypted. The same tab shows your **Account activity**.',
        ],
    },
    {
        id: 'retention',
        topic: 'account',
        title: 'Automatically delete old messages',
        summary: 'Set how long your sent messages are kept.',
        keywords: 'retention delete old messages automatic days auto-delete',
        appPath: '/settings?tab=data',
        appLabel: 'Open Your data',
        body: [
            'In **Settings → Your data → Message retention**, choose Never, 30, 90 or 180 days, 1 year, or a custom number of days. Messages you sent that are older than that are deleted nightly.',
            { note: 'Only your own messages are affected. Retention pauses while an account is under legal hold.' },
        ],
    },
    {
        id: 'deactivate-delete',
        topic: 'account',
        title: 'Deactivate or delete your account',
        summary: 'Deactivation is reversible; deletion is immediate and permanent.',
        keywords: 'delete account deactivate close remove erase reactivate',
        appPath: '/settings?tab=data',
        appLabel: 'Open Your data',
        body: [
            '**Deactivate account** signs you out everywhere and hides your account. To come back, sign in and confirm the code we email you.',
            '**Delete account** asks you to type DELETE and erases your account immediately; there is no grace period. Messages you sent stay in conversations as “[Deleted User]”, and your AI memory is deleted.',
            { note: 'Accounts managed by a company, and accounts under legal hold, cannot be deleted from here; contact your admin.' },
        ],
    },
];

/**
 * Keyboard shortcuts that are really bound in the app.
 * keys: list of alternative combinations; 'Mod' is Cmd on Mac, Ctrl elsewhere.
 */
export const SHORTCUTS = [
    { group: 'Anywhere', label: 'Search', keys: [['Mod', 'K']] },
    { group: 'Anywhere', label: 'Open or close the Oruinwan AI panel', keys: [['Mod', 'Shift', 'A']] },
    { group: 'Anywhere', label: 'AI command box', keys: [['Mod', '/']] },
    { group: 'Anywhere', label: 'Open or close Help', keys: [['?']], where: 'outside text fields' },
    { group: 'Anywhere', label: 'Close a dialog, menu or panel', keys: [['Esc']] },
    { group: 'Composer', label: 'Send message', keys: [['Enter']] },
    { group: 'Composer', label: 'New line', keys: [['Shift', 'Enter']] },
    { group: 'Composer', label: 'Pick a mention or command suggestion', keys: [['Enter'], ['Tab']] },
    { group: 'Composer', label: 'Slash commands', keys: [['/']], where: 'at the start of a message' },
    { group: 'Composer', label: 'Mention someone', keys: [['@']] },
    { group: 'Editing', label: 'Save an edited message', keys: [['Enter']] },
    { group: 'Editing', label: 'Cancel editing', keys: [['Esc']] },
    { group: 'Notes', label: 'Insert a block', keys: [['/']], where: 'on an empty line' },
];

/** Recent changes, newest first. */
export const WHATS_NEW = [
    { id: 'rebrand', date: 'September 2026', title: 'Chttrix is now Oruinwan', text: 'Same workspace, new name and a new look, with glass-style panels in both light and dark themes.' },
    { id: 'own-ai', date: 'September 2026', title: 'Oruinwan AI on our own engine', text: 'The assistant now runs on the Oruinwan Engine, with answers that stream in live and a Stop button.', articleId: 'ai-engine' },
    { id: 'ai-chats', date: 'September 2026', title: '@Oruinwan in every conversation', text: 'Mention @Oruinwan in a channel, DM or thread to get an answer there, then keep asking follow-ups without mentioning it again.', articleId: 'ai-in-chats' },
    { id: 'ai-memory', date: 'September 2026', title: 'Personal memory, workspace knowledge and code review', text: 'Tell the assistant what to remember, ask about your notes, tasks and knowledge pages, and get code reviewed from any message.', articleId: 'ai-memory' },
    { id: 'tasks', date: 'September 2026', title: 'Rebuilt Tasks', text: 'List, board, sprint, timeline and workload views, clearer statuses, and Convert to task on any message.', articleId: 'tasks-views' },
    { id: 'settings', date: 'September 2026', title: 'New Settings', text: 'Two-factor sign-in with an authenticator app, privacy controls, date and time formats, message retention and data export.', articleId: 'two-factor' },
    { id: 'in-channel', date: 'September 2026', title: 'Reminders and pinned messages open in the conversation', text: 'Pinned messages, saved messages and reminders now open beside the chat instead of taking you elsewhere.', articleId: 'pin-save' },
    { id: 'help', date: 'September 2026', title: 'A real help center', text: 'Search these articles from anywhere with ?, see keyboard shortcuts, and contact support and follow your requests from the Help panel.' },
];

// ── Lookup & search ───────────────────────────────────────────────────────

const byId = new Map(ARTICLES.map((a) => [a.id, a]));
const topicById = new Map(TOPICS.map((t) => [t.id, t]));

export const getArticle = (id) => byId.get(id) || null;
export const getTopic = (id) => topicById.get(id) || null;
export const articlesInTopic = (topicId) => ARTICLES.filter((a) => a.topic === topicId);

/** Lower-case, strip accents and markup so "Huddlé" matches "huddle". */
export function normalizeText(text) {
    return String(text || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[*`]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function bodyText(body) {
    return (body || []).map((b) => {
        if (typeof b === 'string') return b;
        return [...(b.steps || []), ...(b.list || []), b.note || ''].join(' ');
    }).join(' ');
}

const index = ARTICLES.map((a) => ({
    article: a,
    title: normalizeText(a.title),
    summary: normalizeText(a.summary),
    keywords: normalizeText(a.keywords),
    topic: normalizeText(topicById.get(a.topic)?.title),
    body: normalizeText(bodyText(a.body)),
}));

/**
 * Every word of the query must appear somewhere in the article. Results are
 * ranked by where the words hit: title > keywords > summary > topic > body.
 */
export function searchArticles(query) {
    // Crude plural folding so "threads" also finds "thread".
    const words = normalizeText(query).split(' ').filter(Boolean)
        .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w));
    if (!words.length) return [];
    const scored = [];
    for (const entry of index) {
        let score = 0;
        let all = true;
        for (const w of words) {
            let s = 0;
            if (entry.title.includes(w)) s += 10;
            if (entry.keywords.includes(w)) s += 6;
            if (entry.summary.includes(w)) s += 4;
            if (entry.topic.includes(w)) s += 2;
            if (entry.body.includes(w)) s += 1;
            if (!s) { all = false; break; }
            score += s;
        }
        if (all) scored.push({ article: entry.article, score });
    }
    return scored
        .sort((a, b) => b.score - a.score || ARTICLES.indexOf(a.article) - ARTICLES.indexOf(b.article))
        .map((s) => s.article);
}

export function relatedArticles(id, limit = 3) {
    const article = getArticle(id);
    if (!article) return [];
    return articlesInTopic(article.topic).filter((a) => a.id !== id).slice(0, limit);
}

/**
 * Turn an article's appPath into a URL. Workspace-relative paths use the
 * workspace in the current URL, then the last opened workspace, else /workspaces.
 */
export function resolveAppPath(appPath, { pathname = '', lastWorkspaceId = '' } = {}) {
    if (!appPath) return null;
    if (appPath.startsWith('/')) return appPath;
    const current = String(pathname).match(/^\/workspace\/([^/]+)/);
    const ws = current ? current[1] : lastWorkspaceId;
    return ws ? `/workspace/${ws}/${appPath}` : '/workspaces';
}
