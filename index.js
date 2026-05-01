import { GatewayIntentBits } from 'discord.js';
import config from './config.json' with { type: 'json' };
import BotClient from './BotClient.js';

const { token } = config;

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