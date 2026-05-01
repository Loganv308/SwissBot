import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Client, Events, EmbedBuilder } from 'discord.js';
import config from './config.json' with { type: 'json' };
import { ServerLogger } from './ServerLogger.js';
import { Pool } from 'pg';
import { Player, GuildQueueEvent } from 'discord-player';
import { DefaultExtractors } from '@discord-player/extractor';
import { YtDlpExtractor } from './YoutubeDownloader/YtDlpExtractor.js';
import { createReadStream } from 'node:fs';
import { spawn } from 'node:child_process';

import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { databaseHost, databaseUser, databasePass, databaseName } = config;

process.env.YTDL_PATH = process.platform === 'win32'
    ? join(__dirname, 'yt-dlp.exe')
    : execSync('which yt-dlp').toString().trim();

process.env.DP_FORCE_YTDL_DRIVER = 'yt-dlp';

process.env.SPOTIFY_CLIENT_ID     = config.spotifyClientId;
process.env.SPOTIFY_CLIENT_SECRET = config.spotifyClientSecret;

process.env.FFMPEG_PATH = 'C:\\Users\\burni\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1-full_build\\bin\\ffmpeg.exe';

class BotClient extends Client {
    constructor(options) {
        super(options);

        this.db = new Pool({
            host: databaseHost,
            user: databaseUser,
            password: databasePass,
            database: databaseName,
            port: 5432
        });

        this.player = new Player(this, {
            skipFFmpeg: false,
        });

        const ytdlp = spawn(process.env.YTDL_PATH ?? 'yt-dlp', ['--version']);
        ytdlp.stdout.on('data', d => console.log('yt-dlp version:', d.toString().trim()));
        ytdlp.on('error', e => console.error('yt-dlp not found:', e.message));

        this.commands = new Map();
        this.logger = new ServerLogger(this.db);

        this.loadCommands();
        this.registerEvents();
    }

    async loadCommands() {
        const commandsFolder = join(__dirname, 'commands');
        const dirents = readdirSync(commandsFolder, { withFileTypes: true });

        for (const dirent of dirents) {
            if (dirent.isDirectory()) {
                const subFolder = join(commandsFolder, dirent.name);
                const cmdFiles = readdirSync(subFolder).filter(f => f.endsWith('.js'));

                for (const file of cmdFiles) {
                    const command = await import(pathToFileURL(join(subFolder, file)).href);
                    if (command.data && command.execute) {
                        this.commands.set(command.data.name, command);
                    } else {
                        console.log(`[WARNING] Missing "data" or "execute" in ${file}`);
                    }
                }
            } else if (dirent.isFile() && dirent.name.endsWith('.js')) {
                const command = await import(pathToFileURL(join(commandsFolder, dirent.name)).href);
                if (command.data && command.execute) {
                    this.commands.set(command.data.name, command);
                }
            }
        }
    }

    async postAuditLog(guildId, embed) {
        try {
            const logChannelId = await this.logger.getLogChannel(guildId);
            if (!logChannelId) return;
            const channel = await this.channels.fetch(logChannelId);
            if (channel) await channel.send({ embeds: [embed] });
        } catch(error) {
            console.error("postAuditLog Error:", error);
        }
    }

