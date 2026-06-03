const { EmbedBuilder } = require('discord.js');
const { seedMarket, COMPANIES } = require('../../utils/market');

async function execute(interaction) {
    await seedMarket(interaction.guild.id);
    return interaction.reply({ embeds: [new EmbedBuilder()
        .setTitle('📈 Market Initialized')
        .setDescription(`Successfully seeded **${COMPANIES.length} stocks** for this server.\nUse \`/stock list\` to view the market.`)
        .setColor(0x00FF99)
        .setTimestamp()] });
}

module.exports = { execute };
