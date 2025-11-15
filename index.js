// Require the necessary discord.js classes
const fs = require('node:fs');
const path = require('node:path');
const { Client, Events, GatewayIntentBits, TeamMemberMembershipState } = require('discord.js');
const { token, autoRoleId } = require('./config.json');
const autoroleCommand = require('./commands/management/autorole.js');

// Create a new client instance
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers, // This part is needed for adding to role
        GatewayIntentBits.GuildMessages
    ] });

client.commands = new Map();

const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath, { withFileTypes: true });

for (const dirent of commandFolders) {
    if (dirent.isDirectory()) {
        const commandsPath = path.join(foldersPath, dirent.name);
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const command = require(filePath);
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
            } else {
                console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
            }
        }
    } else if (dirent.isFile() && dirent.name.endsWith('.js')) {
        // Direct JS file in the 'commands' folder
        const filePath = path.join(foldersPath, dirent.name);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        } else {
            console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    }
}

// When the client is ready, it will run this code (only once).
client.once(Events.ClientReady, readyClient => {
	console.log(`Ready! Logged in as ${readyClient.user.tag}`);

    client.commands.forEach((command, name) => {
        const commandName = command.data?.name || command.data?.toJSON().name;
        console.log('Command name:', commandName);
    })
});

// Using the 'guildMemberAdd' property (when a user joins the server)
client.on('guildMemberAdd', async member => {
    if (!autoroleCommand.autoRoleEnabled()) return;

    const AUTO_ROLE_ID = autoRoleId;

    try {
        await member.roles.add(AUTO_ROLE_ID);
        console.log(`Auto role added to: ${member.user.tag}`);
    } catch (error) {
        console.log('Failed to add role:', error);
    }
});

// Checks if there was a command given 
client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand()) return;
	
	const command = client.commands.get(interaction.commandName);

	if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	}

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
		} else {
			await interaction.reply({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
		}
	}
});

// Log in to Discord with your client's token
client.login(token);
