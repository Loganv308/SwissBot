# Swiss 🇨🇭
### A full-featured Discord bot with message logging, moderation, music, and utilities — built with Node.js and PostgreSQL.

---

## Features

### 📋 Logging
Swiss logs every message, edit, deletion, and attachment to a PostgreSQL database in real time. All activity is queryable and retained indefinitely.

- Full message history with edit and delete tracking
- Attachment metadata stored as JSONB
- Configurable audit log channel with rich embeds for edits, deletions, joins, and leaves
- Per-guild settings stored in the database

### 🎵 Music
- Play songs from SoundCloud by name or direct URL
- Queue management with skip, shuffle, loop, pause, resume, and volume control
- Now playing embed with progress bar
- Auto-leave after 5 minutes of inactivity or empty voice channel

### 🛡️ Moderation
- `/purge @user` — delete all messages from a user across every channel, with a confirmation prompt showing estimated count and time
- `/warn`, `/warnings`, `/clearwarnings` — persistent per-guild warning system
- `/autorole` — automatically assign a role to new members, configurable per guild
- `/setlogchannel` — configure the audit log channel per guild

### 🔧 Utility
- `/remind` — DB-backed reminders delivered via DM, survive bot restarts
- `/weather` — current weather via OpenWeatherMap
- `/urban` — Urban Dictionary lookup with NSFW filtering
- `/avatar` — display any user's avatar
- `/serverinfo` — detailed guild info including boost level, channel counts, and owner
- `/whois` — detailed user info

### 📊 Analytics (DB-powered)
- `/activity @user` — message activity over 7, 30, or 90 days with per-channel breakdown
- `/top` — server leaderboard of most active users
- `/search` — full-text search across all logged messages
- `/logs @user` — view a user's last 25 messages

### ⚙️ Management
- `/backfill` — import historical messages from any or all channels into the database via an interactive select menu
- `/commands` — list all available commands

---

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 24 (ESM) |
| Bot framework | discord.js v14 |
| Music | discord-player v7 + SoundCloud extractor |
| Database | PostgreSQL 16 |
| DB client | node-postgres (pg) |
| Containerization | Docker + Docker Compose |
| Deployment | PM2 + GitHub Actions |

---

## Project Structure

```
SwissArmyBot/
├── YoutubeDownloader/
|   └── YtDlpExtractor.js # Custom youtube audio download solution
├── commands/
|   ├── data/           # Backfill
│   ├── management/     # autorole, backfill, logs, purge, setlogchannel
│   ├── player/         # loop, nowplaying, pause, play, queue, resume, shuffle, skip, stop, volume
│   ├── utils/          # activity, avatar, remind, rules, search, server, serverinfo, top, urban, user, weather
|   ├── commands.js
|   └── ping.js
├── database/
|   └── schema.sql      # Full Database Schema
├── BotClient.js        # Client class, event registration, player setup
├── ServerLogger.js     # Database logging methods
├── deploy-commands.js  # Slash command registration
└── index.js            # Entry point
```

---

## Database Schema

```sql
guilds          -- Discord servers
channels        -- Channels within guilds
users           -- Discord users
messages        -- All logged messages with edit/delete tracking
guild_settings  -- Per-guild config (autorole, log channel)
member_events   -- Join and leave events
reminders       -- Persistent user reminders
```

Indexes on `guild_id`, `channel_id`, `user_id`, `timestamp`, and a GIN index on the `attachments` JSONB column for fast attachment search.

---

## Setup

### Prerequisites
- Node.js 24+
- PostgreSQL 16+
- ffmpeg
- A Discord application and bot token ([Discord Developer Portal](https://discord.com/developers/applications))
- OpenWeatherMap API key (for `/weather`)
- Spotify Developer credentials (for Spotify URL support)

### 1. Clone and install

```bash
git clone https://github.com/you/swiss.git
cd swiss
npm install
```

### 2. Configure

Create `config.json` in the project root:

```json
{
    "token": "your_bot_token",
    "clientId": "your_client_id",
    "guildId": "your_guild_id",
    "allowedUsers": ["your_user_id"],
    "databaseHost": "localhost",
    "databaseUser": "discordbot",
    "databasePass": "your_password",
    "databaseName": "discord_logger",
    "weatherApiKey": "your_openweathermap_key",
    "spotifyClientId": "your_spotify_client_id",
    "spotifyClientSecret": "your_spotify_client_secret"
}
```

### 3. Set up the database

```bash
psql -U discordbot -d discord_logger -f schema.sql
```

### 4. Register slash commands

```bash
node deploy-commands.js
```

### 5. Start the bot

```bash
node index.js
```

---

## Permissions

The bot requires the following Discord permissions:

- `Read Messages / View Channels`
- `Send Messages`
- `Embed Links`
- `Attach Files`
- `Read Message History`
- `Manage Messages` (for `/purge`)
- `Kick Members` (for `/kick`)
- `Ban Members` (for `/ban`)
- `Manage Roles` (for autorole)
- `Connect` + `Speak` (for music)

The following **Privileged Gateway Intents** must be enabled in the Discord Developer Portal:

- `Server Members Intent`
- `Message Content Intent`

---

## License

MIT
