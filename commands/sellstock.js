const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Stock = require('../models/Stock');
const Portfolio = require('../models/Portfolio');
const User = require('../models/User');

function applyPriceImpact(price, shares, direction) {
    const impact = 1 + (direction * 0.002 * shares);
    const noise = 1 + (Math.random() * 0.02 - 0.01);
    return Math.max(0.01, parseFloat((price * impact * noise).toFixed(2)));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sellstock')
        .setDescription('Sell shares of a stock')
        .addStringOption(o => o.setName('ticker').setDescription('Stock ticker symbol').setRequired(true))
        .addIntegerOption(o => o.setName('shares').setDescription('Number of shares to sell').setRequired(true)),

    async execute(interaction) {
        const ticker = interaction.options.getString('ticker').toUpperCase();
        const shares = interaction.options.getInteger('shares');

        if (shares <= 0) return interaction.reply({ content: '❌ Shares must be greater than 0.', ephemeral: true });

        const stock = await Stock.findOne({ ticker });
        if (!stock) return interaction.reply({ content: `❌ Ticker \`${ticker}\` not found.`, ephemeral: true });

        const portfolio = await Portfolio.findOne({ userId: interaction.user.id, guildId: interaction.guild.id });
        const holding = portfolio?.holdings.find(h => h.ticker === ticker);

        if (!holding || holding.shares < shares) {
            return interaction.reply({ content: `❌ You don't have enough shares of \`${ticker}\`.`, ephemeral: true });
        }

        const totalEarned = parseFloat((stock.price * shares).toFixed(2));
        const profit = parseFloat((totalEarned - holding.avgBuyPrice * shares).toFixed(2));

        holding.shares -= shares;
        if (holding.shares === 0) {
            portfolio.holdings = portfolio.holdings.filter(h => h.ticker !== ticker);
        }
        await portfolio.save();

        const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guild.id });
        user.balance = parseFloat((user.balance + totalEarned).toFixed(2));
        await user.save();

        const newPrice = applyPriceImpact(stock.price, shares, -1);
        stock.history.push(newPrice);
        if (stock.history.length > 30) stock.history.shift();
        stock.price = newPrice;
        stock.totalShares = Math.max(0, stock.totalShares - shares);
        await stock.save();

        const embed = new EmbedBuilder()
            .setTitle('💸 Stock Sold')
            .setColor(profit >= 0 ? 0x00FF99 : 0xFF4500)
            .addFields(
                { name: 'Stock', value: `${stock.name} (\`${ticker}\`)`, inline: true },
                { name: 'Shares Sold', value: `${shares}`, inline: true },
                { name: 'Price Per Share', value: `$${stock.price.toFixed(2)}`, inline: true },
                { name: 'Total Earned', value: `$${totalEarned.toFixed(2)}`, inline: true },
                { name: 'Profit/Loss', value: `${profit >= 0 ? '+' : ''}$${profit.toFixed(2)}`, inline: true },
                { name: 'New Cash Balance', value: `$${user.balance.toFixed(2)}`, inline: true }
            )
            .setFooter({ text: 'NRG Stock Market' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};
