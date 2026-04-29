import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { useMainPlayer } from 'discord-player';
import { getVoiceChannel } from './musicUtils.js';

export const data = new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song or playlist from YouTube, Spotify, or SoundCloud')
    .addStringOption(option =>
        option.setName('query')
            .setDescription('Song name, URL, or playlist URL')
            .setRequired(true)
    );

export async function execute(interaction) {
    const voiceChannel = getVoiceChannel(interaction);
    if (!voiceChannel) {
        return interaction.reply({ content: '❌ You must be in a voice channel first.', ephemeral: true });
    }

    await interaction.deferReply();

    const query  = interaction.options.getString('query');
    const player = interaction.client.player;

    try {
        const { track, queue } = await player.play(voiceChannel, query, {
            nodeOptions: {
                metadata: { channel: interaction.channel },
                selfDeaf: true,
                volume: 80,
                leaveOnEmpty: true,
                leaveOnEmptyCooldown: 300000, // 5 minutes
                leaveOnEnd: true,
                leaveOnEndCooldown: 300000,
            },
            requestedBy: interaction.user,
        });

        // If bot is in a different channel, move it
        const botVoice = interaction.guild.members.me.voice.channel;
        if (botVoice && botVoice.id !== voiceChannel.id) {
            queue.node.move(voiceChannel);
        }

        const isQueued = queue.tracks.size > 0 && queue.currentTrack !== track;

        const embed = new EmbedBuilder()
            .setColor(0x1DB954)
            .setThumbnail(track.thumbnail)
            .setTitle(isQueued ? '➕ Added to Queue' : '🎵 Now Playing')
            .setDescription(`**[${track.title}](${track.url})**`)
            .addFields(
                { name: 'Duration',      value: track.duration,           inline: true },
                { name: 'Source',        value: track.source,             inline: true },
                { name: 'Author',        value: track.author,             inline: true },
                { name: 'Requested by',  value: `${interaction.user}`,    inline: true },
            );

        console.log("Playing query:", query);

        if (isQueued) {
            embed.addFields({ name: 'Position in Queue', value: `${queue.tracks.size}`, inline: true });
        }
        
        await interaction.editReply({ embeds: [embed] });

    } catch(err) {
        console.error('Play error:', err);
        await interaction.editReply({ content: `❌ Could not play that. Try a different search or URL.\n\`${err.message}\`` });
    }
}