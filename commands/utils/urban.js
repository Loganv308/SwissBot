import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

const NSFW_PATTERN = /\b(porn|sex|fuck|shit|ass|dick|cock|pussy|nude|naked|cum|horny|fetish|bdsm|rape|hentai|masturbat)\b/gi;

function isNSFW(text) {
    return NSFW_PATTERN.test(text);
}

function cleanText(text) {
    // Urban Dictionary wraps linked terms in brackets e.g. [word]
    return text.replace(/\[([^\]]+)\]/g, '$1').trim();
}

export const data = new SlashCommandBuilder()
    .setName('urban')
    .setDescription('Look up a term on Urban Dictionary')
    .addStringOption(option =>
        option.setName('term')
            .setDescription('The term to look up')
            .setRequired(true)
    );

export async function execute(interaction) {
    await interaction.deferReply();

    const term = interaction.options.getString('term');

    if (isNSFW(term)) {
        await interaction.editReply({ content: '❌ That term is not allowed.' });
        return;
    }

    try {
        const response = await fetch(`https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(term)}`);
        const data = await response.json();

        if (!data.list || data.list.length === 0) {
            await interaction.editReply({ content: `No results found for **${term}**.` });
            return;
        }

        // Find first non-NSFW result
        const result = data.list.find(entry => {
            const combined = `${entry.definition} ${entry.example}`;
            return !isNSFW(combined);
        });

        console.log('UD raw result:', JSON.stringify(result, null, 2));

        if (!result) {
            await interaction.editReply({ content: `❌ No safe results found for **${term}**.` });
            return;
        }

        const definition = cleanText(result.definition).slice(0, 1024);
        const example    = cleanText(result.example).slice(0, 1024) || '*No example provided*';

        const embed = new EmbedBuilder()
            .setTitle(`📖 ${result.word}`)
            .setURL(result.permalink)
            .setColor(0x1D2439)
            .addFields(
                { name: 'Definition', value: definition, inline: false },
                { name: 'Example', value: example, inline: false },
            )
            .setFooter({ text: `Written by ${result.author}` })
            .setTimestamp(new Date(result.written_on));

        await interaction.editReply({ embeds: [embed] });

    } catch(error) {
        console.error('Urban Dictionary Error:', error);
        await interaction.editReply({ content: 'Failed to fetch results. Try again later.' });
    }
}