const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Stock = require('../../models/Stock');
const Portfolio = require('../../models/Portfolio');
const User = require('../../models/User');

const fmt    = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (n) => Number(n).toLocaleString('en-US');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stock')
        .setDescription('Stock market commands')
        .addSubcommand(sub =>
            sub.setName('buy')
                .setDescription('Buy shares of a stock')
                .addStringOption(o => o.setName('ticker').setDescription('Stock ticker symbol').setRequired(true))
                .addStringOption(o => o.setName('shares').setDescription('Number of shares, or "max"').setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('sell')
                .setDescription('Sell shares of a stock')
                .addStringOption(o => o.setName('ticker').setDescription('Stock ticker symbol').setRequired(true))
                .addStringOption(o => o.setName('shares').setDescription('Number of shares, or "all"').setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('portfolio')
                .setDescription('View your stock portfolio')
        )
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('View all current stock market prices')
        )
        .addSubcommand(sub =>
            sub.setName('history')
                .setDescription('View the price history for a stock')
                .addStringOption(o => o.setName('ticker').setDescription('Stock ticker symbol').setRequired(true))
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'buy') {
            const ticker    = interaction.options.getString('ticker').toUpperCase();
            const sharesStr = interaction.options.getString('shares');

            const stock = await Stock.findOne({ guildId: interaction.guild.id, ticker });
            if (!stock) return interaction.reply({ content: `❌ Ticker \`${ticker}\` not found.`, ephemeral: true });

            const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guild.id });
            if (!user) return interaction.reply({ content: '❌ You have no economy account.', ephemeral: true });

            let shares;
            if (!sharesStr || sharesStr.toLowerCase() === 'max') {
                shares = Math.floor(user.balance / stock.price);
                if (shares <= 0) return interaction.reply({ content: `❌ You can't afford even 1 share of \`${ticker}\` at $${fmt(stock.price)}.`, ephemeral: true });
            } else {
                shares = parseInt(sharesStr);
                if (isNaN(shares) || shares <= 0) return interaction.reply({ content: '❌ Shares must be a whole number.', ephemeral: true });
            }

            const totalCost = parseFloat((stock.price * shares).toFixed(2));
            if (user.balance < totalCost)
                return interaction.reply({ content: `❌ You need **$${fmt(totalCost)}** but only have **$${fmt(user.balance)}**.`, ephemeral: true });

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

            const buyImpact   = 1 + Math.min(shares / Math.max(stock.totalShares + shares, 10000), 0.1) * 0.5;
            stock.price       = Math.min(parseFloat((stock.price * buyImpact).toFixed(2)), 999999);
            stock.totalShares += shares;
            await stock.save();

            return interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle('Stock Purchased')
                .setColor(0x00FF99)
                .addFields(
                    { name: 'Stock',           value: `${stock.name} (\`${ticker}\`)`, inline: true },
                    { name: 'Shares',          value: `${fmtInt(shares)}`,             inline: true },
                    { name: 'Price Per Share', value: `$${fmt(stock.price)}`,          inline: true },
                    { name: 'Total Cost',      value: `$${fmt(totalCost)}`,            inline: true },
                    { name: 'Cash Remaining',  value: `$${fmt(user.balance)}`,         inline: true }
                )
                .setFooter({ text: 'Economic Bomb Stock Market' })
                .setTimestamp()] });
        }

        if (sub === 'sell') {
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
                return interaction.reply({ content: `❌ You only have **${fmtInt(holding.shares)}** shares of \`${ticker}\`.`, ephemeral: true });

            const totalEarned = parseFloat((stock.price * shares).toFixed(2));
            const profit      = parseFloat((totalEarned - holding.avgBuyPrice * shares).toFixed(2));

            holding.shares -= shares;
            if (holding.shares === 0) portfolio.holdings = portfolio.holdings.filter(h => h.ticker !== ticker);
            await portfolio.save();

            const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guild.id });
            user.balance = parseFloat((user.balance + totalEarned).toFixed(2));
            await user.save();

            const sellImpact  = Math.min(shares / Math.max(stock.totalShares, 10000), 0.1) * 0.5;
            stock.price       = Math.max(parseFloat((stock.price * (1 - sellImpact)).toFixed(2)), 0.01);
            stock.totalShares = Math.max(0, stock.totalShares - shares);
            await stock.save();

            return interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle('Stock Sold')
                .setColor(profit >= 0 ? 0x00FF99 : 0xFF4500)
                .addFields(
                    { name: 'Stock',            value: `${stock.name} (\`${ticker}\`)`,            inline: true },
                    { name: 'Shares Sold',      value: `${fmtInt(shares)}`,                        inline: true },
                    { name: 'Price Per Share',  value: `$${fmt(stock.price)}`,                     inline: true },
                    { name: 'Total Earned',     value: `$${fmt(totalEarned)}`,                     inline: true },
                    { name: 'Profit/Loss',      value: `${profit >= 0 ? '+' : ''}$${fmt(profit)}`, inline: true },
                    { name: 'New Cash Balance', value: `$${fmt(user.balance)}`,                    inline: true }
                )
                .setFooter({ text: 'Economic Bomb Stock Market' })
                .setTimestamp()] });
        }

        if (sub === 'portfolio') {
            const portfolio = await Portfolio.findOne({ userId: interaction.user.id, guildId: interaction.guild.id });
            if (!portfolio || !portfolio.holdings.length)
                return interaction.reply({ content: '📭 You have no stocks. Use `/stock buy` to get started.', ephemeral: true });

            let totalValue = 0, totalCost = 0;
            const rows = [];

            for (const h of portfolio.holdings) {
                const stock = await Stock.findOne({ guildId: interaction.guild.id, ticker: h.ticker });
                if (!stock) continue;
                const currentValue = stock.price * h.shares;
                const costBasis    = h.avgBuyPrice * h.shares;
                const profit       = currentValue - costBasis;
                totalValue += currentValue;
                totalCost  += costBasis;
                rows.push(`${profit >= 0 ? '▲' : '▼'} \`${h.ticker}\` x${fmtInt(h.shares)} - $${fmt(currentValue)} (${profit >= 0 ? '+' : ''}$${fmt(profit)})`);
            }

            const totalProfit = totalValue - totalCost;

            return interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle(`${interaction.user.username}'s Portfolio`)
                .setDescription(rows.join('\n'))
                .setColor(totalProfit >= 0 ? 0x00FF99 : 0xFF4500)
                .addFields(
                    { name: 'Total Value',       value: `$${fmt(totalValue)}`,  inline: true },
                    { name: 'Total Profit/Loss', value: `${totalProfit >= 0 ? '+' : ''}$${fmt(totalProfit)}`, inline: true }
                )
                .setFooter({ text: 'Economic Bomb Stock Market' })
                .setTimestamp()] });
        }

        if (sub === 'list') {
            const stocks = await Stock.find({ guildId: interaction.guild.id }).sort({ ticker: 1 });
            if (!stocks.length)
                return interaction.reply({ content: '❌ No stocks set up yet. An admin can run `/setupmarket` to initialize the market.', ephemeral: true });

            const rows = stocks.map(s => {
                const prev   = s.history.length >= 2 ? s.history[s.history.length - 2] : s.price;
                const change = s.price - prev;
                const pct    = ((change / prev) * 100).toFixed(2);
                const arrow  = change > 0 ? '▲' : change < 0 ? '▼' : '-';
                return `${arrow} \`${s.ticker.padEnd(4)}\` **${s.name}** - $${fmt(s.price)} (${change >= 0 ? '+' : ''}${pct}%)`;
            }).join('\n');

            return interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle('Stock Market')
                .setDescription(rows)
                .setColor(0x00FF99)
                .setFooter({ text: 'Prices update every 30 minutes' })
                .setTimestamp()] });
        }

        if (sub === 'history') {
            const ticker = interaction.options.getString('ticker').toUpperCase();
            const stock  = await Stock.findOne({ guildId: interaction.guild.id, ticker });
            if (!stock) return interaction.reply({ content: `❌ Ticker \`${ticker}\` not found.`, ephemeral: true });

            const history = stock.history.slice(-10);
            const chart   = history.map((p, i) => {
                const prev  = history[i - 1] ?? p;
                const arrow = p > prev ? '▲' : p < prev ? '▼' : '-';
                return `${arrow} $${fmt(p)}`;
            }).join('\n');

            const first         = history[0];
            const last          = history[history.length - 1];
            const overallChange = last - first;
            const overallPct    = ((overallChange / first) * 100).toFixed(2);

            return interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle(`${stock.name} (\`${ticker}\`) - Price History`)
                .setDescription(chart || 'No history yet.')
                .setColor(overallChange >= 0 ? 0x00FF99 : 0xFF4500)
                .addFields(
                    { name: 'Current Price',  value: `$${fmt(stock.price)}`,                          inline: true },
                    { name: 'Overall Change', value: `${overallChange >= 0 ? '+' : ''}${overallPct}%`, inline: true }
                )
                .setFooter({ text: 'Last 10 price points' })
                .setTimestamp()] });
        }
    }
};
