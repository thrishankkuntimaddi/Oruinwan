// Type definitions for @oruinwan/sdk

export interface OruinwanSDKOptions {
  /** Origin of the Oruinwan API, e.g. https://api.example.com. Defaults to window.location.origin in browsers. */
  baseUrl?: string;
  /** Public API key (chx_...) for /api/public/* resources. */
  apiKey?: string;
  /** User JWT for user-scoped endpoints. */
  accessToken?: string;
  /** Refresh token (only issued to native / SDK clients that send x-client-platform). */
  refreshToken?: string;
  /** Custom fetch implementation. */
  fetch?: typeof fetch;
  /** Per-request timeout in ms (default 15000). */
  timeoutMs?: number;
  /** Retries for 429/5xx GET requests (default 2). */
  retries?: number;
  /** socket.io-client `io` function to enable realtime. */
  io?: (...args: any[]) => any;
  /** Value sent in the x-client-platform header. */
  platform?: string;
  /** Called whenever tokens change. */
  onTokens?: (tokens: { accessToken: string | null; refreshToken: string | null }) => void;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined | null>;
  auth?: 'auto' | 'apiKey' | 'bearer' | 'none';
  headers?: Record<string, string>;
  raw?: boolean;
}

export declare class OruinwanError extends Error {
  status: number;
  code?: string;
  response?: unknown;
  request?: { method: string; url: string };
}

export interface PublicMessage { _id: string; content?: string; sender?: { _id: string; username: string; firstName?: string; lastName?: string }; channelId?: string; type?: string; createdAt: string }
export interface PublicTask { _id: string; title: string; description?: string; status: string; priority: string; assignee?: unknown; dueDate?: string | null; createdAt: string }
export interface PublicFile { _id: string; name: string; mimeType?: string; size?: number; url?: string; channelId?: string; createdAt: string }
export interface PublicUser { id: string; username: string; firstName?: string; lastName?: string; avatarUrl?: string; role?: string }
export interface PublicChannel { _id: string; name: string; description?: string; type?: string; membersCount?: number; createdAt: string }
export interface Webhook { _id: string; workspaceId: string; event: string; url: string; secret?: string; createdBy?: string }

export interface ListResource<T> { list(params?: Record<string, unknown>): Promise<{ [k: string]: T[] | number }>; }
export interface TasksResource extends ListResource<PublicTask> {
  create(data: { title: string; description?: string; priority?: 'low' | 'medium' | 'high'; dueDate?: string; assigneeId?: string }): Promise<{ task: PublicTask }>;
}

export interface AuthResource {
  login(email: string, password: string): Promise<{ accessToken: string; refreshToken?: string; user: unknown } & Record<string, unknown>>;
  refresh(): Promise<{ accessToken: string; refreshToken?: string }>;
  me(): Promise<unknown>;
  logout(): Promise<void>;
  setAccessToken(token: string | null): void;
  setApiKey(key: string | null): void;
}

export interface WebhooksResource {
  list(workspaceId: string): Promise<{ webhooks: Webhook[] }>;
  subscribe(opts: { workspaceId: string; url: string; event: string }): Promise<Webhook>;
  subscribe(opts: { workspaceId: string; url: string; events: string[] }): Promise<Webhook[]>;
  unsubscribe(webhookId: string): Promise<{ message: string }>;
}

/** A decrypted chat message the client sends for AI features (never ciphertext). */
export interface AiMessage { sender?: string; text: string; isMe?: boolean; id?: string }
/** What the user is looking at, passed to `ai.chat` so the assistant can act on it. */
export interface AiContext {
  screen?: { route?: string; title?: string };
  conversation?: { id?: string; type?: 'channel' | 'dm'; name?: string; messages?: AiMessage[] };
  note?: { id?: string; title?: string; text?: string };
  task?: { id?: string; title?: string; description?: string; status?: string; priority?: string; dueDate?: string };
  selection?: string;
}
export interface AiAction { function: string; parameters?: Record<string, unknown>; result?: { success?: boolean; error?: string } & Record<string, unknown> }

