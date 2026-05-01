import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { useQueue } from 'discord-player';

export const data = new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Resume the paused track');

export async function execute(interaction) {
    const queue = useQueue(interaction.guild.id);

    if (!queue?.currentTrack) {
        return interaction.reply({ content: '❌ Nothing is playing.', ephemeral: true });
    }
    if (!interaction.member.voice.channel) {
        return interaction.reply({ content: '❌ You must be in a voice channel.', ephemeral: true });
    }
    if (!queue.node.isPaused()) {
        return interaction.reply({ content: '▶️ Already playing.', ephemeral: true });
    }

    queue.node.resume();

    const embed = new EmbedBuilder()
        .setTitle('▶️ Resumed')
        .setDescription(`Resumed **[${queue.currentTrack.title}](${queue.currentTrack.url})**`)
        .setColor(0x57F287)
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}