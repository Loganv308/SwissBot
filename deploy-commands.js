import { REST, Routes } from 'discord.js';
import config from './config.json' with { type: 'json' };
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const { clientId, guildId, token } = config;
const __dirname = dirname(fileURLToPath(import.meta.url));
const commands = [];
const foldersPath = join(__dirname, 'commands');
const commandFolders = readdirSync(foldersPath, { withFileTypes: true });

for (const dirent of commandFolders) {
    if (dirent.isDirectory()) {
        const commandsPath = join(foldersPath, dirent.name);
        const commandFiles = readdirSync(commandsPath).filter(f => f.endsWith('.js'));

        for (const file of commandFiles) {
            const command = await import(pathToFileURL(join(commandsPath, file)).href);
            if ('data' in command && 'execute' in command) {
                commands.push(command.data.toJSON());
            } else {
                console.log(`[WARNING] ${file} is missing "data" or "execute".`);
            }
        }
    } else if (dirent.isFile() && dirent.name.endsWith('.js')) {
        const command = await import(pathToFileURL(join(foldersPath, dirent.name)).href);
        if ('data' in command && 'execute' in command) {
            commands.push(command.data.toJSON());
        } else {
            console.log(`[WARNING] ${dirent.name} is missing "data" or "execute".`);
        }
    }
}

const rest = new REST({ version: '10' }).setToken(token);

try {
    console.log(`Started refreshing ${commands.length} bot (/) commands.`);
    const data = await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commands }
    );
    console.log(`Successfully reloaded ${data.length} application (/) commands.`);
} catch (error) {
    console.error(error);
}