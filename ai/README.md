# ai/ — Chttrix Intelligence

Framework-free AI layer used by the server. No Express objects cross this boundary: the server's AI controller passes plain payloads to `api/ai.gateway.js` and gets plain results back. Every AI feature in the product — assistant chat, smart replies, translation, drafts, conversation summaries, task extraction, note and task helpers, Q&A, search re-ranking, command-palette intent — goes through this one gateway, so swapping or adding a model is a provider change, not a feature change.

```
server/src/features/ai/ai.controller.js   HTTP transport only (+ ai.access.js: membership, AI on/off, rate limit)
        │                                  ai.provider.resolver.js: per-workspace provider/model
        ▼
ai/api/ai.gateway.js                       run(intent) · chat · smartReplies · translate · draft · conversation
        │                                  extractTasks · noteAssist · answer · rerank · classifyIntent · summarize · generateTask
        ▼
ai/orchestrator/orchestrator.js            intent → agent, provider override, memory, usage hook, activity events
        │
   ┌────┴─────────────┬──────────────────┐
   ▼                  ▼                  ▼
ai/agents/            ai/tools/          ai/memory/
ChatAgent (tools)     registry.js        ConversationMemory
Summarize, Task       (declarations →    (bounded, LRU, TTL,
assist.agents.js:     server actions)     no timers)
Reply, Translate,
Draft, Conversation,
ExtractTasks, Note,
Answer, Rerank, Intent
   │
   ▼
ai/providers/          gemini · openai · anthropic · local_llm (OpenAI-compatible) · mock
```

## Usage from the server

```js
const gateway = require('../../ai/api/ai.gateway');
const { text, actionsExecuted, event } = await gateway.chat(
  { message, history, workspaceId, context: { conversation, note, task, screen } },
  { userId, req, io, provider /* optional per-workspace instance */, model }
);
const { suggestions } = await gateway.smartReplies({ messages }, { userId });
const { text: summary } = await gateway.conversation({ messages, mode: 'bullets' }, { userId });
```

Messages are end-to-end encrypted, so transcripts are **decrypted on the client** and sent as `[{ sender, text, isMe }]`; the server never reads message content from the database for AI.

## Providers and models

| Variable | Default | Purpose |
|---|---|---|
| `AI_PROVIDER` | `gemini` (`mock` under `NODE_ENV=test`) | Server-wide default provider |
| `GEMINI_API_KEY`, `GEMINI_CHAT_MODEL`, `GEMINI_FAST_MODEL` | `gemini-2.5-flash` | Gemini |
| `OPENAI_API_KEY`, `OPENAI_CHAT_MODEL`, `OPENAI_BASE_URL` | `gpt-4o-mini` | OpenAI (or any compatible gateway) |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_CHAT_MODEL` | `claude-sonnet-4-5` | Anthropic |
| `LOCAL_LLM_BASE_URL`, `LOCAL_LLM_MODEL` | `http://localhost:11434/v1`, `llama3.1` | Ollama / LM Studio / vLLM |
| `AI_MAX_OUTPUT_TOKENS`, `AI_TIMEOUT_MS`, `AI_MAX_TOOL_ROUNDS` | `2000`, `45000`, `4` | Generation limits |
| `AI_RATE_LIMIT_PER_MIN` | `40` in production | Per-user limit on `/api/ai/*` |
| `AI_MEMORY_MAX_TURNS` / `AI_MEMORY_TTL_MS` / `AI_MEMORY_MAX_CONVERSATIONS` | `20` / 30 min / `1000` | Memory bounds |

A workspace can override the server default in **Settings → Chttrix AI**: choose a provider, connect its API key (sealed under `SERVER_KEK` in the `AIProvider` collection) and optionally pin a model. `server/src/features/ai/ai.provider.resolver.js` turns that into a provider instance passed as `context.provider`.

### Adding a provider

Implement the small interface and register it:

```js
// generateText({ model?, prompt, systemInstruction?, generationConfig? }) -> string
// chat({ model?, systemInstruction?, history, message, tools?, generationConfig? })
//   -> { text, functionCalls: [{ name, args }], continue(toolResults) -> same shape }
const { registerProvider } = require('./providers');
registerProvider('my_llm', (options) => new MyProvider(options));
```

Add its default models to `config.js` `models.byProvider` and it appears in the Settings UI.

## Adding a tool (something the assistant can do)

1. Add a declaration to `tools/registry.js` `DECLARATIONS` and map it in `ACTION_FOR`.
2. Implement the action in `server/utils/aiActions.js` as `(args, ctx) => result`; `ctx = { userId, workspaceId, req, io }` and the action must check membership itself.

Tools whose action is missing are simply not offered to the model. Messages the assistant sends are encrypted with the conversation key (`cryptoUtils.encryptForConversation`), so they stay E2EE.

## Adding an agent / intent

Extend `agents/base.agent.js`, implement `run(payload, context)` using `this.generate(context, { prompt })` or `this.providerFor(context).chat(...)`, and register it: `orchestrator.registerAgent('my_intent', new MyAgent({ provider }))`. Call it with `gateway.run('my_intent', payload, context)`.

## Observability

Every run reports `{ intent, agent, provider, model, userId, workspaceId, durationMs, ok, error }` through the orchestrator's `onUsage` hook; the server stores rows in `AIUsage` (90-day TTL) and shows them in Settings → Chttrix AI.

## Tests

`cd server && npx jest ../ai` runs the suite with the mock provider (no network, no API key).
