import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { useQueue } from 'discord-player';

export const data = new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pause the current track');

export async function execute(interaction) {
    const queue = useQueue(interaction.guild.id);

    if (!queue?.currentTrack) {
        return interaction.reply({ content: '❌ Nothing is playing.', ephemeral: true });
    }

    if (!interaction.member.voice.channel) {
        return interaction.reply({ content: '❌ You must be in a voice channel.', ephemeral: true });
    }

    if (queue.node.isPaused()) {
        return interaction.reply({ content: '⏸️ Already paused. Use `/resume` to continue.', ephemeral: true });
    }

    queue.node.pause();

    const embed = new EmbedBuilder()
        .setTitle('⏸️ Paused')
        .setDescription(`Paused **[${queue.currentTrack.title}](${queue.currentTrack.url})**`)
        .setColor(0xFEE75C)
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}