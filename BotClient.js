import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Client, Events } from 'discord.js';
import { ServerLogger } from './ServerLogger.js';
import { Pool } from 'pg';
import { Player } from 'discord-player';

import config from './config.json' with { type: 'json' };

const __dirname = dirname(fileURLToPath(import.meta.url));

const { databaseHost, databaseUser, databasePass, databaseName } = config;

class BotClient extends Client {
    constructor(options) {
        super(options);

        this.db = new Pool({
            host: databaseHost,
            user: databaseUser,
            password: databasePass,
            database: databaseName,
            port: 5432
        });

        this.player = new Player(this);
        this.commands = new Map();
        this.logger = new ServerLogger(this.db);

        this.loadCommands();
        this.registerEvents();
    }

    async loadCommands() {
        const commandsFolder = join(__dirname, 'commands');
        const dirents = readdirSync(commandsFolder, { withFileTypes: true });

        for (const dirent of dirents) {
            if (dirent.isDirectory()) {
                const subFolder = join(commandsFolder, dirent.name);
                const cmdFiles = readdirSync(subFolder).filter(f => f.endsWith('.js'));

                for (const file of cmdFiles) {
                    const command = await import(pathToFileURL(join(subFolder, file)).href);
                    if (command.data && command.execute) {
                        this.commands.set(command.data.name, command);
                    } else {
                        console.log(`[WARNING] Missing "data" or "execute" in ${file}`);
                    }
                }
            } else if (dirent.isFile() && dirent.name.endsWith('.js')) {
                const command = await import(pathToFileURL(join(commandsFolder, dirent.name)).href);
                if (command.data && command.execute) {
                    this.commands.set(command.data.name, command);
                }
            }
        }
    }

    registerEvents() {
        this.once(Events.ClientReady, client => {
            console.log(`Ready! Logged in as ${client.user.tag}`);
            this.commands.forEach(cmd => console.log("Loaded command:", cmd.data.name));
        });

        this.on('guildMemberAdd', async member => {
            try {
                const result = await this.db.query(
                    `SELECT autorole_id, autorole_enabled FROM guild_settings WHERE guild_id = $1`,
                    [member.guild.id]
                );

                const settings = result.rows[0];
                if (!settings?.autorole_enabled || !settings?.autorole_id) return;

                await member.roles.add(settings.autorole_id);
                console.log(`Auto role added to ${member.user.tag}`);
            } catch (error) {
                console.error("Failed to add auto role:", error);
            }
        });

        this.on(Events.MessageCreate, async message => {
            if (message.author.bot) return;
            await this.logger.logMessage(message);
        });

        this.on(Events.MessageUpdate, async (oldMsg, newMsg) => {
            if (newMsg.author?.bot) return;
            await this.logger.logEdit(newMsg);
        });

        this.on(Events.MessageDelete, async message => {
            await this.logger.logDelete(message);
        });

        this.on(Events.InteractionCreate, async interaction => {
            if (!interaction.isChatInputCommand()) return;

            const command = this.commands.get(interaction.commandName);
            if (!command) return interaction.reply({ content: "Unknown command!", ephemeral: true });

            try {
                await command.execute(interaction);
            } catch (err) {
                console.error(err);
                const reply = { content: "There was an error!", ephemeral: true };
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(reply);
                } else {
                    await interaction.reply(reply);
                }
            }
        });
    }
}

export default BotClient;