# Conversations: the rules

How channels, direct messages, groups, threads and task discussions behave, and where each rule is
enforced. Every app (web, desktop, phone) and every server path (REST, Socket.IO, AI, background
jobs) follows the same rules; the server enforces them, the apps only explain them.

## Who can see what

One function decides access: `checkConversationAccess` / `checkMessageAccess` in
`server/src/modules/conversations/conversationAccess.js`.

| Conversation | Read | Post at the top level | Reply in threads |
|---|---|---|---|
| Public channel | Members. Workspace members can also open its threads and pins before joining. | Members (announcement channels: channel admins and workspace owners/admins) | Members and workspace members |
| Private channel | Members | Members (announcement rule as above) | Members |
| 1:1 DM | The two people | Both, unless either blocked the other | Same |
| Group | Its members, **messages from when they joined** | Members | Members |

Everyone must also be an **active member of the conversation's workspace**. Someone who leaves, is
removed or suspended loses access to that workspace's channels, DMs and groups straight away, on
every path, and their devices leave the live rooms at once.

## Direct messages

- **One DM per pair of people in a workspace.** Opening a DM with someone always returns the same
  conversation (`DMSession.pairKey` is unique: `<workspace>:<id>:<id>`). A DM can only be started
  with an active member of the same workspace.
- **A DM never changes its people.** Mentioning someone who isn't in it offers to start a **new
  group** with everyone; the DM stays as it was, with its history, and nothing is copied.

## Groups

- A group has 3 to 10 people when it starts, its own id, an optional name and an admin (the person
  who started it).
- **Same people, same group.** Starting a group with exactly the people of an existing unnamed
  group reopens that group. Naming the new group always makes a separate one. So Nani + Mani +
  Teja and Nani + Mani + Nikil are two groups, each with its own history.
- **Adding people** keeps the same group. People who are added see messages **from the moment they
  joined**, never earlier ones: the server filters history, threads, pins, search, files,
  bookmarks, missed-message catch-up and notifications by their join date (`memberSince`).
- **Leaving and removing.** Anyone can leave; the group's admin can remove others. When the admin
  leaves, the person who has been in the group longest takes over. People who leave or are removed
  lose access, their copy of the conversation key and their live connection at once; the others
  keep the whole history.
- A group stays a group even if people leave (it can shrink to one person).

## Channels

- Any active member of the workspace can join a public channel; private channels are by invitation.
  People outside the workspace can't join, read or find its channels.
- **New channel members read the whole history** (unlike groups).
- Removing someone (or them leaving) takes them out of the live room and removes their copy of the
  channel key.

## Threads

- Threads are one level deep: a reply can't start its own thread. Replies live in the same
  conversation as their parent and never show in the main feed.
- Thread access is the parent message's access (including a group member's join date).
- Followers and people mentioned in a thread are notified only while they can still see it.

## Task discussions

- A task's discussion is separate from chat: comments and automatic entries (status, assignees,
  due dates…) stored with the task (`TaskDiscussion`, `TaskComment`), in plain text like the task
  itself, with no threads inside it.
- Who sees it follows the task: the workspace's members for workspace tasks, the channel's members
  for channel tasks, the creator, assignees, watchers and people added to the discussion.
- A task made from a message links to that message's chat thread: the chat thread gets a
  "📋 Task created" reply, and the discussion shows a preview of the thread's latest replies, only
  to people who can read that thread in chat. Comments are not copied between the two.

## One send path

REST (`POST /api/v2/messages/channel`, `/direct`, `/poll`, `/forward`) and Socket.IO
(`send-message`) run the same checks (`server/src/modules/messages/sendRules.js`) and the same
`createMessage`, so both produce the same events:

| Event | When | Payload |
|---|---|---|
| `new-message` | A top-level message | The message (with `clientTempId` when the sender gave one), to the conversation and, for DMs, each participant |
| `thread-reply` | A thread reply | `{ parentId, reply, clientTempId }` |
| `message-updated` | A thread's counters changed | `{ messageId, channelId, dmId, updates: { replyCount, lastReplyAt } }` |
| `message:reaction_added` / `message:reaction_removed` | Reactions (several per person) | `{ messageId, userId, emoji, reactions, channelId, dmSessionId, parentId }` |
| `message:deleted` | Delete for everyone | `{ messageId, dm, channel, parentId, deletedBy, deletedByName, deletedAt }` |
| `message-pinned` / `message-unpinned` | Pins | `{ messageId, isPinned, pinnedBy, pinnedByName, … }` |

The socket also confirms to the sender with `message-sent` (or `send-error` with the same `code` the
REST API would answer with). Socket reactions, deletes and pins call the same services as REST.

## Recipient search

"New message" (Home sidebar and Messages page) and "Add people" use the workspace's active members
and one matcher shared by the web and phone apps (`platform/people/peopleMatch.js`): word starts of
the name, username or email start, and three or more letters anywhere; case, accents and spaces
don't matter.
