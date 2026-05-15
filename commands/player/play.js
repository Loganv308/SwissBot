import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { useMainPlayer, QueryType } from 'discord-player';
import { YtDlpExtractor } from '../../YoutubeDownloader/YtDlpExtractor.js';

export const data = new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song or YouTube playlist')
    .addStringOption(option =>
        option.setName('query')
            .setDescription('Song name, YouTube URL, or playlist URL')
            .setRequired(true)
    );

export async function execute(interaction) {
    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
        return interaction.reply({ content: '❌ You must be in a voice channel first.', flags: 1 << 6 });
    }

    await interaction.deferReply();

    const query        = interaction.options.getString('query');
    const player       = useMainPlayer();
    const isUrl        = query.startsWith('http://') || query.startsWith('https://');
    const isYouTube    = isUrl && (query.includes('youtube.com') || query.includes('youtu.be'));
    const isSoundCloud = isUrl && query.includes('soundcloud.com');
    const isPlaylist   = isYouTube && query.includes('list=') && !query.includes('watch?v=');

    try {
        let searchEngine;
        if (isYouTube)         searchEngine = YtDlpExtractor.identifier;  // handles both video + playlist
        else if (isSoundCloud) searchEngine = QueryType.SOUNDCLOUD_TRACK;
        else                   searchEngine = YtDlpExtractor.identifier;

        console.log(`[Play] Query: "${query}" | Engine: ${searchEngine} | Playlist: ${isPlaylist}`);

        const searchResult = await player.search(query, {
            requestedBy: interaction.user,
            searchEngine,
        });

        console.log(`[Play] Search returned ${searchResult.tracks.length} tracks`);

        if (!searchResult.tracks.length) {
            return interaction.editReply({ content: '❌ No results found. Try a more specific search or a direct YouTube URL.' });
        }

        const { track, queue } = await player.play(voiceChannel, searchResult, {
            nodeOptions: {
                metadata: { channel: interaction.channel },
                selfDeaf: true,
                volume: 80,
                leaveOnEmpty: true,
                leaveOnEmptyCooldown: 300000,
                leaveOnEnd: true,
                leaveOnEndCooldown: 300000,
            },
        });

        console.log(`[Play] Playing: "${track.title}" from ${track.source}`);

        // ── Playlist response ──────────────────────────────────────────────
        if (isPlaylist && searchResult.tracks.length > 1) {
            const totalDurationSec = searchResult.tracks.reduce((acc, t) => {
                const [m, s] = t.duration.split(':').map(Number);
                return acc + (m * 60) + (s || 0);
            }, 0);
            const totalMins = Math.floor(totalDurationSec / 60);
            const totalSecs = String(totalDurationSec % 60).padStart(2, '0');

            const embed = new EmbedBuilder()
                .setColor(0xFF0000) // YouTube red for playlists
                .setTitle('📋 Playlist Queued')
                .setDescription(`**${searchResult.tracks.length} tracks** added to the queue`)
                .addFields(
                    { name: '▶️ Now Playing',    value: `[${track.title}](${track.url})`, inline: false },
                    { name: '⏱ Total Duration', value: `${totalMins}:${totalSecs}`,       inline: true  },
                    { name: '🎵 Tracks',         value: `${searchResult.tracks.length}`,  inline: true  },
                    { name: 'Requested by',      value: `${interaction.user}`,            inline: true  },
                )
                .setThumbnail(track.thumbnail)
                .setFooter({ text: `First 100 tracks loaded • Use /queue to see the full list` });

            return interaction.editReply({ embeds: [embed] });
        }

        // ── Single track response ──────────────────────────────────────────
        const isQueued = queue.tracks.size > 0 && queue.currentTrack !== track;

        const embed = new EmbedBuilder()
            .setColor(0x1DB954)
            .setThumbnail(track.thumbnail)
            .setTitle(isQueued ? '➕ Added to Queue' : '🎵 Now Playing')
            .setDescription(`**[${track.title}](${track.url})**`)
            .addFields(
                { name: 'Duration',     value: track.duration,        inline: true },
                { name: 'Source',       value: track.source,          inline: true },
                { name: 'Author',       value: track.author,          inline: true },
                { name: 'Requested by', value: `${interaction.user}`, inline: true },
            );

        if (isQueued) {
            embed.addFields({ name: 'Position in Queue', value: `${queue.tracks.size}`, inline: true });
        }

        await interaction.editReply({ embeds: [embed] });

    } catch (err) {
        console.error('[Play] Error:', err);
        await interaction.editReply({
            content: `❌ Could not play that.\n\`${err.message}\``
        });
    }
}