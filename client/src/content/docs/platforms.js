// Apps (desktop, mobile), running locally, help & support.
export default {
    id: 'platforms',
    title: 'Apps, self-hosting & help',
    icon: 'MonitorSmartphone',
    blurb: 'The desktop and mobile apps, running Oruinwan on your own machine, and where to get help.',
    pages: [
        {
            id: 'apps',
            title: 'Desktop, phone and tablet apps',
            summary: 'Desktop apps for Mac, Windows and Linux, phone apps for Android and iPhone, and the full workspace on tablets.',
            keywords: 'desktop app mobile app phone tablet ipad electron capacitor ios iphone android mac windows linux testflight push split view',
            blocks: [
                'Oruinwan runs in the browser and in apps. Every app is already set up for your organisation’s Oruinwan server, so there is no server address to enter: open the app and sign in.',
                { table: { caption: 'Where Oruinwan runs', head: ['Platform', 'What you get'], rows: [
                    ['Web', 'The full workspace in a recent browser. Sign in with email and password, Google or a passkey.'],
                    ['Desktop (Mac, Windows, Linux)', 'The full workspace in its own window, with split view. Sign in with email and password.'],
                    ['Tablets (Android tablets, iPad)', 'The full workspace, the same as on the desktop apps, with split view in landscape. Sign in with email and password.'],
                    ['Phones (Android, iPhone)', 'A phone layout built for one hand. Sign in with email and password or Google, or create an account.'],
                ] } },
                { h: 'Desktop (Mac, Windows, Linux)' },
                { list: [
                    'Native OS notifications and an unread badge (on the dock, the launcher where supported, and in the window title).',
                    '[Split view](/docs/messaging/split-view): open a second conversation, a thread or another page beside the main one.',
                    'The window remembers its size and position; opening the app again focuses the window that is already open.',
                    'Links open in your usual browser.',
                    'The app tells you when a new version is available and offers the installer for your computer. Your data is kept.',
                    'Builds: `.dmg` for Mac (Apple silicon and Intel), an installer for Windows, AppImage and `.deb` for Linux.',
                ] },
                { h: 'Phones (Android and iPhone)' },
                { list: [
                    'Home, chats (channels, DMs and threads), Oruinwan AI and agents, tasks, notes, files, knowledge, search, notifications and settings.',
                    'Voice huddles in channels, DMs and scheduled meetings. Video and screen sharing are on the web, desktop and tablets.',
                    'Encryption works the same as on the web: your keys are created on first sign-in or unlocked with your password, then kept on the phone.',
                    'Push notifications. See [Mobile push](/docs/notifications/mobile-push).',
                    'Android: the app checks for new versions and installs them for you. iPhone: during testing the app is distributed through TestFlight.',
                ] },
                { h: 'Tablets' },
                'Android tablets and iPads get the full workspace, including video huddles, screen sharing and split view. Install the same Android or iOS app as on a phone; it opens the tablet layout on a large screen.',
                { callout: 'note', text: 'Google sign-in is available on the web and in the phone apps. In the desktop and tablet apps, sign in with your email and password. Passkeys work in the web app.' },
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
                    ['`SERVER_KEK`', '64 hex characters; the server master key. Protects the escrowed conversation keys, stored secrets and 2FA keys. Keep it safe and back it up'],
                    ['`CRYPTO_KEK_V1`', 'Exactly 64 hex characters'],
                    ['`AI_PROVIDER`, `LOCAL_LLM_*`', 'See [Run the local engine](/docs/ai/local-engine)'],
                    ['`FEATURES_ENABLED`', 'e.g. `integrations` to show GitHub, Jira and Zoom'],
                    ['Email (`BREVO_API_KEY` or `SMTP_*`)', 'Needed for sign-up verification and password resets'],
                ] } },
                'The desktop and tablet apps talk to the server set in `VITE_SERVER_URL` when they are built; people using them never type a server address.',
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
