const { GatewayIntentBits } = require('discord.js');
const { token } = require('./config.json');
const BotClient = require('./BotClient');

const client = new BotClient({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent
    ]
});

client.login(token);