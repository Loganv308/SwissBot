import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { useMainPlayer, QueryType } from 'discord-player';
import { YtDlpExtractor } from '../../YoutubeDownloader/YtDlpExtractor.js';

export const data = new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song from YouTube')
    .addStringOption(option =>
        option.setName('query')
            .setDescription('Song name or YouTube URL')
            .setRequired(true)
    );

export async function execute(interaction) {
    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
        return interaction.reply({ content: '❌ You must be in a voice channel first.', ephemeral: true });
    }

    await interaction.deferReply();

    const query        = interaction.options.getString('query');
    const player       = useMainPlayer();
    const isUrl        = query.startsWith('http://') || query.startsWith('https://');
    const isYouTube    = isUrl && (query.includes('youtube.com') || query.includes('youtu.be'));
    const isSoundCloud = isUrl && query.includes('soundcloud.com');

    try {
        let searchEngine;
        if (isYouTube)         searchEngine = QueryType.YOUTUBE_VIDEO;
        else if (isSoundCloud) searchEngine = QueryType.SOUNDCLOUD_TRACK;
        else                   searchEngine = YtDlpExtractor.identifier;

        console.log(`[Play] Query: "${query}" | Engine: ${searchEngine}`);

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

    } catch(err) {
        console.error('[Play] Error:', err);
        await interaction.editReply({
            content: `❌ Could not play that.\n\`${err.message}\``
        });
    }
}