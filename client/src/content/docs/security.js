// Security & trust: model, encryption, account security, admin controls.
export default {
    id: 'security',
    title: 'Security & trust',
    icon: 'ShieldCheck',
    blurb: 'How messages are encrypted, what is and is not, how accounts are protected, and the controls admins have.',
    pages: [
        {
            id: 'overview',
            title: 'Security model',
            summary: 'A plain-language summary of what Oruinwan protects, and how.',
            keywords: 'security model overview trust protect data encryption secrets',
            blocks: [
                { table: { caption: 'What is protected, and how', head: ['Data', 'Protection'], rows: [
                    ['Message text (channels, DMs, threads, AI answers)', 'End-to-end encrypted in the browser with AES-256-GCM, a key per conversation.'],
                    ['Attachments (files, photos, voice, video)', 'Stored on Oruinwan’s servers behind access checks. **Not** end-to-end encrypted.'],
                    ['Tasks, notes, knowledge pages', 'Stored on the server so they can be shared, searched and used by the AI.'],
                    ['Passwords', 'Stored as salted hashes (bcrypt), never in plain text.'],
                    ['2FA secrets, integration tokens, webhook and AI provider keys', 'Encrypted on the server with a server key and never shown again.'],
                    ['API keys and bot tokens', 'Only a SHA-256 hash is stored.'],
                ] } },
                { h: 'What that means in practice' },
                { list: [
                    'Oruinwan’s servers cannot search message text. Message search happens in your browser; the AI never indexes messages.',
                    'When you ask @Oruinwan in a chat, your browser sends the recent messages it needs with the question.',
                    'The public API never returns message text.',
                ] },
                { cards: [
                    { to: '/docs/security/encryption', title: 'Encryption in detail', text: 'Keys, unlocking, new members.' },
                    { to: '/docs/security/account', title: 'Account security', text: '2FA, devices, sessions.' },
                    { to: '/docs/security/admin-controls', title: 'Admin controls', text: 'Audit, legal hold, retention, export.' },
                ] },
            ],
        },
        {
            id: 'encryption',
            title: 'How messages are encrypted',
            summary: 'Encrypted on your device before sending, with a key per conversation protected by your password.',
            keywords: 'encryption e2ee end-to-end encrypted aes gcm keys unlock password conversation key new members wrapped',
            blocks: [
                { figure: 'e2ee', caption: 'Text is encrypted on your device; servers store ciphertext and a protected copy of the conversation key.' },
                { list: [
                    'Messages are encrypted on your device with **AES-256-GCM** before they leave it, using a key for each conversation.',
                    'Oruinwan’s servers store message text only in encrypted form, which is why messages are never indexed for search or AI on the server.',
                    'Your encryption keys are protected with your password. On a new browser you may be asked for your password to **unlock** your messages.',
                    'So that new members can read a conversation they join, Oruinwan keeps a **protected (wrapped) copy of each conversation key** on its servers.',
                ] },
                { callout: 'note', title: 'Honest limits', text: 'Because the server holds a wrapped copy of conversation keys (for new members and features like integration cards), this is not the same as “zero-knowledge” messaging. Attachments are not end-to-end encrypted. Message Info shows whether a message is end-to-end encrypted.' },
            ],
        },
        {
            id: 'account',
            title: 'Account security',
            summary: 'Strong passwords, two-factor sign-in, devices and sign-out everywhere.',
            keywords: 'account security 2fa password devices sessions sign out tokens',
            blocks: [
                { list: [
                    'Passwords must be 8–16 characters with an uppercase letter, a number and a special character.',
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
            summary: 'Audit and compliance logs, legal hold, retention, exports, and switching AI features off.',
            keywords: 'admin controls audit logs compliance legal hold retention export erasure gdpr ai off features',
            blocks: [
                { list: [
                    '**Audit logs** and **compliance logs** in the Owner and Admin consoles, exportable as CSV. See [Audit and compliance](/docs/company/audit).',
                    '**Legal hold** on a user pauses retention and blocks account deletion.',
                    '**Workspace export** for owners and admins; each person can export their own data.',
                    '**Features** per workspace, including turning off Oruinwan AI, file uploads or huddles.',
                    '**Integrations** can only be connected by admins; secrets are shown once.',
                ] },
                { callout: 'tip', text: 'Report a security issue to security@oruinwan.com (the Contact page has a “Security / bug report” topic).' },
            ],
        },
    ],
};
