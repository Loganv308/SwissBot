import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import config from '../../config.json' with { type: 'json' };

const { weatherApiKey } = config;

function getWeatherEmoji(id) {
    if (id >= 200 && id < 300) return '⛈️';
    if (id >= 300 && id < 400) return '🌦️';
    if (id >= 500 && id < 600) return '🌧️';
    if (id >= 600 && id < 700) return '🌨️';
    if (id >= 700 && id < 800) return '🌫️';
    if (id === 800)             return '☀️';
    if (id > 800)               return '⛅';
    return '🌡️';
}

export const data = new SlashCommandBuilder()
    .setName('weather')
    .setDescription('Get the current weather for a city')
    .addStringOption(option =>
        option.setName('city')
            .setDescription('The city to get weather for')
            .setRequired(true)
    );

export async function execute(interaction) {
    await interaction.deferReply();

    const city = interaction.options.getString('city');

    try {
        const response = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${weatherApiKey}&units=imperial`
        );
        const data = await response.json();

        if (parseInt(data.cod) !== 200) {
            console.error('OpenWeatherMap error:', data);
            await interaction.editReply({ content: `❌ Could not find weather for **${city}**. Check the city name and try again.` });
            return;
        }

        const emoji       = getWeatherEmoji(data.weather[0].id);
        const description = data.weather[0].description.charAt(0).toUpperCase() + data.weather[0].description.slice(1);
        const temp        = Math.round(data.main.temp);
        const feelsLike   = Math.round(data.main.feels_like);
        const tempMin     = Math.round(data.main.temp_min);
        const tempMax     = Math.round(data.main.temp_max);
        const humidity    = data.main.humidity;
        const windSpeed   = Math.round(data.wind.speed);
        const windDeg     = data.wind.deg;
        const visibility  = data.visibility ? `${(data.visibility / 1000).toFixed(1)} km` : 'N/A';
        const sunrise     = `<t:${data.sys.sunrise}:t>`;
        const sunset      = `<t:${data.sys.sunset}:t>`;

        const embed = new EmbedBuilder()
            .setTitle(`${emoji} Weather in ${data.name}, ${data.sys.country}`)
            .setColor(0x87CEEB)
            .addFields(
                { name: 'Condition', value: description, inline: true },
                { name: 'Temperature', value: `${temp}°F (feels like ${feelsLike}°F)`, inline: true },
                { name: 'High / Low', value: `${tempMax}°F / ${tempMin}°F`, inline: true },
                { name: 'Humidity', value: `${humidity}%`, inline: true },
                { name: 'Wind', value: `${windSpeed} mph at ${windDeg}°`, inline: true },
                { name: 'Visibility', value: visibility, inline: true },
                { name: 'Sunrise', value: sunrise, inline: true },
                { name: 'Sunset', value: sunset, inline: true },
            )
            .setFooter({ text: 'Powered by OpenWeatherMap' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

    } catch(error) {
        console.error('Weather Error:', error);
        await interaction.editReply({ content: 'Failed to fetch weather data. Try again later.' });
    }
}