# Chttrix Desktop App

Electron wrapper for the Chttrix web client.

## Quick Start

```bash
cd desktop
npm install
npm start          # Development mode (loads http://localhost:5173)
npm start:prod     # Production mode
```

## Environment

| Variable | Default | Description |
|---|---|---|
| `CHTTRIX_WEB_URL` | `http://localhost:5173` | URL the Electron window loads |
| `ELECTRON_IS_DEV` | — | Set to `1` to open DevTools |

## Features

- **Tray icon** — right-click for Open / Toggle Notifications / Quit
- **Native notifications** — messages, mentions, task reminders
- **Badge count** — unread count shown on dock (macOS) / tray tooltip
- **Background running** — app stays alive when window is closed (tray-based)

## Building a distributable

```bash
npm run build      # builds for current platform
npm run pack       # creates unpacked directory only
```

Output is placed in `desktop/dist/`.
