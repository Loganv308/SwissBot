import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import config from '../../config.json' with { type: 'json' };

const { allowedUsers } = config;

export const data = new SlashCommandBuilder()
    .setName('search')
    .setDescription('Search logged messages for a keyword')
    .addStringOption(option =>
        option.setName('keyword')
            .setDescription('The keyword to search for')
            .setRequired(true)
    )
    .addUserOption(option =>
        option.setName('user')
            .setDescription('Narrow results to a specific user (optional)')
            .setRequired(false)
    );

export async function execute(interaction) {
    if (!allowedUsers.includes(interaction.user.id)) {
        await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        return;
    }

    await interaction.deferReply({ ephemeral: true });

    const keyword = interaction.options.getString('keyword');
    const target  = interaction.options.getUser('user');
    const db      = interaction.client.db;

    // Prevent SQL injection via ILIKE — parameterized, but sanitize wildcards
    const sanitized = keyword.replace(/[%_\\]/g, c => `\\${c}`);

    const values = target
        ? [interaction.guild.id, `%${sanitized}%`, target.id]
        : [interaction.guild.id, `%${sanitized}%`];

    const result = await db.query(`
        SELECT
            m.message_id,
            m.content,
            m.channel_name,
            m.timestamp,
            m.edited_timestamp,
            m.deleted,
            u.username,
            u.global_name
        FROM messages m
        JOIN users u ON m.user_id = u.user_id
        WHERE m.guild_id = $1
          AND m.content ILIKE $2
          ${target ? 'AND m.user_id = $3' : ''}
        ORDER BY m.timestamp DESC
        LIMIT 15
    `, values);

    if (!result.rows.length) {
        await interaction.editReply({
            content: `No messages found containing **${keyword}**${target ? ` from ${target.tag}` : ''}.`
        });
        return;
    }

    const lines = result.rows.map((m, i) => {
        const displayName = m.global_name || m.username;
        const time        = `<t:${Math.floor(new Date(m.timestamp).getTime() / 1000)}:f>`;
        const edited      = m.edited_timestamp ? ' *(edited)*' : '';
        const deleted     = m.deleted ? ' *(deleted)*' : '';
        const content     = m.content?.trim().slice(0, 200) || '*No content*';

        return `**${i + 1}.** ${time} — **${displayName}** in #${m.channel_name}${edited}${deleted}\n${content}`;
    }).join('\n\n');

    const trimmed = lines.length > 4096 ? lines.slice(0, 4093) + '...' : lines;

    const embed = new EmbedBuilder()
        .setTitle(`🔍 Search results for "${keyword}"`)
        .setDescription(trimmed)
        .setColor(0x5865F2)
        .setFooter({ text: `${result.rows.length} result${result.rows.length !== 1 ? 's' : ''}${target ? ` • Filtered to ${target.tag}` : ''}` })
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}