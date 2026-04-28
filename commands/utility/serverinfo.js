import { SlashCommandBuilder, EmbedBuilder, ChannelType } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Display detailed information about this server');

export async function execute(interaction) {
    await interaction.deferReply();

    const guild = interaction.guild;
    await guild.fetch(); // Ensure all fields are populated

    const owner = await guild.fetchOwner();

    const textChannels  = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
    const voiceChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;
    const categories    = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).size;
    const roles         = guild.roles.cache.size - 1; // Subtract @everyone

    const verificationLevels = {
        0: 'None',
        1: 'Low',
        2: 'Medium',
        3: 'High',
        4: 'Very High'
    };

    const embed = new EmbedBuilder()
        .setTitle(guild.name)
        .setColor(0x5865F2)
        .setThumbnail(guild.iconURL({ size: 256 }))
        .addFields(
            { name: 'Owner', value: `<@${owner.id}> (${owner.user.tag})`, inline: true },
            { name: 'Server ID', value: guild.id, inline: true },
            { name: 'Created At', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`, inline: false },
            { name: 'Members', value: `${guild.memberCount}`, inline: true },
            { name: 'Roles', value: `${roles}`, inline: true },
            { name: 'Channels', value: `💬 ${textChannels} Text\n🔊 ${voiceChannels} Voice\n📁 ${categories} Categories`, inline: true },
            { name: 'Boost Level', value: `Level ${guild.premiumTier}`, inline: true },
            { name: 'Boosts', value: `${guild.premiumSubscriptionCount}`, inline: true },
            { name: 'Verification Level', value: verificationLevels[guild.verificationLevel], inline: true },
        )
        .setTimestamp();

    if (guild.banner) {
        embed.setImage(guild.bannerURL({ size: 1024 }));
    }

    await interaction.editReply({ embeds: [embed] });
}