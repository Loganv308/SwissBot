const { REST, Routes } = require('discord.js');
const { clientId, guildId, token } = require('./config.json');
const fs = require('node:fs');
const path = require('node:path');

// Construct and prepare an instance of the REST module
const commands = [];

// Grab all the command folders from the commands directory
const foldersPath = path.join(__dirname, 'commands');

// Read the command folders and filter out only directories
const commandFolders = fs.readdirSync(foldersPath, { withFileTypes: true });

// For each dirent in the commands folder
for (const dirent of commandFolders) {
    
    // if the direct is a directory
    if (dirent.isDirectory()) {
        
        // The commands path is set to the folder path + the dirent.name (name of the file).
        const commandsPath = path.join(foldersPath, dirent.name);

        // The command files are filtered to only include .js files
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

        // For each command file, the file path is set to the commands path + the file name
        for (const file of commandFiles) {
            // The file path is set to the commands path + the file name
            const filePath = path.join(commandsPath, file);
            // The command is required from the file path
            const command = require(filePath);
            // If the command has a data and execute property, it is pushed to the commands array as a JSON object
            if ('data' in command && 'execute' in command) {
                // The command data is converted to JSON and pushed to the commands array
                commands.push(command.data.toJSON());
            } else {
                // If the command is missing a data or execute property, a warning is logged to the console
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
const rest = new REST({ version: '10' }).setToken(token);

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
