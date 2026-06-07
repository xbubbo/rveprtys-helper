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

    const portfolio = await Portfolio.findOne({ userId: interaction.user.id, guildId: interaction.guild.id });
    const holding   = portfolio?.holdings.find(h => h.ticker === ticker);
    if (!holding || holding.shares <= 0)
        return interaction.reply({ content: `❌ You don't hold any shares of \`${ticker}\`.`, ephemeral: true });

    let shares;
    if (!sharesStr || sharesStr.toLowerCase() === 'all') {
        shares = holding.shares;
    } else {
        shares = parseInt(sharesStr);
        if (isNaN(shares) || shares <= 0) return interaction.reply({ content: '❌ Shares must be a whole number.', ephemeral: true });
    }
    if (shares > holding.shares)
        return interaction.reply({ content: `❌ You only have **${formatNumber(holding.shares)}** shares of \`${ticker}\`.`, ephemeral: true });

    const sellImpact   = Math.min(shares / Math.max(stock.totalShares, 5000000), 0.1) * 0.2;
    const sellPrice    = Math.max(parseFloat((stock.price * (1 - sellImpact)).toFixed(2)), 0.01);
    const totalEarned  = parseFloat((sellPrice * shares).toFixed(2));
    const profit       = parseFloat((totalEarned - holding.avgBuyPrice * shares).toFixed(2));

    holding.shares -= shares;
    if (holding.shares === 0) portfolio.holdings = portfolio.holdings.filter(h => h.ticker !== ticker);
    await portfolio.save();

    const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guild.id });
    user.balance = parseFloat((user.balance + totalEarned).toFixed(2));
    await user.save();

    stock.price        = sellPrice;
    stock.totalShares  = Math.max(0, stock.totalShares - shares);
    await stock.save();

    return interaction.reply({
        embeds: [new EmbedBuilder()
            .setTitle('📉 Stock Sold')
            .setColor(profit >= 0 ? 0x00FF99 : 0xFF4500)
            .addFields(
                { name: 'Stock',            value: `${stock.name} (\`${ticker}\`)`,                        inline: true },
                { name: 'Shares Sold',      value: formatNumber(shares),                                   inline: true },
                { name: 'Price Per Share',  value: `$${stockPrice(sellPrice)}`,                        inline: true },
                { name: 'Total Earned',     value: `$${stockPrice(totalEarned)}`,                        inline: true },
                { name: 'Profit/Loss',      value: `${profit >= 0 ? '+' : ''}$${stockPrice(profit)}`,   inline: true },
                { name: 'New Cash Balance', value: `$${formatNumber(user.balance)}`,                       inline: true },
            )
            .setFooter({ text: 'Economic Bomb Stock Market' })
            .setTimestamp()],
    });
}

module.exports = { execute };
