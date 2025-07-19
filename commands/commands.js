const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('commands')
        .description('Lists all commands available'),
    async execute(interaction){
        await interaction.reply();
    }
};