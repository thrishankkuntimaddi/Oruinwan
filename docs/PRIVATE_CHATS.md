# Private chats (end-to-end encrypted)

Channels, DMs and groups are **encrypted on the device**, but the server keeps a sealed copy of
each conversation key (so AI agents can post, people can recover their account and new devices see
history). Whoever runs the server and holds its keys could read them.

**Private chats** are different: 1:1 conversations that only the two people's own devices can read.
The server stores public keys and signed ciphertext, and holds no key that can open them.

Switch: release flag `privateChats` (off by default). Turn on with
`FEATURES_ENABLED=…,privateChats` in `server/.env` and restart. Turning it off hides the screens
and answers 404 on `/api/private`; stored messages stay as they are.

## How it works

| Piece | Where |
|---|---|
| Crypto (shared by web, desktop and phone) | `platform/crypto/privateBox.js` |
| Client logic (devices, send, read, safety numbers) | `platform/crypto/privateChatClient.js` |
| Server API `/api/private` | `server/src/features/private-chats/` |
| Web | `client/src/features/private/` (Messages → lock icon, `/workspace/:id/private`) |
| Phone | `mobile/src/features/private/screens.jsx` (Chats → Private chats) |

- **Device keys.** Each device makes an ECDH P-256 key (to receive) and an ECDSA P-256 key (to
  sign), non-extractable, kept in IndexedDB. Only the public halves are uploaded
  (`PUT /api/private/devices/:id`). A device's keys can never be replaced under the same id.
- **Sending.** A fresh AES-256-GCM key encrypts the message (bound to chat, sender and device).
  That key is wrapped for every device of both people with an ephemeral ECDH key and HKDF-SHA-256.
  The sender's device signs the whole envelope; the server checks only its shape and that it comes
  from one of the sender's registered devices.
- **Reading.** The receiver verifies the signature with the sender device's public key, then unwraps
  with its own private key. Anything changed, re-addressed to another chat, or signed by an unknown
  device is hidden, not shown.
- **Safety number.** 60 digits from both people's device keys, the same on both sides. Comparing
  them (in person or on a call) proves the server didn't hand out a fake key. The app warns when the
  number changes (a new device on either side).
- **Push.** "New private message" with no content.

## What people give up (shown in the app)

- No AI, no server search, no link previews, no attachments (text only, up to ~48 KB per message).
- Messages stay on the devices that existed when they were sent: a new device can't read history.
- Lose every device and the messages are gone. Nobody, including us, can recover them.
- No forward secrecy beyond the per-message ephemeral key; a stolen unlocked device can read what is
  stored for it.

## Rules the server enforces

Both people are active members of the chat's workspace; nobody sends while either blocked the other;
device lists are only shown to people who share a private chat; at most 10 devices per person;
120 messages a minute per person. Tests: `mobile/src/features/private/privateBox.test.js`,
`server/src/features/private-chats/__tests__`, `e2e/tests/40-private-chats.spec.js`.
