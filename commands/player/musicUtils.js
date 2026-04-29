// Shared helper — checks voice channel and returns queue-ready voice channel
export function getVoiceChannel(interaction) {
    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) return null;
    return voiceChannel;
}

export function formatBar(current, total, length = 15) {
    const progress  = Math.floor((current / total) * length);
    const filled    = '▓'.repeat(progress);
    const empty     = '░'.repeat(length - progress);
    return `${filled}${empty}`;
}

export function msToTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const hours    = Math.floor(totalSec / 3600);
    const minutes  = Math.floor((totalSec % 3600) / 60);
    const seconds  = totalSec % 60;

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}