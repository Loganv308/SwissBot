import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { useQueue } from 'discord-player';

export const data = new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop playback and clear the queue');

export async function execute(interaction) {
    const queue = useQueue(interaction.guild.id);

    if (!queue?.currentTrack) {
        return interaction.reply({ content: '❌ Nothing is playing.', ephemeral: true });
    }
    if (!interaction.member.voice.channel) {
        return interaction.reply({ content: '❌ You must be in a voice channel.', ephemeral: true });
    }

    queue.delete();

    const embed = new EmbedBuilder()
        .setTitle('⏹️ Stopped')
        .setDescription('Playback stopped and queue cleared.')
        .setColor(0xED4245)
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}