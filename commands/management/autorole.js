import { SlashCommandBuilder } from 'discord.js';
import config from '../../config.json' with { type: 'json' };

const { allowedUsers } = config;

let autoRoleEnabled = true;

export const data = new SlashCommandBuilder()
    .setName('autorole')
    .setDescription('Enable or disable auto role assignment')
    .addBooleanOption(option =>
        option.setName('enabled')
            .setDescription('True = On, False = Off')
            .setRequired(true)
    );

export async function execute(interaction) {
    if (!allowedUsers.includes(interaction.user.id)) {
        await interaction.reply({ content: 'You do not have permission.', ephemeral: true });
        return;
    }

    const enabled = interaction.options.getBoolean('enabled');

    // Ensure guild exists before inserting into guild_settings
    await interaction.client.db.query(`
        INSERT INTO guilds (guild_id, name)
        VALUES ($1, $2)
        ON CONFLICT (guild_id) DO NOTHING
    `, [interaction.guild.id, interaction.guild.name]);

    await interaction.client.db.query(`
        INSERT INTO guild_settings (guild_id, autorole_enabled)
        VALUES ($1, $2)
        ON CONFLICT (guild_id) DO UPDATE SET autorole_enabled = EXCLUDED.autorole_enabled
    `, [interaction.guild.id, enabled]);

    await interaction.reply(`Auto role is now **${enabled ? "enabled" : "disabled"}**.`);
}