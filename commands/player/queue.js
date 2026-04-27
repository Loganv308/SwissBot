import { SlashCommandBuilder } from 'discord.js';
import { joinVoiceChannel } from '@discordjs/voice';
import { useQueue } from 'discord-player';

export const data = new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Shows the current music queue');

export async function execute(interaction) {
    const userChannel = interaction.member.voice.channel;

    if (!userChannel) {
        return interaction.reply({
            content: "You must join a voice channel first!",
            ephemeral: true,
        });
    }

    const queue = useQueue(interaction.guild.id);

    if (!queue || !queue.current) {
        return interaction.reply({
            content: "No songs in the queue!",
            ephemeral: true,
        });
    }

    const trimString = (str, max) =>
        str.length > max ? `${str.slice(0, max - 3)}...` : str;

    const queueList = queue.tracks
        .slice(0, 10)
        .map((track, i) => `${i + 1}. **${track.title}**`)
        .join("\n");

    return interaction.reply({
        embeds: [{
            title: "🎶 Now Playing",
            description: trimString(
                `**Current:** ${queue.current.title}\n\n` +
                (queueList.length > 0 ? `**Up Next:**\n${queueList}` : ""),
                4095
            ),
        }],
    });
}