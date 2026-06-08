const { EmbedBuilder } = require('discord.js');
const Stock     = require('../../models/stock');
const Portfolio = require('../../models/portfolio');
const { formatNumber, stockPrice } = require('../../utils/format');

async function execute(interaction) {
    const portfolio = await Portfolio.findOne({ userId: interaction.user.id });
    if (!portfolio?.holdings.length)
        return interaction.reply({ content: '📭 You have no stocks. Use `/stock buy` to get started.', ephemeral: true });

    let totalValue = 0, totalCost = 0;
    const rows = [];

    for (const h of portfolio.holdings) {
        const stock = await Stock.findOne({ ticker: h.ticker });
        if (!stock) continue;
        const currentValue = stock.price * h.shares;
        const costBasis    = h.avgBuyPrice * h.shares;
        const profit       = currentValue - costBasis;
        totalValue += currentValue;
        totalCost  += costBasis;
        rows.push(`${profit >= 0 ? '▲' : '▼'} \`${h.ticker}\` x${formatNumber(h.shares)} - $${stockPrice(currentValue)} (${profit >= 0 ? '+' : ''}$${stockPrice(profit)})`);
    }

    const totalProfit = totalValue - totalCost;

    return interaction.reply({
        embeds: [new EmbedBuilder()
            .setTitle(`📊 ${interaction.user.username}'s Portfolio`)
            .setDescription(rows.join('\n'))
            .setColor(totalProfit >= 0 ? 0x00FF99 : 0xFF4500)
            .addFields(
                { name: 'Total Value',      value: `$${stockPrice(totalValue)}`,                              inline: true },
                { name: 'Total Profit/Loss', value: `${totalProfit >= 0 ? '+' : ''}$${stockPrice(totalProfit)}`, inline: true },
            )
            .setFooter({ text: 'Economic Bomb Stock Market' })
            .setTimestamp()],
    });
}

module.exports = { execute };
