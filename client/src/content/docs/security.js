// Security & trust: model, encryption, privacy from admins, account security, admin controls.
export default {
    id: 'security',
    title: 'Security & trust',
    icon: 'ShieldCheck',
    blurb: 'How messages are encrypted, what admins can and cannot see, how accounts are protected, and the controls admins have.',
    pages: [
        {
            id: 'overview',
            title: 'Security model',
            summary: 'A plain-language summary of what Oruinwan protects, and how.',
            keywords: 'security model overview trust protect data encryption secrets tls at rest',
            blocks: [
                { table: { caption: 'What is protected, and how', head: ['Data', 'Protection'], rows: [
                    ['Message text (channels, DMs, threads, AI and agent answers)', 'End-to-end encrypted between devices with AES-256-GCM, a key per conversation. The server also keeps an escrowed copy of each conversation key, protected by a server master key. See [How messages are encrypted](/docs/security/encryption).'],
                    ['Attachments (files, photos, voice, video)', 'Stored on your Oruinwan server behind access checks, encrypted in transit. **Not** end-to-end encrypted.'],
                    ['Tasks, notes, knowledge pages', 'Stored on the server so they can be shared, searched and used by the AI.'],
                    ['Passwords', 'Stored as salted hashes (bcrypt), never in plain text.'],
                    ['2FA secrets, integration tokens, webhook and AI provider keys', 'Encrypted on the server with a server key and never shown again.'],
                    ['API keys and bot tokens', 'Only a SHA-256 hash is stored.'],
                ] } },
                { h: 'What that means in practice' },
                { list: [
                    'Everything travels over encrypted connections (TLS), and message text is stored encrypted at rest.',
                    'Message content is **never shown to admins**, and admins never see message counts. See [What admins can see](/docs/security/privacy).',
                    'Oruinwan does not index message text on the server. Message search happens on your device; the AI never indexes messages.',
                    'When you ask @Oruinwan in a chat, your device sends the recent messages it needs with the question.',
                    'The public API never returns message text.',
                ] },
                { cards: [
                    { to: '/docs/security/encryption', title: 'Encryption in detail', text: 'Keys, key escrow, unlocking, new members.' },
                    { to: '/docs/security/privacy', title: 'What admins can see', text: 'No message content, no message counts.' },
                    { to: '/docs/security/account', title: 'Account security', text: 'Passkeys, 2FA, devices, sessions.' },
                    { to: '/docs/security/admin-controls', title: 'Admin controls', text: 'Audit, legal hold, retention, export.' },
                ] },
            ],
        },
        {
            id: 'encryption',
            title: 'How messages are encrypted',
            summary: 'End-to-end encrypted between devices with a key per conversation, plus a server-escrowed copy of each key for agents and account recovery.',
            keywords: 'encryption e2ee end-to-end encrypted aes gcm keys unlock automatic sealed password conversation key new members wrapped escrow escrowed server master key recovery reset agents tls at rest',
            blocks: [
                { figure: 'e2ee', caption: 'Text is encrypted on your device; the server stores it encrypted, along with protected copies of the conversation key.' },
                { h: 'End-to-end between devices' },
                { list: [
                    'Messages are encrypted on your device with **AES-256-GCM** before they leave it, using a key for each conversation.',
                    'Each member’s copy of a conversation key is protected by that member’s own identity key. Oruinwan’s server keeps a **sealed copy** of the key that opens it, so your devices **unlock automatically** when you sign in, with a password, Google, a passkey or a QR code. You are not asked for your password to read messages.',
                    'Messages are encrypted in transit (TLS) and at rest.',
                    'Accounts set up before automatic unlock may be asked once, on one device, for the password (or to approve from another signed-in device). After that every device unlocks on its own.',
                    'Message content is never shown to workspace or company admins.',
                ] },
                { h: 'Key escrow on the server' },
                'Alongside the members’ copies, your Oruinwan server keeps an **escrowed copy of each conversation key**, protected by a server master key. It exists for two reasons:',
                { list: [
                    '**AI agents** (Oruinwan AI, and Claude, ChatGPT, Gemini or Grok when installed) can answer in encrypted conversations: the server uses the escrowed key to encrypt their answers like any other message.',
                    '**Recovery after a password reset**: if you reset your password, the server can give you access to your conversations again.',
                ] },
                'The same escrowed copy lets new members read a conversation they join, and lets integration cards (GitHub, Jira) be posted encrypted.',
                { callout: 'note', title: 'What this means', text: 'Because the server holds an escrowed copy of every conversation key and a sealed copy of your key, Oruinwan is not “zero-knowledge” messaging: whoever operates the server and holds its master key could in principle decrypt messages. Attachments are not end-to-end encrypted. Message Info shows whether a message is end-to-end encrypted.' },
            ],
        },
        {
            id: 'privacy',
            title: 'What admins can see',
            summary: 'Admins manage people, settings and security. They never see message content, message counts or per-person activity.',
            keywords: 'privacy admin admins see read messages monitor monitoring activity metrics analytics tracking productivity counts surveillance',
            blocks: [
                'Workspace admins and company owners and admins run the workspace and the company. Their consoles are built so they do not become a way to watch people.',
                { table: { caption: 'What admins see', head: ['Admins can see', 'Admins never see'], rows: [
                    ['Who is in the workspace or company, their roles and departments', 'The content of anyone’s messages, in channels or DMs'],
                    ['Channels, workspaces, installed agents and integrations', 'How many messages a person, channel or workspace has sent'],
                    ['Task progress, headcount and other company-wide totals', 'Per-person activity metrics or productivity tracking'],
                    ['Audit and compliance logs of admin and security events', 'Your private notes, AI panel chats or personal memory'],
                ] } },
                { list: [
                    'Analytics pages count members, channels, tasks, notes and files. Nothing on them counts or shows messages.',
                    'Personal connections (your own agent key, your own GitHub or Jira account) are visible and usable only by you.',
                    'Admins can export workspace data and place legal holds; see [Admin controls](/docs/security/admin-controls).',
                ] },
                { callout: 'note', text: 'The server keeps an escrowed copy of conversation keys so agents can answer and access can be recovered after a password reset. See [How messages are encrypted](/docs/security/encryption).' },
            ],
        },
        {
            id: 'account',
            title: 'Account security',
            summary: 'Verified email, strong passwords, passkeys, two-factor sign-in, devices and sign-out everywhere.',
            keywords: 'account security 2fa password passkey devices sessions sign out tokens email verification',
            blocks: [
                { list: [
                    'New accounts confirm their email address before they can sign in.',
                    'Passwords must be 8–16 characters with an uppercase letter, a number and a special character.',
                    '[Passkeys](/docs/settings/password-security) (fingerprint, face or screen lock) in the web app.',
                    '[Two-factor sign-in](/docs/settings/password-security) with an authenticator app (no SMS).',
                    '[Devices](/docs/settings/devices): see every session, sign out one or all others.',
                    'Short-lived access tokens (15 minutes) that refresh in the background.',
                    'Sign-in attempts are rate limited.',
                    'Deactivating signs you out everywhere; reactivating needs a code sent to your email.',
                ] },
            ],
        },
        {
            id: 'admin-controls',
            title: 'Admin controls',
            summary: 'Audit and compliance logs, legal hold, retention, exports, and switching features off.',
            keywords: 'admin controls audit logs compliance legal hold retention export erasure gdpr ai off features',
            blocks: [
                { list: [
                    '**Audit logs** and **compliance logs** in the company console, exportable as CSV. See [Audit and compliance](/docs/company/audit).',
                    '**Legal hold** on a user pauses retention and blocks account deletion.',
                    '**Workspace export** for owners and admins; each person can export their own data.',
                    '**Features** per workspace, including turning off Oruinwan AI, tasks, notes, polls, file uploads or huddles.',
                    '**Agents and integrations** are installed for the workspace by admins; secrets are shown once. Admins also decide whether members may connect their own agents and tools.',
                ] },
                { callout: 'tip', text: 'To report a security issue, use the **Security / bug report** topic on the [Contact](/contact) page.' },
            ],
        },
    ],
};
