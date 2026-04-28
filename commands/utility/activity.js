import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import config from '../../config.json' with { type: 'json' };

const { allowedUsers } = config;

export const data = new SlashCommandBuilder()
    .setName('activity')
    .setDescription("View a user's message activity")
    .addUserOption(option =>
        option.setName('user')
            .setDescription('The user to check')
            .setRequired(true)
    )
    .addIntegerOption(option =>
        option.setName('days')
            .setDescription('Timeframe in days (e.g. 7 or 30)')
            .setRequired(true)
            .addChoices(
                { name: '7 days',  value: 7  },
                { name: '30 days', value: 30 },
                { name: '90 days', value: 90 },
            )
    );

export async function execute(interaction) {
    if (!allowedUsers.includes(interaction.user.id)) {
        await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        return;
    }

    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getUser('user');
    const days   = interaction.options.getInteger('days');
    const db     = interaction.client.db;

    // Total messages in period
    const totalResult = await db.query(`
        SELECT COUNT(*) AS total
        FROM messages
        WHERE user_id = $1
          AND guild_id = $2
          AND timestamp >= NOW() - INTERVAL '1 day' * $3
          AND deleted = FALSE
    `, [target.id, interaction.guild.id, days]);

    const total = parseInt(totalResult.rows[0].total);

    if (total === 0) {
        await interaction.editReply({ content: `No messages found for ${target.tag} in the last ${days} days.` });
        return;
    }

    // Top 5 most active channels
    const channelResult = await db.query(`
        SELECT channel_name, COUNT(*) AS msg_count
        FROM messages
        WHERE user_id = $1
          AND guild_id = $2
          AND timestamp >= NOW() - INTERVAL '1 day' * $3
          AND deleted = FALSE
        GROUP BY channel_name
        ORDER BY msg_count DESC
        LIMIT 5
    `, [target.id, interaction.guild.id, days]);

    // Messages per day breakdown
    const dailyResult = await db.query(`
        SELECT DATE(timestamp) AS day, COUNT(*) AS msg_count
        FROM messages
        WHERE user_id = $1
          AND guild_id = $2
          AND timestamp >= NOW() - INTERVAL '1 day' * $3
          AND deleted = FALSE
        GROUP BY day
        ORDER BY day DESC
        LIMIT 7
    `, [target.id, interaction.guild.id, days]);

    // Edited and deleted counts
    const editedResult = await db.query(`
        SELECT COUNT(*) AS edited
        FROM messages
        WHERE user_id = $1
          AND guild_id = $2
          AND timestamp >= NOW() - INTERVAL '1 day' * $3
          AND edited_timestamp IS NOT NULL
    `, [target.id, interaction.guild.id, days]);

    const deletedResult = await db.query(`
        SELECT COUNT(*) AS deleted
        FROM messages
        WHERE user_id = $1
          AND guild_id = $2
          AND timestamp >= NOW() - INTERVAL '1 day' * $3
          AND deleted = TRUE
    `, [target.id, interaction.guild.id, days]);

    const edited  = parseInt(editedResult.rows[0].edited);
    const deleted = parseInt(deletedResult.rows[0].deleted);
    const avgPerDay = (total / days).toFixed(1);

    const topChannels = channelResult.rows
        .map((r, i) => `${i + 1}. #${r.channel_name} — **${r.msg_count}** messages`)
        .join('\n');

    const dailyBreakdown = dailyResult.rows
        .map(r => {
            const date = new Date(r.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            return `${date}: **${r.msg_count}**`;
        })
        .join('\n');

    const embed = new EmbedBuilder()
        .setTitle(`📊 Activity for ${target.username}`)
        .setThumbnail(target.displayAvatarURL())
        .setColor(0x5865F2)
        .addFields(
            { name: '📅 Timeframe', value: `Last ${days} days`, inline: true },
            { name: '💬 Total Messages', value: `${total}`, inline: true },
            { name: '📈 Avg Per Day', value: `${avgPerDay}`, inline: true },
            { name: '✏️ Edited', value: `${edited}`, inline: true },
            { name: '🗑️ Deleted', value: `${deleted}`, inline: true },
            { name: '\u200b', value: '\u200b', inline: true }, // spacer
            { name: '🏆 Most Active Channels', value: topChannels || 'None', inline: false },
            { name: '📆 Daily Breakdown (last 7 days)', value: dailyBreakdown || 'No data', inline: false },
        )
        .setFooter({ text: `User ID: ${target.id}` })
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}