// Settings: every tab of /settings.
export default {
    id: 'settings',
    title: 'Settings',
    icon: 'Settings',
    blurb: 'Every tab in Settings: profile, security and 2FA, devices, notifications, appearance, region, privacy, AI, integrations and your data.',
    pages: [
        {
            id: 'overview',
            title: 'Settings overview',
            summary: 'Open Settings from your profile menu. Every tab has its own link.',
            keywords: 'settings overview tabs profile security devices notifications appearance region privacy ai integrations data',
            blocks: [
                'Open **Settings** from your profile menu. Each tab can be opened directly with `/settings?tab=<id>`, which is handy for bookmarks and help links.',
                { table: { caption: 'Settings tabs', head: ['Tab', 'Link', 'What is in it'], rows: [
                    ['Profile', '`?tab=profile`', 'Photo, name, bio, phone, email addresses.'],
                    ['Password & security', '`?tab=security`', 'Change password, two-factor sign-in.'],
                    ['Devices', '`?tab=sessions`', 'Where you are signed in; sign out of devices.'],
                    ['Notifications', '`?tab=notifications`', 'Desktop alerts, sound, mentions-only, email.'],
                    ['Appearance', '`?tab=appearance`', 'Theme, text size, reduce motion.'],
                    ['Language & region', '`?tab=region`', 'Time zone, date and time format, auto-translate.'],
                    ['Privacy', '`?tab=privacy`', 'Read receipts, typing indicator, discoverability, blocked people.'],
                    ['Oruinwan AI', '`?tab=ai`', 'Memory, AI features and engine for the workspace.'],
                    ['Integrations', '`?tab=integrations`', 'Outgoing webhooks, GitHub, Jira, Zoom, links to Apps and the Developer portal.'],
                    ['Your data', '`?tab=data`', 'Download your data, message retention, deactivate or delete.'],
                ] } },
                { callout: 'note', text: 'Settings needs a verified email address. **Oruinwan AI** and **Integrations** apply to the workspace you pick at the top of those tabs.' },
            ],
        },
        {
            id: 'profile',
            title: 'Profile and email addresses',
            summary: 'Update how people see you and which emails you use.',
            keywords: 'profile name photo avatar bio phone email emails primary add verify',
            blocks: [
                '**Settings → Profile** holds your photo (upload, crop or choose an avatar), display name, bio and phone number.',
                'Under **Email addresses** you can add more emails (each is verified with a code), **Make primary** and remove them. Your primary email is used for sign-in and notifications.',
            ],
        },
        {
            id: 'password-security',
            title: 'Password and two-factor sign-in',
            summary: 'Change your password and turn on an authenticator app for a 6-digit code at sign-in.',
            keywords: '2fa two-factor two factor authenticator totp otp code password change reset security',
            blocks: [
                { h: 'Change or reset your password' },
                { list: [
                    'Signed in: **Settings → Password & security**, enter your current password and the new one twice.',
                    'Forgot it: choose **Forgot password?** on the sign-in page and follow the emailed link.',
                ] },
                { h: 'Turn on two-factor sign-in' },
                { steps: [
                    'Go to **Settings → Password & security**.',
                    'Under two-factor authentication choose **Turn on**.',
                    'Add Oruinwan to an authenticator app (Google Authenticator, 1Password, Authy…) by scanning the QR code, entering the setup key, or using **Open in authenticator app** on this device.',
                    'Enter the 6-digit code from the app to confirm.',
                ] },
                'From then on, after your password Oruinwan asks for the 6-digit code (**Two-step verification**).',
                { callout: 'note', text: 'Oruinwan supports authenticator apps only; codes are not sent by SMS. 2FA secrets are stored encrypted on the server.' },
            ],
        },
        {
            id: 'devices',
            title: 'Devices',
            summary: 'See where you are signed in and sign out of any device.',
            keywords: 'devices sessions sign out logout other devices browser lost',
            blocks: [
                '**Settings → Devices** lists your active sessions, with **This device** marked. **Sign out** ends one session; **Sign out others** ends every session except the one you are using.',
                { callout: 'tip', text: 'Lost a laptop? Sign out of it here, then change your password.' },
            ],
        },
        {
            id: 'notifications',
            title: 'Notifications',
            summary: 'Desktop alerts, sound, mentions-only, email digest and per-workspace settings.',
            keywords: 'notifications settings desktop sound digest email test',
            blocks: [
                'In **Settings → Notifications** turn on **Desktop notifications**, choose whether you hear **Sound**, and whether you are alerted for everything or **Only mentions and direct messages**. Use **Send a test** to check it works.',
                'Under email, choose the **Activity digest** and **Product news**. **Workspace notifications** opens the settings for a specific workspace.',
                { cards: [
                    { to: '/docs/notifications/how-it-works', title: 'How notifications work', text: 'The rules behind every alert.' },
                    { to: '/docs/notifications/settings', title: 'All notification settings', text: 'Account and workspace options.' },
                ] },
            ],
        },
        {
            id: 'appearance-region',
            title: 'Appearance, language and region',
            summary: 'Light or dark, text size, reduce motion, time zone, date format and auto-translate.',
            keywords: 'theme dark light system text size font reduce motion time zone date format 24-hour clock region language translate',
            blocks: [
                { list: [
                    '**Settings → Appearance**: Light, Dark or System theme, message text size, and **Reduce motion**.',
                    '**Settings → Language & region**: time zone, date format (for example DD/MM/YYYY or YYYY-MM-DD), 12- or 24-hour clock, and **Auto-translate messages**.',
                ] },
            ],
        },
        {
            id: 'privacy',
            title: 'Privacy',
            summary: 'Read receipts, typing indicator, discovery by email and blocked people.',
            keywords: 'privacy read receipts typing indicator discoverable email block blocked unblock',
            blocks: [
                'In **Settings → Privacy** you can turn off **Read receipts** and the **Typing indicator**, choose whether people can find you by email (**Discoverable by email**), and manage **Blocked people** (unblock them there).',
            ],
        },
        {
            id: 'ai-integrations',
            title: 'Oruinwan AI and Integrations tabs',
            summary: 'Memory, AI features and engine; webhooks and connected services for a workspace.',
            keywords: 'ai settings integrations tab memory engine status usage webhooks github jira zoom developer portal',
            blocks: [
                { h: 'Oruinwan AI' },
                { list: [
                    '**Memory**: your private memories, for all workspaces or this one. See [Memory](/docs/ai/memory).',
                    '**Status** of the engine, and for admins **Check connection**.',
                    '**Features** (admins): AI features and Smart replies on or off for everyone.',
                    '**Engine** (admins): the model in use, or your own OpenAI-compatible server. See [How the AI runs](/docs/ai/how-it-runs).',
                    '**Usage** for the last 30 days.',
                ] },
                { h: 'Integrations' },
                { list: [
                    'Buttons to **Apps** and the **Developer portal**.',
                    '**Outgoing webhooks**. See [Outgoing webhooks](/docs/integrations/webhooks).',
                    '**GitHub**, **Jira** and **Zoom** (when enabled on the server). See [GitHub](/docs/integrations/github).',
                ] },
                'Only workspace owners and admins can change these; members see what is connected.',
            ],
        },
        {
            id: 'your-data',
            title: 'Your data',
            summary: 'Download your data, set message retention, deactivate or delete your account.',
            keywords: 'export download data gdpr json retention delete old messages deactivate delete account erase',
            blocks: [
                { h: 'Download your data' },
                'Choose **Download your data**. A JSON file downloads right away with your profile and preferences, workspace memberships, tasks and notes, AI memories, notification settings and recent activity. Messages are not included: they are end-to-end encrypted. The same tab shows your **Account activity**.',
                { h: 'Message retention' },
                'Under **Message retention**, choose Never, 30, 90 or 180 days, 1 year, or a custom number of days. Messages you sent that are older than that are deleted nightly. Only your own messages are affected, and retention pauses while an account is under legal hold.',
                { h: 'Deactivate or delete' },
                { list: [
                    '**Deactivate account** signs you out everywhere and hides your account. To come back, sign in and confirm the code we email you.',
                    '**Delete account** asks you to type DELETE and erases your account immediately; there is no grace period. Messages you sent stay in conversations as “[Deleted User]”, and your AI memory is deleted.',
                ] },
                { callout: 'warning', text: 'Accounts managed by a company, and accounts under legal hold, cannot be deleted from here; contact your admin.' },
            ],
        },
    ],
};
