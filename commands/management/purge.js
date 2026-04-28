import { 
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    ChannelType  // add this
} from 'discord.js';
import config from '../../config.json' with { type: 'json' };

const { allowedUsers } = config;

const CAP = 1000;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchUserMessages(channel, userId, cap) {
    const messages = [];
    let lastId = null;

    while (messages.length < cap) {
        const options = { limit: 100 };
        if (lastId) options.before = lastId;

        const batch = await channel.messages.fetch(options);
        if (batch.size === 0) break;

        const userMessages = [...batch.values()].filter(m => m.author.id === userId);
        messages.push(...userMessages);
        lastId = batch.last().id;

        await sleep(500);
    }

    return messages.slice(0, cap);
}

export const data = new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Purge all messages from a user across all channels')
    .addUserOption(option =>
        option.setName('user')
            .setDescription('The user to purge (if still in server)')
            .setRequired(false)
    )
    .addStringOption(option =>
        option.setName('userid')
            .setDescription('The user ID to purge (if no longer in server)')
            .setRequired(false)
    );

export async function execute(interaction) {
    if (!allowedUsers.includes(interaction.user.id)) {
        await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        return;
    }

    const targetUser = interaction.options.getUser('user');
    const targetId   = interaction.options.getString('userid');

    if (!targetUser && !targetId) {
        await interaction.reply({ content: '❌ Please provide either a user or a user ID.', ephemeral: true });
        return;
    }

    let target;
    if (targetUser) {
        target = targetUser;
    } else {
        try {
            target = await interaction.client.users.fetch(targetId);
        } catch {
            await interaction.reply({ content: `❌ Could not find a user with ID \`${targetId}\`. Double check the ID and try again.`, ephemeral: true });
            return;
        }
    }

    const guild = interaction.guild; // defined here, after early returns

    await interaction.deferReply({ ephemeral: true });
    await guild.channels.fetch();

    const textChannels = [...guild.channels.cache.filter(c =>
        c.type === ChannelType.GuildText && c.viewable
    ).values()];

    await interaction.editReply({
        content: `🔍 Scanning all channels for messages from **${target.tag}**... this may take a moment.`
    });

    let totalEstimate = 0;
    const channelCounts = [];

    for (const [index, channel] of textChannels.entries()) {
        try {
            await interaction.editReply({
                content: `🔍 Scanning channel ${index + 1}/${textChannels.length}: #${channel.name}...`
            });

            const messages = await fetchUserMessages(channel, target.id, CAP);
            if (messages.length > 0) {
                channelCounts.push({ channel, messages });
                totalEstimate += messages.length;
            }
        } catch(err) {
            console.error(`Purge scan failed for #${channel.name}:`, err.message);
        }
    }

    if (totalEstimate === 0) {
        await interaction.editReply({ content: `No messages found from **${target.tag}** in any channel.` });
        return;
    }

    const isCapped = totalEstimate >= CAP;
    const now      = Date.now();
    const cutoff   = now - 14 * 24 * 60 * 60 * 1000;

    let bulkCount = 0;
    let slowCount = 0;

    for (const { messages } of channelCounts) {
        for (const m of messages) {
            if (m.createdTimestamp > cutoff) bulkCount++;
            else slowCount++;
        }
    }

    const channelBreakdown = channelCounts
        .map(({ channel, messages }) => `#${channel.name}: **${messages.length}** messages`)
        .join('\n');

    const estimatedTime = slowCount > 0
        ? `~${Math.ceil(slowCount / 60)} minute(s) (1/sec rate limit)`
        : null;

    const confirmEmbed = new EmbedBuilder()
        .setTitle('⚠️ Confirm Purge')
        .setColor(0xED4245)
        .setDescription(
            `You are about to purge messages from **${target.tag}** (<@${target.id}>).\n\n` +
            `**This action is irreversible.**`
        )
        .addFields(
            { name: '📊 Messages Found', value: `**${totalEstimate}**${isCapped ? ` (capped at ${CAP})` : ''}`, inline: true },
            { name: '⚡ Bulk Delete (<14 days)', value: `${bulkCount}`, inline: true },
            { name: '🐢 One-by-one (>14 days)', value: `${slowCount}`, inline: true },
            { name: '📋 Channel Breakdown', value: channelBreakdown || 'None', inline: false },
        )
        .setFooter({ text: 'This confirmation expires in 30 seconds' })
        .setTimestamp();

    if (estimatedTime) {
        confirmEmbed.addFields({ name: '⏱️ Estimated Time', value: estimatedTime, inline: false });
    }

    if (isCapped) {
        confirmEmbed.addFields({
            name: '⚠️ Cap Reached',
            value: `Only the first ${CAP} messages per scan were counted. There may be more.`,
            inline: false
        });
    }

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('purge_confirm')
            .setLabel('Confirm Purge')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('purge_cancel')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary)
    );

    const response = await interaction.editReply({
        content: '',
        embeds: [confirmEmbed],
        components: [row]
    });

    try {
        const button = await response.awaitMessageComponent({
            componentType: ComponentType.Button,
            time: 120000, // 2 minutes instead of 30 seconds
            filter: i => i.user.id === interaction.user.id
        });

        if (button.customId === 'purge_cancel') {
            await button.update({ content: '❌ Purge cancelled.', embeds: [], components: [] });
            return;
        }

        await button.update({
            content: `🗑️ Purging messages from **${target.tag}**... I'll DM you when done.`,
            embeds: [],
            components: []
        });

        let totalDeleted = 0;
        let totalFailed  = 0;

        for (const { channel, messages } of channelCounts) {
            const recent = messages.filter(m => m.createdTimestamp > cutoff);
            const old    = messages.filter(m => m.createdTimestamp <= cutoff);

            if (recent.length > 0) {
                for (let i = 0; i < recent.length; i += 100) {
                    const batch = recent.slice(i, i + 100);
                    try {
                        await channel.bulkDelete(batch);
                        totalDeleted += batch.length;
                    } catch(err) {
                        console.error(`Bulk delete failed in #${channel.name}:`, err.message);
                        totalFailed += batch.length;
                    }
                    await sleep(1000);
                }
            }

            for (const message of old) {
                try {
                    await message.delete();
                    totalDeleted++;
                } catch(err) {
                    console.error(`Failed to delete message ${message.id}:`, err.message);
                    totalFailed++;
                }
                await sleep(1100);
            }

            try {
                await interaction.client.db.query(`
                    UPDATE messages SET deleted = TRUE
                    WHERE user_id = $1 AND channel_id = $2
                `, [target.id, channel.id]);
            } catch(err) {
                console.error(`Failed to update DB for #${channel.name}:`, err.message);
            }

            console.log(`Purge: #${channel.name} done — ${recent.length + old.length} processed`);
        }

        await interaction.user.send(
            `✅ **Purge complete for ${target.tag}**\n` +
            `🗑️ Deleted: **${totalDeleted}**\n` +
            `❌ Failed: **${totalFailed}**`
        );

    } catch(err) {
        if (err.code === 'InteractionCollectorError') {
            await interaction.editReply({ content: '⏰ Purge confirmation timed out.', embeds: [], components: [] });
        } else {
            console.error('Purge error:', err);
            await interaction.user.send(`❌ Purge failed: ${err.message}`);
        }
    }
}