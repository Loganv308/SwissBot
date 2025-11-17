const fs = require('node:fs');
const path = require('node:path');
const { Client, Events } = require('discord.js');
const { autoRoleId, databaseHost, databaseUser, databasePass, databaseName } = require('./config.json');
const autoroleCommand = require('./commands/management/autorole.js');
const { Player } = require("discord-player");
const { ServerLogger } = require("./ServerLogger.js");
const { Pool } = require("pg");

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

        // Attach Player instance to the client
        this.player = new Player(this);

        this.commands = new Map();
        this.loadCommands();
        this.registerEvents();
    }

    // Load all command files
    loadCommands() {
        const commandsFolder = path.join(__dirname, 'commands');
        const dirents = fs.readdirSync(commandsFolder, { withFileTypes: true });

        for (const dirent of dirents) {
            if (dirent.isDirectory()) {
                const subFolder = path.join(commandsFolder, dirent.name);
                const cmdFiles = fs.readdirSync(subFolder).filter(f => f.endsWith('.js'));

                for (const file of cmdFiles) {
                    const filePath = path.join(subFolder, file);
                    const command = require(filePath);

                    if (command.data && command.execute) {
                        this.commands.set(command.data.name, command);
                    } else {
                        console.log(`[WARNING] Missing "data" or "execute" in ${filePath}`);
                    }
                }
            } else if (dirent.isFile() && dirent.name.endsWith('.js')) {
                const filePath = path.join(commandsFolder, dirent.name);
                const command = require(filePath);

                if (command.data && command.execute) {
                    this.commands.set(command.data.name, command);
                }
            }
        }
    }

    // Register event handlers
    registerEvents() {
        this.once(Events.ClientReady, client => {
            console.log(`Ready! Logged in as ${client.user.tag}`);
            this.commands.forEach(cmd => {
                console.log("Loaded command:", cmd.data.name);
            });
        });

        // Auto-role event
        this.on('guildMemberAdd', async member => {
            if (!autoroleCommand.autoRoleEnabled()) return;

            try {
                await member.roles.add(autoRoleId);
                console.log(`Auto role added to ${member.user.tag}`);
            } catch (error) {
                console.log("Failed to add role:", error);
            }
        });

        this.on("messageCreate", async (message) => {
            const logger = new ServerLogger(this.db);
            
            // Ignore bots
            if (message.author.bot) return;

            await logger.upsertGuild(message.guild);
            await logger.upsertChannel(message.channel);
            await logger.upsertUser(message.author);
            await logger.logMessage(message);
        });

        // Slash command handler
        this.on(Events.InteractionCreate, async interaction => {
            if (!interaction.isChatInputCommand()) return;

            const command = this.commands.get(interaction.commandName);
            if (!command) return interaction.reply({ content: "Unknown command!", ephemeral: true });

            try {
                await command.execute(interaction);
            } catch (err) {
                console.error(err);
                await interaction.reply({ content: "There was an error!", ephemeral: true });
            }
        });
    }
}

module.exports = BotClient;
