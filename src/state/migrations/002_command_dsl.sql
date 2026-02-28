-- Migration 002: Command DSL Extensions

-- User Profiles für Badge System
CREATE TABLE IF NOT EXISTS user_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT UNIQUE NOT NULL,
    handle TEXT,
    display_name TEXT,
    first_interaction INTEGER,
    last_interaction INTEGER,
    interaction_count INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    badges TEXT DEFAULT '[]',
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

-- Remix Chain Tracking
CREATE TABLE IF NOT EXISTS remix_chain (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chain_id TEXT UNIQUE NOT NULL,
    original_tweet_id TEXT NOT NULL,
    original_user_id TEXT NOT NULL,
    original_content TEXT,
    root_command_id TEXT,
    chain_depth INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    last_remix_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_remix_chain_original ON remix_chain(original_tweet_id);
CREATE INDEX IF NOT EXISTS idx_remix_chain_user ON remix_chain(original_user_id);

-- Remix Chain Entries
CREATE TABLE IF NOT EXISTS remix_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chain_id TEXT NOT NULL,
    entry_number INTEGER NOT NULL,
    tweet_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    flavor TEXT,
    energy INTEGER,
    content_preview TEXT,
    matrix_meta TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (chain_id) REFERENCES remix_chain(chain_id)
);

CREATE INDEX IF NOT EXISTS idx_remix_entries_chain ON remix_entries(chain_id, entry_number);
CREATE INDEX IF NOT EXISTS idx_remix_entries_tweet ON remix_entries(tweet_id);

-- Command History
CREATE TABLE IF NOT EXISTS command_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    command_id TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL,
    command_type TEXT NOT NULL,
    command_name TEXT,
    source_tweet_id TEXT,
    conversation_id TEXT,
    args TEXT,
    action_type TEXT,
    template_key TEXT,
    energy INTEGER,
    flavor TEXT,
    prompt_text TEXT,
    preset_key TEXT,
    matrix_meta TEXT,
    result_status TEXT,
    result_content_preview TEXT,
    error_message TEXT,
    processing_time_ms INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    completed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_command_history_user ON command_history(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_command_history_type ON command_history(command_type, created_at);
CREATE INDEX IF NOT EXISTS idx_command_history_conversation ON command_history(conversation_id);
CREATE INDEX IF NOT EXISTS idx_command_history_tweet ON command_history(source_tweet_id);

-- View: User Stats
CREATE VIEW IF NOT EXISTS user_stats AS
SELECT
    user_id,
    interaction_count,
    level,
    json_extract(badges, '$') as badges_list,
    first_interaction,
    last_interaction
FROM user_profiles;

-- View: Active Remix Chains
CREATE VIEW IF NOT EXISTS active_remix_chains AS
SELECT
    rc.*,
    COUNT(re.id) as remix_count
FROM remix_chain rc
LEFT JOIN remix_entries re ON rc.chain_id = re.chain_id
WHERE rc.last_remix_at > strftime('%s', 'now') - 86400
GROUP BY rc.chain_id;
