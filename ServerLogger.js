class ServerLogger {

    constructor(db) {
        this.db = db;
    }

    async logMessage(message) {
        if(!message.guild) return;

        await Promise.all([
            this.upsertGuild(message.guild),
            this.upsertChannel(message.channel),
            this.upsertUser(message.author),
        ]);

        try {
            const attachmentArray = [...message.attachments.values()].map(a => ({
                id: a.id,
                url: a.url,
                name: a.name,
                contentType: a.contentType,
                size: a.size
            }));

            await this.db.query(`
                INSERT INTO messages (
                    message_id, guild_id, channel_id, channel_name,
                    user_id, content, attachments, timestamp, edited_timestamp, deleted
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
                ON CONFLICT (message_id) DO NOTHING;
            `, [
                message.id,
                message.guild.id,
                message.channel.id,
                message.channel.name,
                message.author.id,
                message.content,
                JSON.stringify(attachmentArray),
                new Date(message.createdTimestamp),
                null,
                false
            ]);
        } catch(error) {
            console.error("DB Insert Error:", error);
        }
    }

    async upsertGuild(guild) {
        await this.db.query(`
            INSERT INTO guilds (guild_id, name)
            VALUES ($1, $2)
            ON CONFLICT (guild_id)
            DO UPDATE SET name = EXCLUDED.name;
        `, [guild.id, guild.name]);
    }

    async upsertChannel(channel) {
        if (!channel.guild) return;

        await this.db.query(`
            INSERT INTO channels (channel_id, name, guild_id, channel_type)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (channel_id)
            DO UPDATE SET
                name = EXCLUDED.name,
                channel_type = EXCLUDED.channel_type;
        `, [
            channel.id,
            channel.name,
            channel.guild.id,
            channel.type.toString()
        ]);
    }

    async upsertUser(user) {
        await this.db.query(`
            INSERT INTO users (user_id, username, global_name, is_bot)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_id)
            DO UPDATE SET
                username = EXCLUDED.username,
                global_name = EXCLUDED.global_name,
                is_bot = EXCLUDED.is_bot;
        `, [
            user.id,
            user.username,
            user.globalName || null,
            user.bot
        ]);
    }

    async logEdit(newMsg) {
        try {
            const result = await this.db.query(
                `UPDATE messages SET content = $1, edited_timestamp = $2 WHERE message_id = $3`,
                [newMsg.content, new Date(newMsg.editedTimestamp), newMsg.id]
            );
            if (result.rowCount === 0) {
                console.warn(`logEdit: message ${newMsg.id} not found in DB`);
            }
        } catch(error) {
            console.error("logEdit Error:", error);
        }
    }

    async logDelete(message) {
        try {
            await this.db.query(
                `UPDATE messages SET deleted = TRUE WHERE message_id = $1`,
                [message.id]
            );
        } catch(error) {
            console.error("logDelete Error:", error);
        }
    }

    async logMemberEvent(member, eventType) {
        try {
            await this.upsertGuild(member.guild);
            await this.upsertUser(member.user);

            await this.db.query(`
                INSERT INTO member_events (guild_id, user_id, event_type)
                VALUES ($1, $2, $3)
            `, [member.guild.id, member.user.id, eventType]);
        } catch(error) {
            console.error(`logMemberEvent Error (${eventType}):`, error);
        }
    }

    async getLogChannel(guildId) {
        try {
            const result = await this.db.query(
                `SELECT log_channel_id FROM guild_settings WHERE guild_id = $1`,
                [guildId]
            );
            return result.rows[0]?.log_channel_id || null;
        } catch(error) {
            console.error("getLogChannel Error:", error);
            return null;
        }
    }

    async getUserMessages(userId, guildId, limit = 25) {
        try {
            const result = await this.db.query(`
                SELECT
                    m.message_id,
                    m.content,
                    m.channel_name,
                    m.timestamp,
                    m.edited_timestamp,
                    m.deleted,
                    m.attachments
                FROM messages m
                WHERE m.user_id = $1 AND m.guild_id = $2
                ORDER BY m.timestamp DESC
                LIMIT $3
            `, [userId, guildId, limit]);
            return result.rows;
        } catch(error) {
            console.error("getUserMessages Error:", error);
            return [];
        }
    }
}

export { ServerLogger };