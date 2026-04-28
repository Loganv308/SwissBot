import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import config from '../../config.json' with { type: 'json' };

const { allowedUsers } = config;

export const data = new SlashCommandBuilder()
    .setName('top')
    .setDescription('Show the top 10 most active users in this server')
    .addIntegerOption(option =>
        option.setName('days')
            .setDescription('Timeframe to rank by')
            .setRequired(true)
            .addChoices(
                { name: '7 days',   value: 7   },
                { name: '30 days',  value: 30  },
                { name: '90 days',  value: 90  },
                { name: 'All time', value: 9999 },
            )
    );

export async function execute(interaction) {
    if (!allowedUsers.includes(interaction.user.id)) {
        await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        return;
    }

    await interaction.deferReply();

    const days = interaction.options.getInteger('days');
    const db   = interaction.client.db;

    const isAllTime = days === 9999;

    const result = await db.query(`
        SELECT
            m.user_id,
            u.username,
            u.global_name,
            COUNT(*) AS msg_count
        FROM messages m
        JOIN users u ON m.user_id = u.user_id
        WHERE m.guild_id = $1
          AND m.deleted = FALSE
          ${isAllTime ? '' : `AND m.timestamp >= NOW() - INTERVAL '1 day' * $2`}
        GROUP BY m.user_id, u.username, u.global_name
        ORDER BY msg_count DESC
        LIMIT 10
    `, isAllTime ? [interaction.guild.id] : [interaction.guild.id, days]);

    if (!result.rows.length) {
        await interaction.editReply({ content: 'No message data found for this server.' });
        return;
    }

    const medals = ['🥇', '🥈', '🥉'];

    const leaderboard = result.rows.map((row, i) => {
        const medal       = medals[i] ?? `**${i + 1}.**`;
        const displayName = row.global_name || row.username;
        return `${medal} ${displayName} — **${row.msg_count}** messages`;
    }).join('\n');

    const timeframeLabel = isAllTime ? 'All Time' : `Last ${days} days`;

    const embed = new EmbedBuilder()
        .setTitle(`🏆 Top 10 Most Active Users`)
        .setDescription(leaderboard)
        .setColor(0xF1C40F)
        .setFooter({ text: `Timeframe: ${timeframeLabel} • ${interaction.guild.name}` })
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}