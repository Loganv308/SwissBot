import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('avatar')
    .setDescription("Display a user's avatar")
    .addUserOption(option =>
        option.setName('user')
            .setDescription('The user whose avatar to display')
            .setRequired(false)
    );

export async function execute(interaction) {
    const target = interaction.options.getUser('user') ?? interaction.user;

    const avatarUrl = target.displayAvatarURL({ size: 512, extension: 'png' });

    const embed = new EmbedBuilder()
        .setTitle(`${target.username}'s Avatar`)
        .setImage(avatarUrl)
        .setColor(0x5865F2)
        .addFields({ name: 'Download', value: `[Click here](${avatarUrl})`, inline: false })
        .setFooter({ text: `User ID: ${target.id}` })
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}