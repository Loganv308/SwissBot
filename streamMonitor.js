// streamMonitor.js
// Monitors multiple Twitch streamers and posts go-live notifications to Discord.
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
  streamerIDs,
  streamNotifierChannelID,
  streamNotifierRoleID,
} = config;

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

// Track live state per streamer so we don't double-ping
const wasLive = new Map(streamerIDs.map(name => [name, false]));

// ─── Monitor ───────────────────────────────────────────────────────────────

async function checkStreams(client) {
  try {
    // Single query checks all streamers at once
    const result = await db.query(`
      SELECT c.name, s.id, s.title, s.game_name, s.started_at, s.peak_viewers
      FROM streams s
      JOIN channels c ON c.id = s.channel_id
      WHERE c.name = ANY($1::text[])
        AND s.is_live = TRUE
    `, [streamerIDs]);

    // Build a map of who is currently live
    const liveNow = new Map(result.rows.map(row => [row.name, row]));

    for (const streamerName of streamerIDs) {
      const stream      = liveNow.get(streamerName);
      const isLive      = !!stream;
      const wasLivePrev = wasLive.get(streamerName);

      // ── Went live ────────────────────────────────────────────────────────
      if (isLive && !wasLivePrev) {
        wasLive.set(streamerName, true);

        const channel = await client.channels.fetch(DISCORD_CHANNEL_ID);
        if (!channel) continue;

        const startedAt = new Date(stream.started_at);
        const unixTs    = Math.floor(startedAt.getTime() / 1000);

        const embed = {
          color: 0x9146FF,
          author: { name: "🔴 Now Live on Twitch" },
          title: stream.title || `${streamerName} is live!`,
          url: `https://twitch.tv/${streamerName}`,
          fields: [
            { name: "🎮 Game",    value: stream.game_name || "Unknown", inline: true },
            { name: "⏱ Started", value: `<t:${unixTs}:R>`,             inline: true },
          ],
          thumbnail: {
            url: `https://static-cdn.jtvnw.net/previews-ttv/live_user_${streamerName}-440x248.jpg?t=${Date.now()}`,
          },
          footer:    { text: `twitch.tv/${streamerName}` },
          timestamp: new Date().toISOString(),
        };

        await channel.send({
          content: `<@&${WATCHERS_ID}> **${streamerName}** is live! 🎉`,
          embeds: [embed],
        });

        console.log(`[StreamMonitor] ✅ ${streamerName} went live — notification sent.`);
      }

      // ── Went offline ─────────────────────────────────────────────────────
      if (!isLive && wasLivePrev) {
        wasLive.set(streamerName, false);
        console.log(`[StreamMonitor] 📴 ${streamerName} went offline.`);

        // Optional: uncomment to post an offline message
        // const channel = await client.channels.fetch(DISCORD_CHANNEL_ID);
        // if (channel) await channel.send(`📴 **${streamerName}** has gone offline. See you next time!`);
      }
    }

  } catch (err) {
    console.error("[StreamMonitor] DB error:", err.message);
  }
}

// ─── Entry Point ───────────────────────────────────────────────────────────

export async function startStreamMonitor(client) {
  console.log(`[StreamMonitor] Started — watching: ${streamerIDs.join(', ')} every ${POLL_INTERVAL_MS / 1000}s`);

  await checkStreams(client);
  setInterval(() => checkStreams(client), POLL_INTERVAL_MS);
}