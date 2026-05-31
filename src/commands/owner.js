const {
    SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle
} = require('discord.js');
const { getUser } = require('../../utils/economy');
const { seedMarket, COMPANIES } = require('../../utils/market');
const cooldowns = require('../../utils/cooldowns');
const User = require('../../models/User');
const Stock = require('../../models/Stock');
const Portfolio = require('../../models/Portfolio');

const OWNER_ID = '1453078748080504996';
const isAdmin  = i => i.user.id === OWNER_ID || !!i.member?.permissions?.has('Administrator');
const fmt = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const bountyMap = new Map();

function formatTimeLeft(ms) {
    if (ms <= 0) return '00d 00h 00m 00s';
    const total   = Math.floor(ms / 1000);
    const days    = Math.floor(total / 86400);
    const hours   = String(Math.floor((total % 86400) / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
    const seconds = String(total % 60).padStart(2, '0');
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

async function buildSeasonEmbed(guild, endTime) {
    const msLeft        = endTime - new Date();
    const unixTimestamp = Math.floor(endTime.getTime() / 1000);

    const cashWinners = await User.find({ guildId: guild.id }).sort({ balance: -1 }).limit(5);
    const bankWinners = await User.find({ guildId: guild.id }).sort({ bank: -1 }).limit(5);

    const cashDesc = cashWinners.length
        ? cashWinners.map((u, i) => `**${i + 1}.** <@${u.userId}> - $${u.balance}`).join('\n')
        : 'No data.';
    const bankDesc = bankWinners.length
        ? bankWinners.map((u, i) => `**${i + 1}.** <@${u.userId}> - $${u.bank}`).join('\n')
        : 'No data.';

    return new EmbedBuilder()
        .setTitle('Season 2 - Live Standings')
        .setDescription(
            `Season 2 ends <t:${unixTimestamp}:F> (<t:${unixTimestamp}:R>)\n\n` +
            `Time Remaining: \`${formatTimeLeft(msLeft)}\`\n` +
            `Leaderboard updates every 24 hours. Good luck!`
        )
        .setColor(0x00FF99)
        .addFields(
            { name: 'Cash Leaders', value: cashDesc, inline: true },
            { name: 'Bank Leaders', value: bankDesc, inline: true }
        )
        .setFooter({ text: 'NRG Economy - Season 2 - Last updated' })
        .setTimestamp();
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('owner')
        .setDescription('Owner/admin commands')
        .addSubcommand(sub =>
            sub.setName('give')
                .setDescription('Give money to a user')
                .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
                .addNumberOption(o => o.setName('amount').setDescription('Amount').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('setbalance')
                .setDescription("Set a user's wallet balance")
                .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
                .addNumberOption(o => o.setName('amount').setDescription('New balance').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('setbank')
                .setDescription("Set a user's bank balance")
                .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
                .addNumberOption(o => o.setName('amount').setDescription('New bank balance').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('stats')
                .setDescription('View economy stats for this server')
        )
        .addSubcommand(sub =>
            sub.setName('userinfo')
                .setDescription("View a user's economy data")
                .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('jackpot')
                .setDescription('Drop money to a random user')
                .addNumberOption(o => o.setName('amount').setDescription('Amount to drop').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('reseteconomy')
                .setDescription('Reset all balances in this server')
        )
        .addSubcommand(sub =>
            sub.setName('clearcooldowns')
                .setDescription('Clear all active cooldowns')
        )
        .addSubcommand(sub =>
            sub.setName('stockfix')
                .setDescription('Manually trigger a stock market price tick')
        )
        .addSubcommand(sub =>
            sub.setName('removestock')
                .setDescription("Remove a stock from a user's portfolio")
                .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
                .addStringOption(o => o.setName('ticker').setDescription('Stock ticker').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('setupmarket')
                .setDescription('Initialize or reset the stock market')
        )
        .addSubcommand(sub =>
            sub.setName('bounty')
                .setDescription('Set a bounty on a user')
                .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
                .addNumberOption(o => o.setName('amount').setDescription('Bounty amount').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('dm')
                .setDescription('Send a DM to a user by ID')
                .addStringOption(o => o.setName('userid').setDescription('User ID').setRequired(true))
                .addStringOption(o => o.setName('message').setDescription('Message to send').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('panel')
                .setDescription('Send the order panel')
        )
        .addSubcommand(sub =>
            sub.setName('season2')
                .setDescription('Start the Season 2 countdown timer')
        ),

    bountyMap,

    async execute(interaction) {
        if (!isAdmin(interaction)) return interaction.reply({ content: '❌ Owner/admin only.', ephemeral: true });

        const sub = interaction.options.getSubcommand();

        if (sub === 'give') {
            const target = interaction.options.getUser('user');
            const amount = interaction.options.getNumber('amount');
            const user   = await getUser(target.id, interaction.guild.id);
            user.balance = parseFloat((user.balance + amount).toFixed(2));
            await user.save();
            return interaction.reply({ content: `✅ Gave **$${fmt(amount)}** to <@${target.id}>`, ephemeral: true });
        }

        if (sub === 'setbalance') {
            const target = interaction.options.getUser('user');
            const amount = interaction.options.getNumber('amount');
            const user   = await getUser(target.id, interaction.guild.id);
            user.balance = amount;
            await user.save();
            return interaction.reply({ content: `✅ Set <@${target.id}>'s wallet to **$${fmt(amount)}**`, ephemeral: true });
        }

        if (sub === 'setbank') {
            const target = interaction.options.getUser('user');
            const amount = interaction.options.getNumber('amount');
            const user   = await getUser(target.id, interaction.guild.id);
            user.bank = amount;
            await user.save();
            return interaction.reply({ content: `✅ Set <@${target.id}>'s bank to **$${fmt(amount)}**`, ephemeral: true });
        }

        if (sub === 'stats') {
            const users      = await User.find({ guildId: interaction.guild.id });
            const totalMoney = users.reduce((a, b) => a + b.balance + b.bank, 0);
            const richest    = [...users].sort((a, b) => (b.balance + b.bank) - (a.balance + a.bank))[0];
            return interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle('Economy Stats')
                .addFields(
                    { name: 'Total Players', value: `${users.length}`, inline: true },
                    { name: 'Total Money',   value: `$${fmt(totalMoney)}`, inline: true },
                    { name: 'Richest',       value: richest ? `<@${richest.userId}> ($${fmt(richest.balance + richest.bank)})` : 'None', inline: true }
                )
                .setColor(0x2b2d31)] });
        }

        if (sub === 'userinfo') {
            const target = interaction.options.getUser('user');
            const user   = await getUser(target.id, interaction.guild.id);
            return interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle('User Info')
                .addFields(
                    { name: 'Wallet', value: `$${fmt(user.balance)}`, inline: true },
                    { name: 'Bank',   value: `$${fmt(user.bank)}`,    inline: true }
                )
                .setColor(0x2b2d31)] });
        }

        if (sub === 'jackpot') {
            const amount = interaction.options.getNumber('amount');
            const users  = await User.find({ guildId: interaction.guild.id });
            if (!users.length) return interaction.reply({ content: 'No users found.', ephemeral: true });
            const winner = users[Math.floor(Math.random() * users.length)];
            winner.balance = parseFloat((winner.balance + amount).toFixed(2));
            await winner.save();
            return interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle('Jackpot Drop')
                .setDescription(`<@${winner.userId}> won **$${fmt(amount)}**!`)
                .setColor(0x00ff00)] });
        }

        if (sub === 'reseteconomy') {
            await User.updateMany({ guildId: interaction.guild.id }, { balance: 0, bank: 0 });
            return interaction.reply({ content: '✅ Economy reset for this server.', ephemeral: true });
        }

        if (sub === 'clearcooldowns') {
            Object.values(cooldowns).forEach(m => m.clear());
            return interaction.reply({ content: '✅ All cooldowns cleared.', ephemeral: true });
        }

        if (sub === 'stockfix') {
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
                results.push(`${diff >= 0 ? '▲' : '▼'} \`${stock.ticker}\` $${fmt(oldPrice)} - $${fmt(newPrice)} (${diff >= 0 ? '+' : ''}${pct}%)`);
            }
            return interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle('Stock Market Manually Ticked')
                .setDescription(results.join('\n'))
                .setColor(0x00FF99)
                .setTimestamp()] });
        }

        if (sub === 'removestock') {
            const target = interaction.options.getUser('user');
            const ticker = interaction.options.getString('ticker').toUpperCase();
            const portfolio = await Portfolio.findOne({ userId: target.id, guildId: interaction.guild.id });
            if (!portfolio) return interaction.reply({ content: '❌ User has no portfolio.', ephemeral: true });
            const before = portfolio.holdings.length;
            portfolio.holdings = portfolio.holdings.filter(h => h.ticker !== ticker);
            if (portfolio.holdings.length === before)
                return interaction.reply({ content: `❌ <@${target.id}> doesn't hold \`${ticker}\`.`, ephemeral: true });
            await portfolio.save();
            return interaction.reply({ content: `✅ Removed all \`${ticker}\` shares from <@${target.id}>'s portfolio.`, ephemeral: true });
        }

        if (sub === 'setupmarket') {
            await seedMarket(interaction.guild.id);
            return interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle('Market Initialized')
                .setDescription(`Successfully seeded **${COMPANIES.length} stocks** for this server.\nUse \`/stock list\` to view the market.`)
                .setColor(0x00FF99)
                .setTimestamp()] });
        }

        if (sub === 'bounty') {
            const target = interaction.options.getUser('user');
            const amount = interaction.options.getNumber('amount');
            bountyMap.set(target.id, amount);
            return interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle('Bounty Set')
                .setDescription(`${target.username} now has a bounty of $${fmt(amount)}`)
                .setColor(0xFF4500)] });
        }

        if (sub === 'dm') {
            const userId  = interaction.options.getString('userid');
            const message = interaction.options.getString('message');
            try {
                const user = await interaction.client.users.fetch(userId);
                await user.send(message);
                return interaction.reply({ content: `✅ Message sent to ${user.tag}`, ephemeral: true });
            } catch {
                return interaction.reply({ content: '❌ Failed to send DM. User may have DMs disabled.', ephemeral: true });
            }
        }

        if (sub === 'panel') {
            const embed = new EmbedBuilder()
                .setTitle('Make an Order')
                .setDescription('To order a link, fill out the form by clicking the button and the bot will DM you the links when done.')
                .setColor(0x2b2d31);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('open_order_modal').setLabel('Order Now').setStyle(ButtonStyle.Primary)
            );
            return interaction.reply({ embeds: [embed], components: [row] });
        }

        if (sub === 'season2') {
            const endTime = new Date();
            endTime.setMonth(endTime.getMonth() + 1);

            const embed = await buildSeasonEmbed(interaction.guild, endTime);
            await interaction.reply({ embeds: [embed] });

            const interval = setInterval(async () => {
                const msLeft = endTime - new Date();
                if (msLeft <= 0) {
                    clearInterval(interval);
                    const finalCash = await User.find({ guildId: interaction.guild.id }).sort({ balance: -1 }).limit(5);
                    const finalBank = await User.find({ guildId: interaction.guild.id }).sort({ bank: -1 }).limit(5);
                    const cashDesc = finalCash.length ? finalCash.map((u, i) => `**${i + 1}.** <@${u.userId}> - $${u.balance}`).join('\n') : 'No data.';
                    const bankDesc = finalBank.length ? finalBank.map((u, i) => `**${i + 1}.** <@${u.userId}> - $${u.bank}`).join('\n') : 'No data.';
                    const endEmbed = new EmbedBuilder()
                        .setTitle('Season 2 Has Ended!')
                        .setDescription('The Season 2 economy has concluded. Here are the final standings!')
                        .setColor(0xFFD700)
                        .addFields(
                            { name: 'Final Cash Winners', value: cashDesc, inline: true },
                            { name: 'Final Bank Winners', value: bankDesc, inline: true }
                        )
                        .setTimestamp();
                    await interaction.editReply({ embeds: [endEmbed] });
                    return;
                }
                const updatedEmbed = await buildSeasonEmbed(interaction.guild, endTime);
                await interaction.editReply({ embeds: [updatedEmbed] });
            }, 86400000);
        }
    }
};
