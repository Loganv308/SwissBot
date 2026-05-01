import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('remind')
    .setDescription('Set a reminder')
    .addStringOption(option =>
        option.setName('time')
            .setDescription('When to remind you (e.g. 10m, 2h, 1d)')
            .setRequired(true)
    )
    .addStringOption(option =>
        option.setName('message')
            .setDescription('What to remind you about')
            .setRequired(true)
    );

function parseTime(input) {
    const match = input.match(/^(\d+)(s|m|h|d)$/);
    if (!match) return null;

    const amount = parseInt(match[1]);
    const unit   = match[2];

    const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    return amount * multipliers[unit];
}

export async function execute(interaction) {
    const timeInput = interaction.options.getString('time');
    const message   = interaction.options.getString('message');
    const ms        = parseTime(timeInput);

    if (!ms) {
        await interaction.reply({
            content: 'Invalid time format. Use something like `10m`, `2h`, or `1d`.',
            ephemeral: true
        });
        return;
    }

    // Cap reminders at 30 days
    if (ms > 86400000 * 30) {
        await interaction.reply({
            content: 'Reminders cannot be set more than 30 days in advance.',
            ephemeral: true
        });
        return;
    }

    const remindAt = new Date(Date.now() + ms);

    // Ensure user exists in DB
    await interaction.client.db.query(`
        INSERT INTO users (user_id, username, global_name, is_bot)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id) DO UPDATE SET
            username = EXCLUDED.username,
            global_name = EXCLUDED.global_name
    `, [interaction.user.id, interaction.user.username, interaction.user.globalName || null, false]);

    // Ensure guild exists in DB
    await interaction.client.db.query(`
        INSERT INTO guilds (guild_id, name)
        VALUES ($1, $2)
        ON CONFLICT (guild_id) DO NOTHING
    `, [interaction.guild.id, interaction.guild.name]);

    await interaction.client.db.query(`
        INSERT INTO reminders (user_id, guild_id, message, remind_at)
        VALUES ($1, $2, $3, $4)
    `, [interaction.user.id, interaction.guild.id, message, remindAt]);

    const timestamp = Math.floor(remindAt.getTime() / 1000);
    await interaction.reply({
        content: `✅ Got it! I'll remind you <t:${timestamp}:R> about: **${message}**`,
        ephemeral: true
    });
}