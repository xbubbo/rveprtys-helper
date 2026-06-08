const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser } = require('../utils/economy');
const { formatNumber } = require('../utils/format');
const Portfolio = require('../models/portfolio');
const Stock = require('../models/stock');
const DividendClaim = require('../models/dividendClaim');

const DIVIDEND_COOLDOWN = 24 * 60 * 60 * 1000;
const DIVIDEND_RATE = 0.02;
const MIN_SHARES = 5;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dividends')
        .setDescription('Collect passive dividend payouts from your stock holdings')
        .addSubcommand(sub =>
            sub.setName('collect')
                .setDescription('Collect your pending dividend payouts')
        )
        .addSubcommand(sub =>
            sub.setName('preview')
                .setDescription('See how much you would earn if you collected right now')
        )
        .addSubcommand(sub =>
            sub.setName('rates')
                .setDescription('View the current dividend rate and which stocks pay out')
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const userId = interaction.user.id;

        if (sub === 'rates') {
            const stocks = await Stock.find({}).sort({ price: -1 });
            if (!stocks.length)
                return interaction.reply({ content: 'No stocks are listed yet.', ephemeral: true });

            const lines = stocks.map(s => {
                const dailyPer = parseFloat((s.price * DIVIDEND_RATE).toFixed(2));
                return `**${s.ticker}** - $${formatNumber(s.price)} - $${formatNumber(dailyPer)} per share/day`;
            });

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('Dividend Rates')
                    .setDescription(lines.join('\n'))
                    .addFields(
                        { name: 'Rate', value: `${(DIVIDEND_RATE * 100).toFixed(1)}% of share price per day`, inline: true },
                        { name: 'Minimum Holding', value: `${MIN_SHARES} shares per stock`, inline: true },
                        { name: 'Cooldown', value: '24 hours', inline: true }
                    )
                    .setColor(0x2b2d31)
                    .setFooter({ text: 'Hold more shares. Collect daily. Compound your position.' })]
            });
        }

        const portfolio = await Portfolio.findOne({ userId });
        if (!portfolio || !portfolio.holdings?.length)
            return interaction.reply({ content: 'You have no stock holdings. Buy shares to earn dividends.', ephemeral: true });

        const eligibleHoldings = portfolio.holdings.filter(h => h.shares >= MIN_SHARES);
        if (!eligibleHoldings.length)
            return interaction.reply({ content: `You need at least **${MIN_SHARES} shares** of any stock to earn dividends.`, ephemeral: true });

        const stocks = await Stock.find({});
        const stockMap = new Map(stocks.map(s => [s.ticker, s]));

        let totalPayout = 0;
        const breakdown = [];

        for (const holding of eligibleHoldings) {
            const stock = stockMap.get(holding.ticker);
            if (!stock) continue;
            const payout = parseFloat((stock.price * DIVIDEND_RATE * holding.shares).toFixed(2));
            totalPayout += payout;
            breakdown.push({ ticker: holding.ticker, shares: holding.shares, payout });
        }

        totalPayout = parseFloat(totalPayout.toFixed(2));

        if (sub === 'preview') {
            const claim = await DividendClaim.findOne({ userId });
            const now = Date.now();
            let readyIn = null;

            if (claim && now - claim.lastClaim < DIVIDEND_COOLDOWN) {
                const left = DIVIDEND_COOLDOWN - (now - claim.lastClaim);
                const h = Math.floor(left / 3600000);
                const m = Math.floor((left % 3600000) / 60000);
                readyIn = `${h}h ${m}m`;
            }

            const lines = breakdown.map(b => `**${b.ticker}** - ${b.shares} shares - $${formatNumber(b.payout)}`);

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('Dividend Preview')
                    .setDescription(lines.join('\n'))
                    .addFields(
                        { name: 'Total Payout', value: `$${formatNumber(totalPayout)}`, inline: true },
                        { name: 'Status', value: readyIn ? `Available in ${readyIn}` : 'Ready to collect', inline: true }
                    )
                    .setColor(0x2b2d31)]
            });
        }

        if (sub === 'collect') {
            const now = Date.now();
            let claim = await DividendClaim.findOne({ userId });

            if (claim && now - claim.lastClaim < DIVIDEND_COOLDOWN) {
                const left = DIVIDEND_COOLDOWN - (now - claim.lastClaim);
                const h = Math.floor(left / 3600000);
                const m = Math.floor((left % 3600000) / 60000);
                const s = Math.ceil((left % 60000) / 1000);
                return interaction.reply({ content: `Dividends already collected. Next payout in **${h}h ${m}m ${s}s**.`, ephemeral: true });
            }

            const user = await getUser(userId);
            user.balance = parseFloat((user.balance + totalPayout).toFixed(2));
            await user.save();

            if (!claim) {
                claim = new DividendClaim({ userId });
            }
            claim.lastClaim = now;
            await claim.save();

            const lines = breakdown.map(b => `**${b.ticker}** - ${b.shares} shares - $${formatNumber(b.payout)}`);

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('Dividends Collected')
                    .setDescription(lines.join('\n'))
                    .addFields(
                        { name: 'Total Collected', value: `$${formatNumber(totalPayout)}`, inline: true },
                        { name: 'New Balance', value: `$${formatNumber(user.balance)}`, inline: true }
                    )
                    .setColor(0x00cc44)
                    .setFooter({ text: 'Come back in 24 hours for your next payout.' })]
            });
        }
    }
};