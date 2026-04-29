import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { useQueue } from 'discord-player';

export const data = new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Show the current music queue');

export async function execute(interaction) {
    const queue = useQueue(interaction.guild.id);

    if (!queue?.currentTrack) {
        return interaction.reply({ content: '❌ Nothing is playing.', ephemeral: true });
    }

    const current   = queue.currentTrack;
    const tracks    = queue.tracks.toArray().slice(0, 10);
    const totalSize = queue.tracks.size;
    const paused    = queue.node.isPaused();

    const queueList = tracks.length > 0
        ? tracks.map((track, i) =>
            `**${i + 1}.** [${track.title}](${track.url}) — \`${track.duration}\` — ${track.requestedBy}`
          ).join('\n')
        : '*No tracks queued*';

    const embed = new EmbedBuilder()
        .setTitle(`${paused ? '⏸️' : '🎶'} Music Queue`)
        .setColor(0x1DB954)
        .addFields(
            {
                name: '▶️ Now Playing',
                value: `[${current.title}](${current.url}) — \`${current.duration}\` — ${current.requestedBy}`,
                inline: false
            },
            {
                name: `📋 Up Next ${totalSize > 10 ? `(showing 10 of ${totalSize})` : `(${totalSize} track${totalSize !== 1 ? 's' : ''})`}`,
                value: queueList,
                inline: false
            }
        )
        .setFooter({ text: `Volume: ${queue.node.volume}% • Loop: ${['Off','Track','Queue','Autoplay'][queue.repeatMode] ?? 'Off'}` })
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}