import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { useQueue, QueueRepeatMode } from 'discord-player';

export const data = new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Set the loop mode')
    .addStringOption(option =>
        option.setName('mode')
            .setDescription('Loop mode')
            .setRequired(true)
            .addChoices(
                { name: 'Off',      value: 'off'      },
                { name: 'Track',    value: 'track'    },
                { name: 'Queue',    value: 'queue'    },
                { name: 'Autoplay', value: 'autoplay' },
            )
    );

export async function execute(interaction) {
    const queue = useQueue(interaction.guild.id);

    if (!queue?.currentTrack) {
        return interaction.reply({ content: '❌ Nothing is playing.', ephemeral: true });
    }
    if (!interaction.member.voice.channel) {
        return interaction.reply({ content: '❌ You must be in a voice channel.', ephemeral: true });
    }

    const mode = interaction.options.getString('mode');
    const modeMap = {
        off:      { value: QueueRepeatMode.OFF,      label: '➡️ Off',      color: 0x99AAB5 },
        track:    { value: QueueRepeatMode.TRACK,    label: '🔂 Track',    color: 0x1DB954 },
        queue:    { value: QueueRepeatMode.QUEUE,    label: '🔁 Queue',    color: 0x5865F2 },
        autoplay: { value: QueueRepeatMode.AUTOPLAY, label: '🔀 Autoplay', color: 0xFEE75C },
    };

    const selected = modeMap[mode];
    queue.setRepeatMode(selected.value);

    const embed = new EmbedBuilder()
        .setTitle('🔁 Loop Mode')
        .setDescription(`Loop set to **${selected.label}**`)
        .setColor(selected.color)
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}