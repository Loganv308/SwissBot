import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { useQueue } from 'discord-player';

export const data = new SlashCommandBuilder()
    .setName('shuffle')
    .setDescription('Shuffle the queue');

export async function execute(interaction) {
    const queue = useQueue(interaction.guild.id);

    if (!queue?.currentTrack) {
        return interaction.reply({ content: '❌ Nothing is playing.', ephemeral: true });
    }

    if (queue.tracks.size === 0) {
        return interaction.reply({ content: '❌ Not enough tracks in queue to shuffle.', ephemeral: true });
    }

    if (!interaction.member.voice.channel) {
        return interaction.reply({ content: '❌ You must be in a voice channel.', ephemeral: true });
    }

    queue.tracks.shuffle();

    const embed = new EmbedBuilder()
        .setTitle('🔀 Shuffled')
        .setDescription(`Shuffled **${queue.tracks.size}** tracks in the queue.`)
        .setColor(0x5865F2)
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}