    registerEvents() {
        this.once(Events.ClientReady, async client => {
            console.log(`Ready! Logged in as ${client.user.tag}`);
            console.log(`Ping: ${client.ws.ping}ms`);
            this.commands.forEach(cmd => console.log("Loaded command:", cmd.data.name));

            // Very important line to import all Extractors
            await this.player.extractors.loadMulti(DefaultExtractors);
            await this.player.extractors.register(YtDlpExtractor, {});
            console.log('Registered extractors:', [...this.player.extractors.store.keys()]);

            setInterval(async () => {
                try {
                    const result = await this.db.query(`
                        UPDATE reminders
                        SET delivered = TRUE
                        WHERE delivered = FALSE AND remind_at <= NOW()
                        RETURNING *
                    `);
                    for (const reminder of result.rows) {
                        try {
                            const user = await this.users.fetch(reminder.user_id);
                            await user.send(`⏰ **Reminder:** ${reminder.message}`);
                        } catch(err) {
                            console.error(`Failed to send reminder to ${reminder.user_id}:`, err);
                        }
                    }
                } catch(err) {
                    console.error('Reminder poll error:', err);
                }
            }, 30000);
        });

        // ─── Player Events ────────────────────────────────────────────────

        this.player.events.on(GuildQueueEvent.playerStart, (queue, track) => {
            console.log('[Player] Started:', track.title, '| Source:', track.source);
            const channel = queue.metadata?.channel;
            if (!channel) return;

            const embed = new EmbedBuilder()
                .setTitle('🎵 Now Playing')
                .setDescription(`**[${track.title}](${track.url})**`)
                .setThumbnail(track.thumbnail)
                .addFields(
                    { name: 'Duration',     value: track.duration,         inline: true },
                    { name: 'Source',       value: track.source,           inline: true },
                    { name: 'Author',       value: track.author,           inline: true },
                    { name: 'Requested by', value: `${track.requestedBy}`, inline: true },
                )
                .setColor(0x1DB954)
                .setTimestamp();

            channel.send({ embeds: [embed] });
        });

        this.player.events.on(GuildQueueEvent.playerFinish, (queue, track) => {
            console.log('[Player] Finished:', track.title);
        });

        this.player.events.on(GuildQueueEvent.playerSkip, (queue, track) => {
            console.error('[Player] Track was skipped - likely a stream/ffmpeg error:', track.title);
            queue.metadata?.channel?.send(`⚠️ Failed to play **${track.title}** — skipped.`);
        });

        this.player.events.on(GuildQueueEvent.emptyQueue, queue => {
            const channel = queue.metadata?.channel;
            if (channel) channel.send('✅ Queue finished. Leaving voice channel.');
        });

        this.player.events.on(GuildQueueEvent.emptyChannel, queue => {
            const channel = queue.metadata?.channel;
            if (channel) channel.send('👋 Everyone left — leaving voice channel.');
        });

        this.player.events.on('playerError', (queue, error, track) => {
            console.error('[Player] playerError:', error?.message, '| Track:', track?.title);
            const channel = queue.metadata?.channel;
            if (channel) channel.send(`❌ Player error: ${error?.message}`);
        });

        this.player.events.on('error', (queue, error) => {
            console.error('[Player] Queue error:', error?.message);
            const channel = queue.metadata?.channel;
            if (channel) channel.send(`❌ Queue error: ${error?.message}`);
        });

        this.player.events.on(GuildQueueEvent.playerTrigger, (queue, track, reason) => {
            console.log('[Player] Trigger:', reason, '| Track:', track.title);
        });

        this.player.events.on(GuildQueueEvent.connectionCreate, (queue, connection) => {
            console.log('[Player] Voice connection created');
        });

        // ─── Discord Events ───────────────────────────────────────────────

        this.on(Events.GuildMemberAdd, async member => {
            try {
                const result = await this.db.query(
                    `SELECT autorole_id, autorole_enabled FROM guild_settings WHERE guild_id = $1`,
                    [member.guild.id]
                );
                const settings = result.rows[0];
                if (settings?.autorole_enabled && settings?.autorole_id) {
                    await member.roles.add(settings.autorole_id);
                    console.log(`Auto role added to ${member.user.tag}`);
                }
            } catch(error) {
                console.error("Autorole Error:", error);
            }

            await this.logger.logMemberEvent(member, 'join');

            const embed = new EmbedBuilder()
                .setTitle('Member Joined')
                .setColor(0x57F287)
                .setThumbnail(member.user.displayAvatarURL())
                .addFields(
                    { name: 'User',            value: `<@${member.user.id}> (${member.user.tag})`, inline: true },
                    { name: 'User ID',         value: member.user.id, inline: true },
                    { name: 'Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:F>`, inline: false },
                )
                .setTimestamp();

            await this.postAuditLog(member.guild.id, embed);
        });

        this.on(Events.GuildMemberRemove, async member => {
            await this.logger.logMemberEvent(member, 'leave');

            const embed = new EmbedBuilder()
                .setTitle('Member Left')
                .setColor(0xED4245)
                .setThumbnail(member.user.displayAvatarURL())
                .addFields(
                    { name: 'User',      value: `<@${member.user.id}> (${member.user.tag})`, inline: true },
                    { name: 'User ID',   value: member.user.id, inline: true },
                    { name: 'Joined At', value: member.joinedAt ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>` : 'Unknown', inline: false },
                )
                .setTimestamp();

            await this.postAuditLog(member.guild.id, embed);
        });

        this.on(Events.MessageCreate, async message => {
            if (message.author.bot) return;
            await this.logger.logMessage(message);
        });

        this.on(Events.MessageUpdate, async (oldMsg, newMsg) => {
            if (newMsg.author?.bot) return;
            await this.logger.logEdit(newMsg);

            const attachments = [...newMsg.attachments.values()];
            const embed = new EmbedBuilder()
                .setTitle('Message Edited')
                .setColor(0xFEE75C)
                .addFields(
                    { name: 'User',            value: `<@${newMsg.author.id}> (${newMsg.author.tag})`, inline: true },
                    { name: 'User ID',         value: newMsg.author.id, inline: true },
                    { name: 'Channel',         value: `<#${newMsg.channel.id}> (#${newMsg.channel.name})`, inline: false },
                    { name: 'Message ID',      value: newMsg.id, inline: true },
                    { name: 'Jump to Message', value: `[Click here](${newMsg.url})`, inline: true },
                    { name: 'Before',          value: oldMsg.content || '*No content*', inline: false },
                    { name: 'After',           value: newMsg.content || '*No content*', inline: false },
                    { name: 'Edited At',       value: `<t:${Math.floor(newMsg.editedTimestamp / 1000)}:F>`, inline: false },
                )
                .setTimestamp();

            if (attachments.length > 0) {
                embed.addFields({
                    name: 'Attachments',
                    value: attachments.map(a => `[${a.name}](${a.url})`).join('\n'),
                    inline: false
                });
            }

            await this.postAuditLog(newMsg.guild.id, embed);
        });

        this.on(Events.MessageDelete, async message => {
            await this.logger.logDelete(message);

            const content     = message.content || '*Content not cached*';
            const author      = message.author;
            const attachments = [...(message.attachments?.values() ?? [])];

            const embed = new EmbedBuilder()
                .setTitle('Message Deleted')
                .setColor(0xED4245)
                .addFields(
                    { name: 'User',            value: author ? `<@${author.id}> (${author.tag})` : 'Unknown', inline: true },
                    { name: 'User ID',         value: author?.id || 'Unknown', inline: true },
                    { name: 'Channel',         value: `<#${message.channel.id}> (#${message.channel.name})`, inline: false },
                    { name: 'Message ID',      value: message.id, inline: true },
                    { name: 'Content',         value: content, inline: false },
                    { name: 'Originally Sent', value: message.createdAt ? `<t:${Math.floor(message.createdTimestamp / 1000)}:F>` : 'Unknown', inline: false },
                )
                .setTimestamp();

            if (attachments.length > 0) {
                embed.addFields({
                    name: 'Attachments',
                    value: attachments.map(a => `[${a.name}](${a.url})`).join('\n'),
                    inline: false
                });
            }

            await this.postAuditLog(message.guild?.id, embed);
        });

        this.on(Events.InteractionCreate, async interaction => {
            if (!interaction.isChatInputCommand()) return;

            const command = this.commands.get(interaction.commandName);
            if (!command) return interaction.reply({ content: "Unknown command!", ephemeral: true });

            try {
                await command.execute(interaction);
            } catch(err) {
                console.error(err);
                const reply = { content: "There was an error!", ephemeral: true };
                try {
                    if (interaction.replied || interaction.deferred) {
                        await interaction.editReply(reply);
                    } else {
                        await interaction.reply(reply);
                    }
                } catch(e) {
                    console.error('Failed to send error reply:', e.message);
                }
            }
        });
    }
}

process.on('unhandledRejection', (reason) => {
    console.error('[Unhandled Rejection]', reason);
});

export default BotClient;