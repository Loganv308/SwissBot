import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import config from '../../config.json' with { type: 'json' };

const { allowedUsers } = config;

export const data = new SlashCommandBuilder()
    .setName('logs')
    .setDescription('View recent messages from a user')
    .addUserOption(option =>
        option.setName('user')
            .setDescription('The user to look up')
            .setRequired(true)
    );

export async function execute(interaction) {
    if (!allowedUsers.includes(interaction.user.id)) {
        await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        return;
    }

    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getUser('user');
    const messages = await interaction.client.logger.getUserMessages(target.id, interaction.guild.id);

    if (!messages.length) {
        await interaction.editReply({ content: `No messages found for ${target.tag}.` });
        return;
    }

    const lines = messages.map((m, i) => {
        const time = `<t:${Math.floor(new Date(m.timestamp).getTime() / 1000)}:f>`;
        const edited = m.edited_timestamp ? ' *(edited)*' : '';
        const deleted = m.deleted ? ' *(deleted)*' : '';
        const content = m.content?.trim() || '*No text content*';
        const attachments = m.attachments?.length
            ? `\n  📎 ${m.attachments.map(a => a.name).join(', ')}`
            : '';
        return `**${i + 1}.** ${time} in #${m.channel_name}${edited}${deleted}\n${content}${attachments}`;
    }).join('\n\n');

    // Discord embeds have a 4096 char description limit
    const trimmed = lines.length > 4096 ? lines.slice(0, 4093) + '...' : lines;

    const embed = new EmbedBuilder()
        .setTitle(`Last ${messages.length} messages from ${target.tag}`)
        .setDescription(trimmed)
        .setColor(0x5865F2)
        .setThumbnail(target.displayAvatarURL())
        .setFooter({ text: `User ID: ${target.id}` })
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}