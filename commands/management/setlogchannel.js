import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import config from '../../config.json' with { type: 'json' };

const { allowedUsers } = config;

export const data = new SlashCommandBuilder()
    .setName('setlogchannel')
    .setDescription('Set the channel for audit logs')
    .addChannelOption(option =>
        option.setName('channel')
            .setDescription('The channel to send audit logs to')
            .setRequired(true)
    );

export async function execute(interaction) {
    if (!allowedUsers.includes(interaction.user.id)) {
        await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        return;
    }

    const channel = interaction.options.getChannel('channel');

    // Ensure guild exists in DB
    await interaction.client.db.query(`
        INSERT INTO guilds (guild_id, name)
        VALUES ($1, $2)
        ON CONFLICT (guild_id) DO NOTHING
    `, [interaction.guild.id, interaction.guild.name]);

    await interaction.client.db.query(`
        INSERT INTO guild_settings (guild_id, log_channel_id)
        VALUES ($1, $2)
        ON CONFLICT (guild_id) DO UPDATE SET log_channel_id = EXCLUDED.log_channel_id
    `, [interaction.guild.id, channel.id]);

    await interaction.reply({ content: `Audit log channel set to <#${channel.id}>.`, ephemeral: true });
}