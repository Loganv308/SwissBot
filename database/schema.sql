-- ================================================
-- DATABASE CREATION (optional)
-- ================================================
-- Comment out if you already created the DB
-- CREATE DATABASE discord_logger;
-- \c discord_logger;

-- ================================================
-- TABLE: guilds
-- Stores each Discord server
-- ================================================
CREATE TABLE guilds (
    guild_id BIGINT PRIMARY KEY,
    name TEXT NOT NULL,
    joined_at TIMESTAMP DEFAULT NOW()
);

-- ================================================
-- TABLE: channels
-- Stores channels inside guilds
-- ================================================
CREATE TABLE channels (
    channel_id BIGINT PRIMARY KEY,
    channel_name TEXT NOT NULL,
    guild_id BIGINT NOT NULL REFERENCES guilds(guild_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    channel_type TEXT NOT NULL,   -- text, voice, thread, etc.
    created_at TIMESTAMP DEFAULT NOW()
);

-- ================================================
-- TABLE: users
-- Stores Discord users
-- ================================================
CREATE TABLE users (
    user_id BIGINT PRIMARY KEY,
    username TEXT NOT NULL,
    global_name TEXT,             -- Discord display name
    is_bot BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMP DEFAULT NOW()
);

-- ================================================
-- TABLE: messages
-- Stores every logged message
-- ================================================
CREATE TABLE messages (
    message_id BIGINT PRIMARY KEY,
    guild_id BIGINT NOT NULL REFERENCES guilds(guild_id) ON DELETE CASCADE,
    channel_id BIGINT NOT NULL REFERENCES channels(channel_id) ON DELETE CASCADE,
    channel_name TEXT,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE SET NULL,
    content TEXT,
    attachments JSONB DEFAULT '[]'::jsonb,
    timestamp TIMESTAMP NOT NULL,
    edited_timestamp TIMESTAMP,
    deleted BOOLEAN DEFAULT FALSE
);

-- ================================================
-- USEFUL INDEXES
-- ================================================
-- Fast lookup by guild
CREATE INDEX idx_messages_guild ON messages(guild_id);

-- Fast lookup by channel
CREATE INDEX idx_messages_channel ON messages(channel_id);

-- Fast lookup by user
CREATE INDEX idx_messages_user ON messages(user_id);

-- Timestamp queries (e.g., last 24h)
CREATE INDEX idx_messages_timestamp ON messages(timestamp);

-- JSON searching in attachments
CREATE INDEX idx_messages_attachments_gin ON messages USING GIN(attachments);

-- ================================================
-- VIEW: easy search
-- Combines all tables for easier querying
-- ================================================
-- CREATE VIEW message_log_view AS
-- SELECT
   -- m.message_id,
   -- m.timestamp,
   -- m.content,
   -- m.edited_timestamp,
   -- m.deleted,
   -- u.user_id,
   -- u.username,
   -- u.global_name,
   -- c.channel_id,
   -- c.name AS channel_name,
   -- g.guild_id,
   -- g.name AS guild_name,
   -- m.attachments
-- FROM messages m
-- LEFT JOIN users u ON m.user_id = u.user_id
-- LEFT JOIN channels c ON m.channel_id = c.channel_id
-- LEFT JOIN guilds g ON m.guild_id = g.guild_id;