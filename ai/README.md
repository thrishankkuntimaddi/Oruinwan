# ai/ — Chttrix Intelligence

Framework-free AI layer used by the server. No Express objects cross this boundary: the server's AI controller passes plain payloads to `api/ai.gateway.js` and gets plain results back.

```
server/src/features/ai/ai.controller.js   HTTP transport only
        │
        ▼
ai/api/ai.gateway.js                       chat() · summarize() · generateTask() · clearMemory()
        │
        ▼
ai/orchestrator/orchestrator.js            intent → agent, memory, activity events
        │
   ┌────┴─────────────┬──────────────────┐
   ▼                  ▼                  ▼
ai/agents/            ai/tools/          ai/memory/
ChatAgent             registry.js        ConversationMemory
SummarizeAgent        (declarations +    (bounded, LRU, TTL,
TaskAgent              executors)         no timers)
   │
   ▼
ai/providers/          gemini.provider.js · mock.provider.js
```

## Usage from the server

```js
const gateway = require('../../ai/api/ai.gateway');
const { text, actionsExecuted, event } = await gateway.chat(
  { message, history, workspaceId },
  { userId, req }
);
```

`event` is a plain activity descriptor (`events/activityEvent.js`) the caller may persist through the activity service.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | – | Gemini credentials (required in production) |
| `AI_PROVIDER` | `gemini` (`mock` under `NODE_ENV=test`) | Provider selection |
| `GEMINI_CHAT_MODEL` / `GEMINI_FAST_MODEL` | `gemini-2.5-flash` | Model ids |
| `AI_MAX_OUTPUT_TOKENS` | `2000` | Generation cap |
| `AI_MAX_TOOL_ROUNDS` | `4` | Tool-call rounds per chat turn |
| `AI_MEMORY_MAX_TURNS` / `AI_MEMORY_TTL_MS` / `AI_MEMORY_MAX_CONVERSATIONS` | `20` / 30 min / `1000` | Memory bounds |

## Adding a tool

1. Add a declaration to `tools/registry.js` `DECLARATIONS`.
2. Map it to an action name in `createTools()`.
3. Implement the action in `server/utils/aiActions.js` (the server injects that object).

Tools whose action is missing are simply not offered to the model.

## Adding an agent

Extend `agents/base.agent.js`, implement `run(payload, context)`, and register it: `orchestrator.registerAgent('my_intent', new MyAgent({ provider }))`.

## Tests

`cd server && npx jest ../ai` runs the suite with the mock provider (no network, no API key).
