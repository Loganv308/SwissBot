import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { useQueue } from 'discord-player';

export const data = new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Set the playback volume')
    .addIntegerOption(option =>
        option.setName('level')
            .setDescription('Volume level (0-100)')
            .setMinValue(0)
            .setMaxValue(100)
            .setRequired(true)
    );

export async function execute(interaction) {
    const queue = useQueue(interaction.guild.id);

    if (!queue?.currentTrack) {
        return interaction.reply({ content: '❌ Nothing is playing.', ephemeral: true });
    }

    if (!interaction.member.voice.channel) {
        return interaction.reply({ content: '❌ You must be in a voice channel.', ephemeral: true });
    }

    const level = interaction.options.getInteger('level');
    queue.node.setVolume(level);

    const emoji = level === 0 ? '🔇' : level < 30 ? '🔈' : level < 70 ? '🔉' : '🔊';

    const embed = new EmbedBuilder()
        .setTitle(`${emoji} Volume`)
        .setDescription(`Volume set to **${level}%**`)
        .setColor(0x5865F2)
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}