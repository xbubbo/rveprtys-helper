const { EmbedBuilder } = require('discord.js');
const Stock     = require('../../models/stock');
const Portfolio = require('../../models/portfolio');
const User      = require('../../models/user');
const { formatNumber, stockPrice } = require('../../utils/format');

async function execute(interaction) {
    const ticker    = interaction.options.getString('ticker').toUpperCase();
    const sharesStr = interaction.options.getString('shares');

    const stock = await Stock.findOne({ guildId: interaction.guild.id, ticker });
    if (!stock) return interaction.reply({ content: `❌ Ticker \`${ticker}\` not found.`, ephemeral: true });

    const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guild.id });
    if (!user) return interaction.reply({ content: '❌ You have no economy account.', ephemeral: true });

    let shares;
    if (!sharesStr || sharesStr.toLowerCase() === 'max') {
        shares = Math.floor(user.balance / stock.price);
        if (shares <= 0) return interaction.reply({ content: `❌ You can't afford even 1 share of \`${ticker}\` at $${stockPrice(stock.price)}.`, ephemeral: true });
    } else {
        shares = parseInt(sharesStr);
        if (isNaN(shares) || shares <= 0) return interaction.reply({ content: '❌ Shares must be a whole number.', ephemeral: true });
    }

    const totalCost = parseFloat((stock.price * shares).toFixed(2));
    if (user.balance < totalCost)
        return interaction.reply({ content: `❌ You need **$${stockPrice(totalCost)}** but only have **$${formatNumber(user.balance)}**.`, ephemeral: true });

    user.balance = parseFloat((user.balance - totalCost).toFixed(2));
    await user.save();

    let portfolio = await Portfolio.findOne({ userId: interaction.user.id, guildId: interaction.guild.id });
    if (!portfolio) portfolio = new Portfolio({ userId: interaction.user.id, guildId: interaction.guild.id, holdings: [] });

    const existing = portfolio.holdings.find(h => h.ticker === ticker);
    if (existing) {
        const totalShares    = existing.shares + shares;
        existing.avgBuyPrice = parseFloat(((existing.avgBuyPrice * existing.shares + stock.price * shares) / totalShares).toFixed(2));
        existing.shares      = totalShares;
    } else {
        portfolio.holdings.push({ ticker, shares, avgBuyPrice: stock.price });
    }
    await portfolio.save();

    const buyImpact  = 1 + Math.min(shares / Math.max(stock.totalShares + shares, 5000000), 0.1) * 0.1;
    stock.price      = Math.min(parseFloat((stock.price * buyImpact).toFixed(2)), 999999);
    stock.totalShares += shares;
    await stock.save();

    return interaction.reply({
        embeds: [new EmbedBuilder()
            .setTitle('📈 Stock Purchased')
            .setColor(0x00FF99)
            .addFields(
                { name: 'Stock',           value: `${stock.name} (\`${ticker}\`)`, inline: true },
                { name: 'Shares',          value: formatNumber(shares),             inline: true },
                { name: 'Price Per Share', value: `$${stockPrice(stock.price)}`,  inline: true },
                { name: 'Total Cost',      value: `$${stockPrice(totalCost)}`,    inline: true },
                { name: 'Cash Remaining',  value: `$${formatNumber(user.balance)}`, inline: true },
            )
            .setFooter({ text: 'Economic Bomb Stock Market' })
            .setTimestamp()],
    });
}

module.exports = { execute };
