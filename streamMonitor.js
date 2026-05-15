// streamMonitor.js
// Drop this file into your Discord bot project and call startStreamMonitor(client) on bot ready.
//
// Required packages:
//   npm install pg

import pg from "pg";
const { Pool } = pg;

import config from './config.json' with { type: 'json' };

// ─── Config ────────────────────────────────────────────────────────────────

const {
  chatDataUser,
  chatDataPass,
  chatDataName,
  databaseHost,
  streamerID,
  streamNotifierChannelID,
  streamNotifierRoleID,
} = config;

const STREAMER_NAME      = streamerID;
const DISCORD_CHANNEL_ID = streamNotifierChannelID;
const WATCHERS_ID        = streamNotifierRoleID;
const POLL_INTERVAL_MS   = 60_000;

const db = new Pool({
  host:     databaseHost,
  port:     5432,
  database: chatDataName,
  user:     chatDataUser,
  password: chatDataPass,
});

// ─── State ─────────────────────────────────────────────────────────────────

let wasLive = false;

// ─── Monitor ───────────────────────────────────────────────────────────────

async function checkStream(client) {
  try {
    const result = await db.query(`
      SELECT s.id, s.title, s.game_name, s.started_at, s.peak_viewers
      FROM streams s
      JOIN channels c ON c.id = s.channel_id
      WHERE c.name = $1
        AND s.is_live = TRUE
      LIMIT 1
    `, [STREAMER_NAME]);

    const isLive = result.rows.length > 0;

    // ── Went live ──────────────────────────────────────────────────────────
    if (isLive && !wasLive) {
      wasLive = true;
      const stream = result.rows[0];

      const channel = await client.channels.fetch(DISCORD_CHANNEL_ID);
      if (!channel) return;

      const startedAt = new Date(stream.started_at);
      const unixTs    = Math.floor(startedAt.getTime() / 1000);

      const embed = {
        color: 0x9146FF,
        author: {
          name: "🔴 Now Live on Twitch",
        },
        title: stream.title || `${STREAMER_NAME} is live!`,
        url: `https://twitch.tv/${STREAMER_NAME}`,
        fields: [
          {
            name: "🎮 Game",
            value: stream.game_name || "Unknown",
            inline: true,
          },
          {
            name: "⏱ Started",
            value: `<t:${unixTs}:R>`,
            inline: true,
          },
        ],
        thumbnail: {
          url: `https://static-cdn.jtvnw.net/previews-ttv/live_user_${STREAMER_NAME}-440x248.jpg?t=${Date.now()}`,
        },
        footer: {
          text: `twitch.tv/${STREAMER_NAME}`,
        },
        timestamp: new Date().toISOString(),
      };

      await channel.send({
        content: `<@&${WATCHERS_ID}> **${STREAMER_NAME}** is live! 🎉`,
        embeds: [embed],
      });

      console.log(`[StreamMonitor] ✅ ${STREAMER_NAME} went live — notification sent.`);
    }

    // ── Went offline ───────────────────────────────────────────────────────
    if (!isLive && wasLive) {
      wasLive = false;
      console.log(`[StreamMonitor] 📴 ${STREAMER_NAME} went offline.`);

      // Optional: uncomment to send an offline message to Discord
      // const channel = await client.channels.fetch(DISCORD_CHANNEL_ID);
      // if (channel) await channel.send(`📴 **${STREAMER_NAME}** has gone offline. See you next time!`);
    }

  } catch (err) {
    console.error("[StreamMonitor] DB error:", err.message);
  }
}

// ─── Entry Point ───────────────────────────────────────────────────────────

export async function startStreamMonitor(client) {
  console.log(`[StreamMonitor] Started — watching ${STREAMER_NAME} every ${POLL_INTERVAL_MS / 1000}s`);

  await checkStream(client);
  setInterval(() => checkStream(client), POLL_INTERVAL_MS);
}