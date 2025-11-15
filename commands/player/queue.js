const { SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
const { Player, useQueue } = require("discord-player");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Shows the current music queue'),

    async execute(interaction, player) {

        const userChannel = interaction.member.voice.channel;

        // User MUST be in a voice channel
        if (!userChannel) {
            return interaction.reply({
                content: "You must join a voice channel first!",
                ephemeral: true,
            });
        }

        // Bot joins the user's channel
        joinVoiceChannel({
            channelId: userChannel.id,
            guildId: interaction.guild.id,
            adapterCreator: interaction.guild.voiceAdapterCreator,
        });

        // Fetch queue
        const queue = useQueue();

        if (!queue || !queue.current) {
            return interaction.reply({
                content: "No songs in the queue!",
                ephemeral: true,
            });
        }

        // Trim long text helper
        const trimString = (str, max) =>
            str.length > max ? `${str.slice(0, max - 3)}...` : str;

        // Build queue text
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
    },
}