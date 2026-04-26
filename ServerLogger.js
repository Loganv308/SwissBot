class ServerLogger {

    constructor(db) {
        this.db = db;
    }

    async logMessage(message) {
    
        if(!message.guild) return; // Ignores DMs

        await Promise.all([
            this.upsertGuild(message.guild),
            this.upsertChannel(message.channel),
            this.upsertUser(message.author),
        ]);

        try {

            const query = `
                INSERT INTO messages (
                    message_id,
                    guild_id,
                    channel_id,
                    channel_name,
                    user_id,
                    content,
                    attachments,
                    timestamp,
                    edited_timestamp,
                    deleted
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
                ON CONFLICT (message_id) DO NOTHING;
            `;

            const attachmentArray = [...message.attachments.values()].map(a => ({
                id: a.id,
                url: a.url,
                name: a.name,
                contentType: a.contentType,
                size: a.size
            }));

            const values = [
                message.id,                        // message_id (bigint)
                message.guild.id,                  // guild_id
                message.channel.id,                // channel_id
                message.channel.name,              // channel_name (text)
                message.author.id,                 // user_id
                message.content,                   // content (text)
                attachmentArray,   // attachments (jsonb)
                new Date(newMsg.editedTimestamp),// timestamp
                null,                              // edited_timestamp (default null)
                false                              // deleted (default false)
            ];

            await this.db.query(query, values);

        } catch(error) {
            console.error("DB Insert Error: ", error)
        }
    }

    async upsertGuild(guild) {
        const query = `
            INSERT INTO guilds (guild_id, name)
            VALUES ($1, $2)
            ON CONFLICT (guild_id)
            DO UPDATE SET name = EXCLUDED.name;
        `;

        const values = [
            guild.id,
            guild.name
        ];

        await this.db.query(query, values);
    }

    async upsertChannel(channel) {
        // If the channel does not have a guild then stop
        if (!channel.guild) return;

        const query = `
            INSERT INTO channels (
                channel_id,
                channel_name,
                guild_id,
                name,
                channel_type
            )
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (channel_id)
            DO UPDATE SET
                channel_name = EXCLUDED.channel_name,
                name = EXCLUDED.name,
                channel_type = EXCLUDED.channel_type;
        `;

        const values = [
            channel.id,
            channel.name,
            channel.guild.id,
            channel.name,
            channel.type.toString() // store as text
        ];

        await this.db.query(query, values);
    }

    async upsertUser(user) {
        const query = `
            INSERT INTO users (
                user_id,
                username,
                global_name,
                is_bot
            )
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_id)
            DO UPDATE SET
                username = EXCLUDED.username,
                global_name = EXCLUDED.global_name,
                is_bot = EXCLUDED.is_bot;
        `;

        const values = [
            user.id,
            user.username,
            user.globalName || null,
            user.bot
        ];

        await this.db.query(query, values);
    }

    async logEdit(newMsg) {
        const result = await this.db.query(
            `UPDATE messages SET content = $1, edited_timestamp = NOW() WHERE message_id = $2`,
            [newMsg.content, newMsg.id]
        );
        if (result.rowCount === 0) {
            console.warn(`logEdit: message ${newMsg.id} not found in DB`);
        }
    }

    async logDelete(message) {
        try {
            await this.db.query(`UPDATE messages SET deleted = TRUE WHERE message_id = $1`, [message.id]);
        } catch (error) {
            console.error("logDelete Error:", error);
        }
    }
}

export { ServerLogger };
