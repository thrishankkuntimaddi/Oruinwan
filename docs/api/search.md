# Search

Universal search across a workspace with a small query language. The parser is a pure module,
`server/src/features/search/queryParser.js` (tests: `__tests__/queryParser.test.js`), so web and
mobile clients can mirror it exactly — in particular for **message search, which runs on the client**
over decrypted messages (message bodies are end-to-end encrypted; the server only filters message
metadata).

## Endpoints

All require a signed-in user who is an active member of `workspaceId` (`400` malformed id, `403` not a member).

### `GET /api/search`

| Query param | Meaning |
|---|---|
| `q` | Query string in the syntax below. Empty (or only whitespace) → empty result. |
| `workspaceId` | Required. |
| `type` | Optional single kind: `message` `file` `user`/`contact` `channel` `task` `note` `knowledge`/`page` `all` (default). Intersected with any `type:` operators. |
| `from`, `to` | Optional ISO dates on `createdAt` (≥ from, ≤ to). Combined with date operators (both apply). Invalid → `400`. |
| `channelId` | Optional; scopes messages to one channel the caller is in. |
| `tags` | Optional comma list; tasks/notes/files/knowledge must have one of them. |
| `limit` | Per-kind page size, default 10, max 50. |
| `offset` | Per-kind offset. |
| `semantic` | `false` disables AI re-ranking. Re-ranking only runs when the query has free text and spans several kinds. |

Response (shape unchanged from before, plus `syntax`):

```json
{
  "messages": [], "files": [], "users": [], "channels": [], "tasks": [], "notes": [], "knowledge": [],
  "query": "from:@sam in:#eng budget",
  "total": 0,
  "syntax": {
    "text": "budget",
    "filters": { "from": ["sam"], "in": ["eng"], "before": null, "after": null, "on": null,
                 "has": [], "is": [], "types": [] },
    "warnings": []
  }
}
```

Message results now also carry `isEncrypted`, `isPinned`, `parentId`, `replyCount` and
`attachmentCount`. For encrypted messages `text`/`preview` are empty; clients decrypt locally.

### `GET /api/search/universal` (legacy quick search)

`?workspaceId=…&query=…` — same syntax. Response:
`{ channels, contacts, messages (max 3), tasks, notes, files, knowledge, query, syntax }`.

### `GET /api/search/contacts`

`?workspaceId=…&query=…` — plain people search (no syntax). `{ contacts }`.

## Query syntax

### Grammar

```
query     := token ( WS+ token )*
token     := operator | phrase | word
operator  := KEY ":" value
KEY       := from | in | before | after | on | has | is | type        (case-insensitive)
value     := '"' any-chars-except-quote '"' | non-space-non-quote-chars
phrase    := '"' any-chars-except-quote '"'                           (an unterminated quote runs to the end)
word      := non-space-non-quote-chars
```

- Tokenising: whitespace separates tokens. A `"` always starts a phrase, even in the middle of a word
  (`abc"def"` → word `abc`, phrase `def`). Empty phrases are dropped.
- `KEY:` must be at the start of a word and the key must be one of the eight above; anything else
  containing a colon (`ratio:3`, `https://…`) is an ordinary word.
- Operator values may be quoted: `in:"#release train"`.
- Input is truncated to **512 characters** and at most **64 tokens** are read.
- Values are lower-cased (except dates). Repeated values are de-duplicated.
- **Invalid operators are not dropped**: an empty value, an unknown `has:`/`is:`/`type:` value, or an
  invalid date keeps the original token (e.g. `has:video`) as a plain search word and adds a
  human-readable string to `warnings`.

### Operators

| Operator | Values | Semantics |
|---|---|---|
| `from:` | `@username`, `username`, `me` | Author/creator. `@` optional; `me` = caller. Repeated → any of them. An unknown username matches nothing. |
| `in:` | `#channel`, `channel` | Channel by exact name (case-insensitive), among channels the caller can see (public or member). `#` optional. Repeated → any. DMs are excluded once `in:` is used. |
| `before:` | `YYYY-MM-DD` | `createdAt` < that day 00:00 **UTC** (the day itself excluded). Last one wins. |
| `after:` | `YYYY-MM-DD` | `createdAt` ≥ the next day 00:00 UTC (the day itself excluded). Last one wins. |
| `on:` | `YYYY-MM-DD` | that UTC day: 00:00 ≤ `createdAt` < next day 00:00. Last one wins. |
| `has:` | `file` `link` `image` | Repeated → all must hold. |
| `is:` | `pinned` `thread` | Repeated → all must hold. |
| `type:` | see aliases | Restrict result kinds. Repeated → any of them. |

Dates must be real calendar dates (`2026-02-30` is invalid). Date operators intersect; if they cannot
overlap, a warning is added (and nothing matches).

`type:` aliases: `message messages msg` → message · `task tasks` → task · `note notes` → note ·
`file files` → file · `page pages knowledge doc docs` → knowledge · `channel channels` → channel ·
`person people user users contact` → user.

### Free text

Every word and phrase left after operators must appear (case-insensitive substring, any order) in
**one** searchable field of the item: tasks `title|description|tags`, notes `title|content|tags`,
files `name|description|tags`, knowledge `title|content|tags`, channels `name|description`,
people username/email. Messages: free text only matches plaintext (system/bot) messages on the
server; encrypted messages are matched by clients after decryption.

A query with operators but no free text is valid and lists everything matching the operators
(e.g. `from:me type:task`). A query with neither returns nothing. People are listed with no free text
only when `type:person` is given.

### Which kinds honour which operator

A kind that cannot honour an operator present in the query is **excluded** (filters only ever narrow).

| Kind | `from:` field | `in:` | dates (`createdAt`) | `has:` | `is:` |
|---|---|---|---|---|---|
| message | sender | channel | yes | `file` (any attachment), `image` (image attachment), `link` (has a link preview) | `pinned`, `thread` (is a reply or has replies) |
| task | createdBy | channel | yes | — | — |
| note | owner | channel | yes | `file` (any attachment), `image` (image attachment) | `pinned` |
| file | createdBy | — | yes | `file` (always), `image` (`image/*` MIME) | — |
| knowledge (page) | createdBy | — | yes | — | — |
| channel | createdBy | — | yes | — | — |
| person | — | — | — | — | — |

### Parser output (for client mirroring)

`parseQuery(q)` returns:

```js
{
  text: "budget launch plan",          // terms then phrases, space-joined
  terms: ["budget"],
  phrases: ["launch plan"],
  filters: { from: [], in: [], before: null, after: null, on: null, has: [], is: [], types: [] },
  dateRange: { gte?: Date, lt?: Date } | null,   // UTC, after combining on/after/before
  hasFilters: false,                   // any operator applied
  warnings: []
}
```

Helpers in the same module: `parseDay`, `buildDateRange`, `textRegex` (all-terms regex),
`applicableKinds` (the table above), `TYPE_ALIASES`, `HAS_VALUES`, `IS_VALUES`.

### Examples

| Query | Meaning |
|---|---|
| `from:@sam in:#eng has:file` | Sam's messages with attachments in #eng, and Sam's notes with attachments in #eng (tasks drop out: they don't support `has:`) |
| `"release plan" type:page` | Knowledge pages containing the phrase |
| `type:task from:me after:2026-01-01` | Tasks I created from 2 Jan 2026 (UTC) on |
| `is:pinned on:2026-03-10` | Pinned messages and notes created on 10 Mar 2026 (UTC) |
| `has:video budget` | Warning “Unknown has:video”; searches for the words `has:video` and `budget` |
