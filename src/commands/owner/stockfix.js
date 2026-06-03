const { EmbedBuilder } = require('discord.js');
const Stock = require('../../models/stock');
const { formatNumber } = require('../../utils/format');

async function execute(interaction) {
    const stocks = await Stock.find({ guildId: interaction.guild.id });
    if (!stocks.length) return interaction.reply({ content: '❌ No stocks found. Run `/owner setupmarket` first.', ephemeral: true });

    const results = [];
    for (const stock of stocks) {
        const oldPrice = stock.price;
        const change   = 1 + (Math.random() * 0.06 - 0.03);
        const newPrice = Math.max(0.01, parseFloat((stock.price * change).toFixed(2)));
        stock.history.push(newPrice);
        if (stock.history.length > 30) stock.history.shift();
        stock.price = newPrice;
        await stock.save();
        const diff = newPrice - oldPrice;
        const pct  = ((diff / oldPrice) * 100).toFixed(2);
        results.push(`${diff >= 0 ? '▲' : '▼'} \`${stock.ticker}\` $${formatNumber(oldPrice)} - $${formatNumber(newPrice)} (${diff >= 0 ? '+' : ''}${pct}%)`);
    }

    return interaction.reply({ embeds: [new EmbedBuilder()
        .setTitle('📈 Stock Market Ticked')
        .setDescription(results.join('\n'))
        .setColor(0x00FF99)
        .setTimestamp()] });
}

module.exports = { execute };
