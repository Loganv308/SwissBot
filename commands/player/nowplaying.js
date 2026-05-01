import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { useQueue } from 'discord-player';

function formatBar(current, total, length = 15) {
    const progress = Math.floor((current / total) * length);
    const filled   = '▓'.repeat(progress);
    const empty    = '░'.repeat(length - progress);
    return `${filled}${empty}`;
}

export const data = new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Show the currently playing track');

export async function execute(interaction) {
    const queue = useQueue(interaction.guild.id);

    if (!queue?.currentTrack) {
        return interaction.reply({ content: '❌ Nothing is playing.', ephemeral: true });
    }

    const track     = queue.currentTrack;
    const timestamp = queue.node.getTimestamp();
    const current   = timestamp?.current.value  ?? 0;
    const total     = timestamp?.total.value    ?? 0;
    const bar       = formatBar(current, total);
    const paused    = queue.node.isPaused();

    const loopLabels = { 0: 'Off', 1: '🔂 Track', 2: '🔁 Queue', 3: '🔀 Autoplay' };

    const embed = new EmbedBuilder()
        .setTitle(`${paused ? '⏸️' : '▶️'} Now Playing`)
        .setDescription(`**[${track.title}](${track.url})**`)
        .setThumbnail(track.thumbnail)
        .setColor(0x1DB954)
        .addFields(
            { name: 'Author',       value: track.author,                        inline: true },
            { name: 'Source',       value: track.source,                        inline: true },
            { name: 'Requested by', value: `${track.requestedBy}`,              inline: true },
            { name: 'Loop',         value: loopLabels[queue.repeatMode] ?? 'Off', inline: true },
            { name: 'Volume',       value: `${queue.node.volume}%`,             inline: true },
            { name: 'Queue Size',   value: `${queue.tracks.size} tracks`,       inline: true },
            { name: 'Progress',     value: `\`${timestamp?.current.label ?? '0:00'} ${bar} ${timestamp?.total.label ?? track.duration}\``, inline: false },
        )
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}