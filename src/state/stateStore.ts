/**
 * StateStore Interface
 *
 * Abstract interface for durable state storage.
 * Implementations: FileSystem (default), Redis (production)
 */

export interface StateStore {
  // Event State Operations
  getEventState(eventId: string): Promise<EventTracking | null>;
  setEventState(eventId: string, state: EventTracking): Promise<void>;
  deleteEventState(eventId: string): Promise<void>;
  
  // Publish Lock Operations (for atomicity)
  acquirePublishLock(eventId: string, ttlMs: number): Promise<boolean>;
  releasePublishLock(eventId: string): Promise<void>;
  isPublished(eventId: string): Promise<{ published: boolean; tweetId?: string }>;
  markPublished(eventId: string, tweetId: string, ttlMs: number): Promise<void>;
  
  // Budget Gate Operations (shared across workers)
  getBudgetUsage(windowStartMs: number): Promise<number>;
  incrementBudgetUsage(weight: number, ttlMs: number): Promise<void>;
  resetBudget(): Promise<void>;
  
  // Cursor Operations
  getCursor(): Promise<CursorState | null>;
  setCursor(cursor: CursorState): Promise<void>;
  
  // General Operations
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

// Factory function type
export type StateStoreFactory = () => StateStore;
