const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('commands')
        .setDescription('Lists all commands available'),
    async execute(interaction){

        const commands = interaction.client.commands;

        const list = [...commands.keys()]
            .map(cmd => `• \`/${cmd}\``)
            .join("\n");

        await interaction.reply({
            content: `Here is the list of available commands:\n${list}`,
            ephemeral: true
        });
    }
};