CREATE TABLE guilds (
    guild_id    TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    joined_at   TIMESTAMP DEFAULT NOW()
);

CREATE TABLE channels (
    channel_id   TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    guild_id     TEXT NOT NULL REFERENCES guilds(guild_id) ON DELETE CASCADE,
    channel_type TEXT NOT NULL,
    created_at   TIMESTAMP DEFAULT NOW()
);

CREATE TABLE users (
    user_id     TEXT PRIMARY KEY,
    username    TEXT NOT NULL,
    global_name TEXT,
    is_bot      BOOLEAN DEFAULT FALSE,
    joined_at   TIMESTAMP DEFAULT NOW()
);

CREATE TABLE messages (
    message_id       TEXT PRIMARY KEY,
    guild_id         TEXT NOT NULL REFERENCES guilds(guild_id) ON DELETE CASCADE,
    channel_id       TEXT NOT NULL REFERENCES channels(channel_id) ON DELETE CASCADE,
    channel_name     TEXT,
    user_id          TEXT REFERENCES users(user_id) ON DELETE SET NULL,
    content          TEXT,
    attachments      JSONB DEFAULT '[]'::jsonb,
    timestamp        TIMESTAMP NOT NULL,
    edited_timestamp TIMESTAMP,
    deleted          BOOLEAN DEFAULT FALSE
);

CREATE TABLE guild_settings (
    guild_id         TEXT PRIMARY KEY REFERENCES guilds(guild_id) ON DELETE CASCADE,
    autorole_id      TEXT,
    autorole_enabled BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_messages_guild      ON messages(guild_id);
CREATE INDEX idx_messages_channel    ON messages(channel_id);
CREATE INDEX idx_messages_user       ON messages(user_id);
CREATE INDEX idx_messages_timestamp  ON messages(timestamp);
CREATE INDEX idx_messages_attachments_gin ON messages USING GIN(attachments);

CREATE VIEW message_log_view AS
SELECT
    m.message_id,
    m.timestamp,
    m.content,
    m.edited_timestamp,
    m.deleted,
    u.user_id,
    u.username,
    u.global_name,
    c.channel_id,
    c.name AS channel_name,
    g.guild_id,
    g.name AS guild_name,
    m.attachments
FROM messages m
JOIN users u ON m.user_id = u.user_id
JOIN channels c ON m.channel_id = c.channel_id
JOIN guilds g ON m.guild_id = g.guild_id;