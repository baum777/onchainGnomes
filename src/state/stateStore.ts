export interface StateStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl?: number): Promise<void>;
  exists(key: string): Promise<boolean>;
  del(key: string): Promise<void>;

  getEventState(eventId: string): Promise<EventTracking | null>;
  setEventState(eventId: string, state: EventTracking): Promise<void>;
  deleteEventState(eventId: string): Promise<void>;

  acquirePublishLock(eventId: string, ttlMs: number): Promise<boolean>;
  releasePublishLock(eventId: string): Promise<void>;
  isPublished(eventId: string): Promise<{ published: boolean; tweetId?: string }>;
  markPublished(eventId: string, tweetId: string, ttlMs: number): Promise<void>;

  getBudgetUsage(windowStartMs: number): Promise<number>;
  incrementBudgetUsage(weight: number, ttlMs: number): Promise<void>;
  resetBudget(ttlMs?: number): Promise<void>;

  getCursor(): Promise<CursorState | null>;
  setCursor(cursor: CursorState): Promise<void>;

  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<void>;

  ping(): Promise<boolean>;
  close(): Promise<void>;
}

export interface EventTracking {
  state: "event_seen" | "processed_ok" | "publish_attempted" | "publish_succeeded";
  eventId: string;
  tweetId?: string;
  attempts: number;
  lastAttemptAt?: number;
  error?: string;
}

export type EventState = EventTracking["state"];

export interface CursorState {
  since_id: string | null;
  last_fetch_at: string;
  fetched_count: number;
  version: number;
}

export type StateStoreFactory = () => StateStore;
