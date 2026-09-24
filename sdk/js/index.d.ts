// Type definitions for @chttrix/sdk

export interface ChttrixSDKOptions {
  /** Origin of the Chttrix API, e.g. https://api.example.com. Defaults to window.location.origin in browsers. */
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

export declare class ChttrixError extends Error {
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

export interface AiResource {
  chat(input: { message: string; history?: Array<{ sender: 'user' | 'ai'; text: string }>; workspaceId?: string }): Promise<{ text: string; actionsExecuted?: unknown[] }>;
  summarize(input: { text: string; workspaceId?: string }): Promise<{ summary: string }>;
  generateTask(input: { context: string; workspaceId?: string }): Promise<{ title: string; description: string; priority: string; dueDate?: string }>;
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

export declare class ChttrixSDK {
  constructor(options?: ChttrixSDKOptions);
  static readonly version: string;
  static create(options?: ChttrixSDKOptions): ChttrixSDK;

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
export default ChttrixSDK;
