// Apps (desktop, mobile), running locally, help & support.
export default {
    id: 'platforms',
    title: 'Apps, self-hosting & help',
    icon: 'MonitorSmartphone',
    blurb: 'The desktop and mobile apps, running Oruinwan on your own machine, and where to get help.',
    pages: [
        {
            id: 'apps',
            title: 'Desktop and mobile apps',
            summary: 'An Electron desktop app for macOS, Windows and Linux, and an Expo mobile app.',
            keywords: 'desktop app mobile app electron expo ios android mac windows linux tray deep link push',
            blocks: [
                { h: 'Desktop (macOS, Windows, Linux)' },
                'The desktop app wraps the Oruinwan web app in its own window with native extras:',
                { list: [
                    'Native OS notifications and an unread badge.',
                    'A tray menu: **Open**, **Do Not Disturb**, **Notifications on/off**, **Check for Updates**, **Quit**. Closing the window keeps it in the tray.',
                    'One instance at a time, and an offline page that retries every 15 seconds.',
                    '`oruinwan://` links open straight in the app.',
                    'Builds: `.dmg`/`.zip` for Mac (Intel and Apple silicon), an installer for Windows, AppImage and `.deb` for Linux.',
                ] },
                { h: 'Mobile (iOS and Android)' },
                { list: [
                    'Sign in with email and password; your tokens are kept in the phone’s secure storage.',
                    'End-to-end encryption compatible with the web app. Sign in on the web once first so your encryption keys exist.',
                    'DMs and channels with an offline send queue, tasks, notes, files, knowledge pages, notifications and settings.',
                    'Push notifications. See [Mobile push](/docs/notifications/mobile-push).',
                    'Attachments, polls and threads show placeholders in the mobile app for now; open them on the web.',
                ] },
            ],
        },
        {
            id: 'running-locally',
            title: 'Running Oruinwan locally',
            summary: 'Run the web app, API, AI engine and database on your own Mac.',
            keywords: 'run locally self host development setup install npm ollama mongodb ports env dev all',
            blocks: [
                { table: { caption: 'Local stack', head: ['Piece', 'What it is', 'Port'], rows: [
                    ['Web app', 'React + Vite (`client/`)', '3000'],
                    ['API', 'Express + Socket.IO (`server/`)', '8080'],
                    ['AI engine', 'Ollama with `qwen2.5:3b` and `nomic-embed-text`', '11434'],
                    ['Database', 'MongoDB (remote via `MONGO_URI`, or local)', '27017 if local'],
                ] } },
                { h: 'One-time setup' },
                { code: `brew install node@20 ollama
brew tap mongodb/brew && brew install mongodb-community@7.0   # only for a local database

npm run install-all                  # root + client + server
cp server/.env.example server/.env   # then fill in the values
cp client/.env.example client/.env

ollama serve &
ollama pull qwen2.5:3b
ollama pull nomic-embed-text         # about 2.2 GB in total`, lang: 'bash', title: 'Terminal' },
                { h: 'Every day' },
                { code: `npm run dev:all        # services + API + web app in one terminal
# or, in three terminals:
npm run dev:services   # AI engine + database
npm run server         # API on :8080
npm run client         # web app on :3000

npm run dev:status     # what is running; API health: GET http://localhost:8080/api/health`, lang: 'bash', title: 'Terminal' },
                'Then open http://localhost:3000 (it proxies `/api` and `/uploads` to the API).',
                { h: 'Environment essentials' },
                { table: { caption: 'server/.env', head: ['Key', 'Local value'], rows: [
                    ['`PORT`', '`8080`'],
                    ['`MONGO_URI`', 'Your Atlas URI or `mongodb://127.0.0.1:27017/oruinwan`'],
                    ['`ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`', 'Long random strings (`openssl rand -hex 32`)'],
                    ['`SERVER_KEK`', '64 hex characters; protects stored secrets and 2FA keys'],
                    ['`CRYPTO_KEK_V1`', 'Exactly 64 hex characters'],
                    ['`AI_PROVIDER`, `LOCAL_LLM_*`', 'See [Run the local engine](/docs/ai/local-engine)'],
                    ['`FEATURES_ENABLED`', 'e.g. `integrations` to show GitHub, Jira and Zoom'],
                    ['Email (`BREVO_API_KEY` or `SMTP_*`)', 'Needed for sign-up verification and password resets'],
                ] } },
                { h: 'Troubleshooting' },
                { list: [
                    '`EADDRINUSE :8080` / `:3000`: something already uses the port. Find it with `lsof -iTCP:8080 -sTCP:LISTEN`.',
                    '“Unlock encryption” after login: expected on a new browser; enter your password.',
                    '“Failed to unwrap UMEK”: `CRYPTO_KEK_V1` is not exactly 64 hex characters.',
                    'AI “engine unavailable”: run `npm run dev:status`, then `npm run dev:services`.',
                    'Emails do not arrive: configure `BREVO_API_KEY` or `SMTP_*`.',
                    'Integrations missing in Settings: add `integrations` to `FEATURES_ENABLED` and restart the API.',
                    'Webhooks from GitHub or Jira to your laptop: expose port 8080 with `ngrok http 8080` or `cloudflared tunnel --url http://localhost:8080`.',
                ] },
            ],
        },
        {
            id: 'help',
            title: 'Help center and support',
            summary: 'Search help articles, see shortcuts and what is new, and contact support from inside the app.',
            keywords: 'help center support contact request ticket question problem feedback',
            blocks: [
                { list: [
                    'Inside Oruinwan press [[?]] (or use the **?** button) to open the **Help panel**: search articles, browse topics, see keyboard shortcuts and what is new.',
                    'Choose **Contact support** in the Help panel to send a question, problem, feedback or billing request, and follow its status under your requests.',
                    'The public [help center](/help) has the same articles, and the [Contact](/contact) page reaches the right team by email.',
                    'Company employees can also reach their company admins from **Contact admin**.',
                ] },
                { callout: 'tip', text: 'Found something wrong or missing in these docs? Use **Report a problem with this page** at the bottom of any page.' },
            ],
        },
    ],
};
