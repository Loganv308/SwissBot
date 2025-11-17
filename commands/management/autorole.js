const { SlashCommandBuilder } = require('discord.js');
const { allowedUsers } = require('../../config.json');

let autoRoleEnabled = true;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('autorole')
        .setDescription('Enable or disable auto role assignment')
        .addBooleanOption(option =>
            option.setName('enabled')
                .setDescription('True = On, False = Off')
                .setRequired(true)
        ),

    async execute(interaction) {
        if (!allowedUsers.includes(interaction.user.id)) {
            await interaction.reply({
                content: 'You do not have permission to use this command.',
                ephemeral: true
            });
            return;
        } else {
            autoRoleEnabled = interaction.options.getBoolean('enabled');
            await interaction.reply(`Auto role is now **${autoRoleEnabled ? "enabled" : "disabled"}**.`);
        }        
    },

    autoRoleEnabled: () => autoRoleEnabled
};