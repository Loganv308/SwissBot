const { REST, Routes } = require('discord.js');
const { clientId, guildId, token } = require('./config.json');
const fs = require('node:fs');
const path = require('node:path');

const commands = [];
// Grab all the command folders from the commands directory
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath, { withFileTypes: true });

// For each dirent in the commands folder
for (const dirent of commandFolders) {
    // if the direct is a directory
    if (dirent.isDirectory()) {
        // The commands path is set to the folder path + the dirent.name (name of the file).
        const commandsPath = path.join(foldersPath, dirent.name);
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const command = require(filePath);
            if ('data' in command && 'execute' in command) {
                commands.push(command.data.toJSON());
            } else {
                console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
            }
        }
    } else if (dirent.isFile() && dirent.name.endsWith('.js')) {
        // Direct JS file in the 'commands' folder
        const filePath = path.join(foldersPath, dirent.name);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            commands.push(command.data.toJSON());
        } else {
            console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    }
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(token);

// Deploy commands
(async () => {
	try {
        // Logging to signify start of refreshing commands.
		console.log(`Started refreshing ${commands.length} bot (/) commands.`);

		// The put method is used to fully refresh all commands in the guild with the current set.
		const data = await rest.put(
			Routes.applicationGuildCommands(clientId, guildId),
			{ body: commands },
		);
        // Signifying application commands have been reloaded
		console.log(`Successfully reloaded ${data.length} application (/) commands.`);
	} catch (error) {
		// Catch errors
		console.error(error);
	}
})();
