import {
    SlashCommandBuilder,
    ChannelType,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ComponentType
} from 'discord.js';
import config from '../../config.json' with { type: 'json' };
import { ServerLogger } from '../../ServerLogger.js';

const { allowedUsers } = config;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchAllMessages(channel) {
    const messages = [];
    let lastId = null;

    while (true) {
        const options = { limit: 100 };
        if (lastId) options.before = lastId;

        const batch = await channel.messages.fetch(options);
        if (batch.size === 0) break;

        messages.push(...batch.values());
        lastId = batch.last().id;

        await sleep(1000);
    }

    return messages;
}

async function backfillChannel(channel, guild, db, logger) {
    let inserted = 0;
    let skipped  = 0;
    let failed   = 0;

    await logger.upsertChannel(channel);
    const messages = await fetchAllMessages(channel);

    for (const message of messages) {
        if (message.author.bot) {
            skipped++;
            continue;
        }

        try {
            await logger.upsertUser(message.author);

            const attachmentArray = [...message.attachments.values()].map(a => ({
                id: a.id,
                url: a.url,
                name: a.name,
                contentType: a.contentType,
                size: a.size
            }));

            await db.query(`
                INSERT INTO messages (
                    message_id, guild_id, channel_id, channel_name,
                    user_id, content, attachments, timestamp,
                    edited_timestamp, deleted
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
                ON CONFLICT (message_id) DO NOTHING
            `, [
                message.id,
                guild.id,
                channel.id,
                channel.name,
                message.author.id,
                message.content,
                JSON.stringify(attachmentArray),
                new Date(message.createdTimestamp),
                message.editedTimestamp ? new Date(message.editedTimestamp) : null,
                false
            ]);

            inserted++;
        } catch(err) {
            console.error(`Failed to insert message ${message.id}:`, err.message);
            failed++;
        }
    }

    return { inserted, skipped, failed };
}

export const data = new SlashCommandBuilder()
    .setName('backfill')
    .setDescription('Backfill historical messages into the database');

export async function execute(interaction) {
    if (!allowedUsers.includes(interaction.user.id)) {
        await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        return;
    }

    const guild = interaction.guild;
    await guild.channels.fetch();

    const textChannels = [...guild.channels.cache.filter(c =>
        c.type === ChannelType.GuildText && c.viewable
    ).values()];

    if (!textChannels.length) {
        await interaction.reply({ content: '❌ No accessible text channels found.', ephemeral: true });
        return;
    }

    // Build select menu options — Discord caps at 25 options
    const options = [
        new StringSelectMenuOptionBuilder()
            .setLabel('All Channels')
            .setDescription(`Backfill all ${textChannels.length} channels`)
            .setValue('__all__')
            .setEmoji('📋')
    ];

    for (const channel of textChannels.slice(0, 24)) {
        options.push(
            new StringSelectMenuOptionBuilder()
                .setLabel(`#${channel.name}`)
                .setDescription(`Backfill #${channel.name} only`)
                .setValue(channel.id)
                .setEmoji('💬')
        );
    }

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('backfill_select')
        .setPlaceholder('Select a channel to backfill...')
        .addOptions(options);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const response = await interaction.reply({
        content: '📋 Select which channel(s) to backfill:',
        components: [row],
        ephemeral: true
    });

    // Wait for the user to make a selection (60 second timeout)
    try {
        const selection = await response.awaitMessageComponent({
            componentType: ComponentType.StringSelect,
            time: 60000,
            filter: i => i.user.id === interaction.user.id
        });

        const selectedValue = selection.values[0];
        const isAll         = selectedValue === '__all__';
        const channelsToRun = isAll
            ? textChannels
            : [textChannels.find(c => c.id === selectedValue)].filter(Boolean);

        await selection.update({
            content: `⏳ Backfill started for **${isAll ? 'all channels' : `#${channelsToRun[0]?.name}`}**. I'll DM you when done.`,
            components: []
        });

        // Run backfill
        const db     = interaction.client.db;
        const logger = new ServerLogger(db);

        await logger.upsertGuild(guild);

        let totalInserted = 0;
        let totalSkipped  = 0;
        let totalFailed   = 0;
        const channelSummary = [];

        for (const channel of channelsToRun) {
            try {
                console.log(`Backfill: processing #${channel.name}...`);
                const { inserted, skipped, failed } = await backfillChannel(channel, guild, db, logger);

                totalInserted += inserted;
                totalSkipped  += skipped;
                totalFailed   += failed;

                channelSummary.push(`#${channel.name}: ${inserted} inserted, ${skipped} skipped`);
                console.log(`Backfill: #${channel.name} done — ${inserted} inserted, ${skipped} skipped, ${failed} failed`);
            } catch(err) {
                console.error(`Backfill: failed on #${channel.name}:`, err.message);
                channelSummary.push(`#${channel.name}: ❌ failed`);
            }
        }

        // DM summary
        const summaryLines = channelSummary.join('\n');
        const dmContent =
            `✅ **Backfill complete!**\n` +
            `📥 Total Inserted: **${totalInserted}**\n` +
            `⏭️ Total Skipped (bots): **${totalSkipped}**\n` +
            `❌ Total Failed: **${totalFailed}**\n\n` +
            `**Channel breakdown:**\n${summaryLines}`;

        // DM may exceed 2000 chars on large servers — chunk if needed
        if (dmContent.length <= 2000) {
            await interaction.user.send(dmContent);
        } else {
            await interaction.user.send(
                `✅ **Backfill complete!**\n` +
                `📥 Inserted: **${totalInserted}** | ⏭️ Skipped: **${totalSkipped}** | ❌ Failed: **${totalFailed}**`
            );
        }

    } catch(err) {
        if (err.code === 'InteractionCollectorError') {
            await interaction.editReply({ content: '⏰ Backfill selection timed out.', components: [] });
        } else {
            console.error('Backfill error:', err);
            await interaction.user.send(`❌ Backfill failed: ${err.message}`);
        }
    }
}