const { SlashCommandBuilder, escapeStrikethrough } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('user')
		.setDescription('Provides information about the user.'),
	async execute(interaction) {
		// interaction.user is the object representing the User who ran the command
		// interaction.member is the GuildMember object, which represents the user in the specific guild
		await interaction.reply({
			// The content of the reply includes the username and the date they joined the server
			content: `This command was run by ${interaction.user.username}, who joined on ${interaction.member.joinedAt}.`,
			ephemeral: true
		});
	},
};
