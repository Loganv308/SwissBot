const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setNamRe('server')
		.setDescription('Provides information about the server.'),
	async execute(interaction) {
		// interaction.guild is the object representing the Guild in which the command was run
		await interaction.reply({
			content: `This server is ${interaction.guild.name} and has ${interaction.guild.memberCount} members.`,
			// By adding ephemeral, the reply will only be visible to the user who ran the command.
			ephemeral: true
		});
	},
};
