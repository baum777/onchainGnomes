-- Initial schema for X AI Agent state
-- Migration: 001_initial_schema

-- Processed events for deduplication
CREATE TABLE IF NOT EXISTS processed_events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    action_type TEXT,
    success BOOLEAN,
    error_message TEXT
);

-- Conversations for thread tracking
CREATE TABLE IF NOT EXISTS conversations (
    thread_id TEXT PRIMARY KEY,
    root_tweet_id TEXT,
    context_summary TEXT,
    last_activity TIMESTAMP,
    reply_count INTEGER DEFAULT 0
);

-- Messages within conversations
CREATE TABLE IF NOT EXISTS conversation_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id TEXT NOT NULL REFERENCES conversations(thread_id),
    tweet_id TEXT UNIQUE NOT NULL,
    author_id TEXT NOT NULL,
    content TEXT,
    created_at TIMESTAMP,
    is_from_bot BOOLEAN DEFAULT 0
);

-- Cooldowns for rate limiting
CREATE TABLE IF NOT EXISTS cooldowns (
    type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    PRIMARY KEY (type, target_id)
);

-- System state key-value store
CREATE TABLE IF NOT EXISTS system_state (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User interaction tracking
CREATE TABLE IF NOT EXISTS user_interactions (
    user_id TEXT PRIMARY KEY,
    last_reply_at TIMESTAMP,
    reply_count INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_processed_events_time
    ON processed_events(processed_at);

CREATE INDEX IF NOT EXISTS idx_cooldowns_expires
    ON cooldowns(expires_at);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_thread
    ON conversation_messages(thread_id);
