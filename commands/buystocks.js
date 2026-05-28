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
        .setName('buystock')
        .setDescription('Buy shares of a stock')
        .addStringOption(o => o.setName('ticker').setDescription('Stock ticker symbol').setRequired(true))
        .addIntegerOption(o => o.setName('shares').setDescription('Number of shares to buy').setRequired(true)),

    async execute(interaction) {
        const ticker = interaction.options.getString('ticker').toUpperCase();
        const shares = interaction.options.getInteger('shares');

        if (shares <= 0) return interaction.reply({ content: '❌ Shares must be greater than 0.', ephemeral: true });

        const stock = await Stock.findOne({ ticker });
        if (!stock) return interaction.reply({ content: `❌ Ticker \`${ticker}\` not found.`, ephemeral: true });

        const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guild.id });
        if (!user) return interaction.reply({ content: '❌ You have no economy account.', ephemeral: true });

        const totalCost = parseFloat((stock.price * shares).toFixed(2));
        if (user.balance < totalCost) {
            return interaction.reply({ content: `❌ You need $${totalCost.toFixed(2)} but only have $${user.balance.toFixed(2)}.`, ephemeral: true });
        }

        user.balance = parseFloat((user.balance - totalCost).toFixed(2));
        await user.save();

        let portfolio = await Portfolio.findOne({ userId: interaction.user.id, guildId: interaction.guild.id });
        if (!portfolio) portfolio = new Portfolio({ userId: interaction.user.id, guildId: interaction.guild.id, holdings: [] });

        const existing = portfolio.holdings.find(h => h.ticker === ticker);
        if (existing) {
            const totalShares = existing.shares + shares;
            existing.avgBuyPrice = parseFloat(((existing.avgBuyPrice * existing.shares + stock.price * shares) / totalShares).toFixed(2));
            existing.shares = totalShares;
        } else {
            portfolio.holdings.push({ ticker, shares, avgBuyPrice: stock.price });
        }
        await portfolio.save();

        const newPrice = applyPriceImpact(stock.price, shares, 1);
        stock.history.push(newPrice);
        if (stock.history.length > 30) stock.history.shift();
        stock.price = newPrice;
        stock.totalShares += shares;
        await stock.save();

        const embed = new EmbedBuilder()
            .setTitle('✅ Stock Purchased')
            .setColor(0x00FF99)
            .addFields(
                { name: 'Stock', value: `${stock.name} (\`${ticker}\`)`, inline: true },
                { name: 'Shares', value: `${shares}`, inline: true },
                { name: 'Price Per Share', value: `$${(totalCost / shares).toFixed(2)}`, inline: true },
                { name: 'Total Cost', value: `$${totalCost.toFixed(2)}`, inline: true },
                { name: 'New Price', value: `$${newPrice.toFixed(2)}`, inline: true },
                { name: 'Cash Remaining', value: `$${user.balance.toFixed(2)}`, inline: true }
            )
            .setFooter({ text: 'NRG Stock Market' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};
