import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { useQueue } from 'discord-player';

export const data = new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Skip the current track')
    .addIntegerOption(option =>
        option.setName('amount')
            .setDescription('Number of tracks to skip (default 1)')
            .setMinValue(1)
            .setRequired(false)
    );

export async function execute(interaction) {
    const queue = useQueue(interaction.guild.id);

    if (!queue?.currentTrack) {
        return interaction.reply({ content: '❌ Nothing is playing.', ephemeral: true });
    }

    if (!interaction.member.voice.channel) {
        return interaction.reply({ content: '❌ You must be in a voice channel.', ephemeral: true });
    }

    const amount      = interaction.options.getInteger('amount') ?? 1;
    const skippedTrack = queue.currentTrack;

    if (amount === 1) {
        queue.node.skip();
    } else {
        // Skip multiple tracks
        for (let i = 0; i < amount - 1; i++) {
            if (queue.tracks.size > 0) queue.tracks.store.shift();
        }
        queue.node.skip();
    }

    const embed = new EmbedBuilder()
        .setTitle('⏭️ Skipped')
        .setDescription(`Skipped **${amount > 1 ? `${amount} tracks` : `[${skippedTrack.title}](${skippedTrack.url})`}**`)
        .setColor(0xFEE75C)
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}