export interface AiResource {
  chat(input: { message: string; history?: Array<{ sender: 'user' | 'ai'; text: string }>; workspaceId?: string; context?: AiContext }): Promise<{ text: string; actionsExecuted?: AiAction[] | null; provider?: string }>;
  summarize(input: { text: string; workspaceId?: string; style?: 'brief' | 'detailed' | 'bullets'; title?: string }): Promise<{ summary: string }>;
  generateTask(input: { context: string; workspaceId?: string }): Promise<{ title: string; description: string; priority: string; dueDate?: string }>;
  smartReplies(input: { messages: AiMessage[]; workspaceId: string; tone?: string }): Promise<{ suggestions: string[] }>;
  translate(input: { text: string; targetLang: string; workspaceId?: string }): Promise<{ translated: string; detectedLang: string | null }>;
  draft(input: { instruction: string; messages?: AiMessage[]; tone?: string; replyTo?: string; existing?: string; workspaceId?: string }): Promise<{ draft: string }>;
  conversation(input: { messages: AiMessage[]; mode?: 'summary' | 'bullets' | 'action_items' | 'decisions' | 'question'; question?: string; title?: string; workspaceId: string }): Promise<{ text: string; items?: Array<{ title: string; owner: string | null; due: string | null; priority: string }> | null }>;
  extractTasks(input: { text: string; max?: number; create?: boolean; workspaceId: string }): Promise<{ tasks: Array<{ title: string; description: string; priority: string; dueDate?: string }>; created: unknown[] }>;
  noteAssist(input: { action: 'summarize' | 'extract' | 'expand' | 'rewrite' | 'structure' | 'proofread' | 'shorten' | 'continue' | 'title' | 'custom'; text: string; title?: string; instruction?: string; workspaceId?: string }): Promise<{ text: string; action: string }>;
  taskAssist(input: { action: 'describe' | 'subtasks' | 'acceptance' | 'summary' | 'estimate' | 'custom'; task: { title: string; description?: string; status?: string; priority?: string; dueDate?: string; subtasks?: string[] }; instruction?: string; workspaceId?: string }): Promise<{ text: string; action: string }>;
  capabilities(): Promise<{ intents: string[]; tools: Array<{ name: string; description: string }>; noteActions: string[]; taskActions: string[]; providers: string[] }>;
  settings(input: { workspaceId: string }): Promise<{ settings: Record<string, unknown>; canManage: boolean }>;
  usage(input: { workspaceId: string; days?: number }): Promise<{ days: number; totals: { calls: number; errors: number; avgMs: number; users: number }; byIntent: unknown[]; byDay: unknown[] }>;
}

export interface RealtimeResource {
  connect(opts?: { io?: (...args: any[]) => any; url?: string; transports?: string[] }): any;
  readonly socket: any;
  on(event: string, handler: (...args: any[]) => void): () => void;
  off(event: string, handler?: (...args: any[]) => void): void;
  emit(event: string, payload?: unknown, ack?: (...args: any[]) => void): void;
  joinWorkspace(workspaceId: string): void;
  joinChannel(channelId: string): Promise<{ success?: boolean; error?: string; code?: string }>;
  joinDm(dmSessionId: string): void;
  disconnect(): void;
}

export declare class OruinwanSDK {
  constructor(options?: OruinwanSDKOptions);
  static readonly version: string;
  static create(options?: OruinwanSDKOptions): OruinwanSDK;

  baseUrl: string;
  apiKey: string | null;
  accessToken: string | null;
  refreshToken: string | null;

  request<T = any>(path: string, opts?: RequestOptions): Promise<T>;

  auth: AuthResource;
  messages: ListResource<PublicMessage>;
  tasks: TasksResource;
  files: ListResource<PublicFile>;
  users: ListResource<PublicUser>;
  channels: ListResource<PublicChannel>;
  webhooks: WebhooksResource;
  ai: AiResource;
  realtime: RealtimeResource;
}

export declare const VERSION: string;

/** @deprecated use OruinwanSDK */
export declare const ChttrixSDK: typeof OruinwanSDK;
/** @deprecated use OruinwanSDK */
export type ChttrixSDK = OruinwanSDK;
/** @deprecated use OruinwanError */
export declare const ChttrixError: typeof OruinwanError;
/** @deprecated use OruinwanError */
export type ChttrixError = OruinwanError;
/** @deprecated use OruinwanSDKOptions */
export type ChttrixSDKOptions = OruinwanSDKOptions;

export default OruinwanSDK;
