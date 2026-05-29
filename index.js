require('dotenv').config();

const {
    Client,
    Collection,
    GatewayIntentBits,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

const fs = require('fs');
const fetch = require('node-fetch');
const mongoose = require('mongoose');
const Stock = require('./models/Stock');
const Portfolio = require('./models/Portfolio');
const User = require('./models/User');
const Slave = require('./models/Slave');
const { getUser } = require('./utils/economy');

const jackpotLeaderboard = new Map();
const PREFIX = '?';
const OWNER_ID = '1453078748080504996';

const workCooldowns = new Map();
const coinflipCooldowns = new Map();
const diceCooldowns = new Map();
const slotsCooldowns = new Map();
const robCooldowns = new Map();

const symbols = ['🍒', '🍋', '🍉', '⭐', '💎', '🍀'];

function applyPriceImpact(price, shares, direction) {
    const impact = 1 + (direction * 0.002 * shares);
    const noise = 1 + (Math.random() * 0.02 - 0.01);
    return Math.max(0.01, parseFloat((price * impact * noise).toFixed(2)));
}

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB connected'))
    .catch(err => { console.error(err); process.exit(1); });

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.commands = new Collection();

const commandFiles = fs.readdirSync('./commands').filter(f => f.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
}

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);

    setInterval(async () => {
        const stocks = await Stock.find();
        for (const stock of stocks) {
            const change = 1 + (Math.random() * 0.06 - 0.03);
            const newPrice = Math.max(0.01, parseFloat((stock.price * change).toFixed(2)));
            stock.history.push(newPrice);
            if (stock.history.length > 30) stock.history.shift();
            stock.price = newPrice;
            await stock.save();
        }
        console.log('Stock prices updated.');
    }, 30 * 60 * 1000);
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const cmd = args.shift().toLowerCase();
    const now = Date.now();

    // ?balance / ?bal
    if (cmd === 'balance' || cmd === 'bal') {
        const user = await getUser(message.author.id, message.guild.id);
        return message.reply({
            embeds: [new EmbedBuilder()
                .setTitle(`💰 ${message.author.username}'s Balance`)
                .addFields(
                    { name: '💵 Wallet', value: `$${user.balance}`, inline: true },
                    { name: '🏦 Bank', value: `$${user.bank}`, inline: true }
                )
                .setColor(0x2b2d31)]
        });
    }

    // ?work
    if (cmd === 'work') {
        const COOLDOWN = 2 * 60 * 1000;
        const user = await getUser(message.author.id, message.guild.id);

        if (user.lastWork && now - user.lastWork < COOLDOWN) {
            const timeLeft = ((COOLDOWN - (now - user.lastWork)) / 1000).toFixed(1);
            return message.reply(`⏳ You need to wait **${timeLeft}s** before working again.`);
        }

        const amount = Math.floor(Math.random() * 76) + 25;
        user.lastWork = now;

        const slave = await Slave.findOne({ userId: message.author.id, guildId: message.guild.id });

        if (slave?.ownerId) {
            slave.debt = parseFloat((slave.debt - amount).toFixed(2));
            slave.totalEarned = parseFloat((slave.totalEarned + amount).toFixed(2));

            const owner = await getUser(slave.ownerId, message.guild.id);
            owner.balance = parseFloat((owner.balance + amount).toFixed(2));
            await owner.save();

            if (slave.debt <= 0) {
                const freedOwnerId = slave.ownerId;
                slave.ownerId = null;
                slave.debt = 0;
                await slave.save();
                await user.save();

                try {
                    const ownerUser = await client.users.fetch(freedOwnerId);
                    await ownerUser.send({
                        embeds: [new EmbedBuilder()
                            .setTitle('💸 Slave Debt Paid Off')
                            .setDescription(`<@${message.author.id}> has paid off their debt and is now free.`)
                            .setColor(0x00FF99)]
                    });
                } catch {}

                return message.reply({
                    embeds: [new EmbedBuilder()
                        .setTitle('🕊️ You Are Free!')
                        .setDescription(`You worked and earned **$${amount}** — your debt is fully paid off! You are now free.`)
                        .setColor(0x00FF99)]
                });
            }

            await slave.save();
            await user.save();

            try {
                const ownerUser = await client.users.fetch(slave.ownerId);
                await ownerUser.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('💰 Your Slave Worked!')
                        .setDescription(`<@${message.author.id}> worked and earned **$${amount}** for you.\n💸 Their remaining debt: **$${slave.debt.toFixed(2)}**`)
                        .setColor(0x2b2d31)]
                });
            } catch {}

            return message.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('💼 Work Complete')
                    .setDescription(
                        `You earned **$${amount}** — but it went to your owner <@${slave.ownerId}>.\n\n` +
                        `💸 **Debt Remaining:** $${slave.debt.toFixed(2)}`
                    )
                    .setColor(0xFF4500)
                    .setFooter({ text: 'Keep working to pay off your debt!' })]
            });
        }

        user.balance += amount;
        await user.save();
        return message.reply({
            embeds: [new EmbedBuilder()
                .setTitle('💼 Work Complete')
                .setDescription(`You earned **$${amount}**`)
                .setColor(0x00ff00)]
        });
    }

    // ?deposit / ?dep <amount|all>
    if (cmd === 'deposit' || cmd === 'dep') {
        const user = await getUser(message.author.id, message.guild.id);
        const amount = args[0] === 'all' ? user.balance : parseInt(args[0]);
        if (!amount || amount <= 0) return message.reply('❌ Usage: `?deposit <amount|all>`');
        if (user.balance < amount) return message.reply("❌ You don't have enough money in your wallet.");
        user.balance -= amount;
        user.bank += amount;
        await user.save();
        return message.reply({
            embeds: [new EmbedBuilder()
                .setTitle('🏦 Deposit Successful')
                .setDescription(`Deposited **$${amount}** into your bank.`)
                .setColor(0x00ff00)]
        });
    }

    // ?withdraw / ?with <amount|all>
    if (cmd === 'withdraw' || cmd === 'with') {
        const user = await getUser(message.author.id, message.guild.id);
        const amount = args[0] === 'all' ? user.bank : parseInt(args[0]);
        if (!amount || amount <= 0) return message.reply('❌ Usage: `?withdraw <amount|all>`');
        if (user.bank < amount) return message.reply("❌ You don't have enough money in your bank.");
        user.bank -= amount;
        user.balance += amount;
        await user.save();
        return message.reply({
            embeds: [new EmbedBuilder()
                .setTitle('🏦 Withdrawal Successful')
                .setDescription(`Withdrew **$${amount}** from your bank.`)
                .setColor(0x00ff00)]
        });
    }

    // ?givemoney / ?give <@user> <amount>
    if (cmd === 'givemoney' || cmd === 'give') {
        const targetId = message.mentions.users.first()?.id;
        const amount = parseInt(args[1]);
        if (!targetId || !amount || amount <= 0) return message.reply('❌ Usage: `?give @user <amount>`');
        const user = await getUser(message.author.id, message.guild.id);
        const receiver = await getUser(targetId, message.guild.id);
        if (user.balance < amount) return message.reply('❌ Not enough money.');
        user.balance -= amount;
        receiver.balance += amount;
        await user.save();
        await receiver.save();
        return message.reply({
            embeds: [new EmbedBuilder()
                .setTitle('🤝 Transfer Complete')
                .setDescription(`You gave **$${amount}** to <@${targetId}>`)
                .setColor(0x00ff00)]
        });
    }

    // ?coinflip / ?cf <bet> <heads|tails>
    if (cmd === 'coinflip' || cmd === 'cf') {
        const COOLDOWN = 5 * 60 * 1000;
        const bet = parseInt(args[0]);
        const choice = args[1]?.toLowerCase();
        if (!bet || bet <= 0 || !['heads', 'tails'].includes(choice)) return message.reply('❌ Usage: `?coinflip <bet> <heads|tails>`');
        if (coinflipCooldowns.has(message.author.id)) {
            const exp = coinflipCooldowns.get(message.author.id) + COOLDOWN;
            if (now < exp) return message.reply('⏳ Coinflip cooldown active.');
        }
        coinflipCooldowns.set(message.author.id, now);
        const user = await getUser(message.author.id, message.guild.id);
        if (user.balance < bet) return message.reply('❌ Not enough balance.');
        user.balance -= bet;
        const result = Math.random() < 0.5 ? 'heads' : 'tails';
        let winnings = 0;
        let text = `Coin: **${result}**\n`;
        if (choice === result) { winnings = bet * 2; text += `You won $${winnings}`; }
        else { text += `You lost $${bet}`; }
        user.balance += winnings;
        await user.save();
        return message.reply({
            embeds: [new EmbedBuilder()
                .setTitle('🪙 Coinflip')
                .setDescription(text)
                .setColor(winnings ? 0x00ff00 : 0xff0000)]
        });
    }

    // ?dice <bet>
    if (cmd === 'dice') {
        const COOLDOWN = 5 * 60 * 1000;
        const bet = parseInt(args[0]);
        if (!bet || bet <= 0) return message.reply('❌ Usage: `?dice <bet>`');
        if (diceCooldowns.has(message.author.id)) {
            const exp = diceCooldowns.get(message.author.id) + COOLDOWN;
            if (now < exp) return message.reply('⏳ Dice cooldown active.');
        }
        diceCooldowns.set(message.author.id, now);
        const user = await getUser(message.author.id, message.guild.id);
        if (user.balance < bet) return message.reply('❌ Not enough balance.');
        user.balance -= bet;
        const userRoll = Math.floor(Math.random() * 6) + 1;
        const botRoll = Math.floor(Math.random() * 6) + 1;
        let winnings = 0;
        let text = `You: **${userRoll}** | Bot: **${botRoll}**\n`;
        if (userRoll > botRoll) { winnings = bet * 2; text += `You won $${winnings}`; }
        else if (userRoll === botRoll) { winnings = bet; text += `Tie - refunded`; }
        else { text += `You lost $${bet}`; }
        user.balance += winnings;
        await user.save();
        return message.reply({
            embeds: [new EmbedBuilder()
                .setTitle('🎲 Dice')
                .setDescription(text)
                .setColor(winnings > bet ? 0x00ff00 : winnings === bet ? 0xffff00 : 0xff0000)]
        });
    }

    // ?slots <bet>
    if (cmd === 'slots') {
        const COOLDOWN = 5 * 60 * 1000;
        const bet = parseInt(args[0]);
        if (!bet || bet <= 0) return message.reply('❌ Usage: `?slots <bet>`');
        if (slotsCooldowns.has(message.author.id)) {
            const exp = slotsCooldowns.get(message.author.id) + COOLDOWN;
            if (now < exp) return message.reply('⏳ Slots cooldown active. Try again later.');
        }
        slotsCooldowns.set(message.author.id, now);
        const user = await getUser(message.author.id, message.guild.id);
        if (user.balance < bet) return message.reply('❌ Invalid bet.');
        user.balance -= bet;
        const spin = [symbols[Math.floor(Math.random() * symbols.length)], symbols[Math.floor(Math.random() * symbols.length)], symbols[Math.floor(Math.random() * symbols.length)]];
        let winnings = 0;
        let text = 'You lost.';
        if (spin[0] === spin[1] && spin[1] === spin[2]) { winnings = bet * 5; text = `JACKPOT! You won $${winnings}`; }
        else if (spin[0] === spin[1] || spin[1] === spin[2] || spin[0] === spin[2]) { winnings = bet * 2; text = `You won $${winnings}`; }
        user.balance += winnings;
        await user.save();
        return message.reply({
            embeds: [new EmbedBuilder()
                .setTitle('🎰 Slots')
                .setDescription(`${spin.join(' | ')}\n\n${text}`)
                .setColor(winnings ? 0x00ff00 : 0xff0000)]
        });
    }

    // ?rob <@user>
    if (cmd === 'rob') {
        const COOLDOWN = 10 * 60 * 1000;
        const targetId = message.mentions.users.first()?.id;
        if (!targetId) return message.reply('❌ Usage: `?rob @user`');
        if (targetId === message.author.id) return message.reply("❌ You can't rob yourself.");
        if (robCooldowns.has(message.author.id)) {
            const exp = robCooldowns.get(message.author.id) + COOLDOWN;
            if (now < exp) return message.reply('⏳ Rob cooldown active.');
        }
        robCooldowns.set(message.author.id, now);
        const user = await getUser(message.author.id, message.guild.id);
        const victim = await getUser(targetId, message.guild.id);
        if (victim.balance < 50) return message.reply('❌ Target is too poor to rob.');
        const victimTotal = victim.balance + victim.bank;
        if (victimTotal > user.balance * 5) return message.reply('❌ This target is too powerful to rob.');
        let successChance = 0.6;
        if (victimTotal > 1000) successChance = 0.5;
        if (victimTotal > 5000) successChance = 0.4;
        if (victimTotal > 10000) successChance = 0.3;
        if (victimTotal > 25000) successChance = 0.2;
        if (victimTotal > 50000) successChance = 0.1;
        const success = Math.random() < successChance;
        if (success) {
            const amount = Math.floor(Math.min(victim.balance * (0.15 + Math.random() * 0.15), 4000));
            victim.balance -= amount;
            user.balance += amount;
            await user.save(); await victim.save();
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('💰 Rob Success')
                    .setDescription(`You stole **$${amount}** from <@${targetId}>`)
                    .setFooter({ text: `Success chance: ${Math.round(successChance * 100)}%` })
                    .setColor(0x00ff00)]
            });
        } else {
            const penalty = Math.floor(Math.max(user.balance * 0.15, 200));
            user.balance -= penalty;
            await user.save();
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('🚨 Rob Failed')
                    .setDescription(`You got caught and lost **$${penalty}**`)
                    .setFooter({ text: `Success chance: ${Math.round(successChance * 100)}%` })
                    .setColor(0xff0000)]
            });
        }
    }

    // ?duel <@user>
    if (cmd === 'duel') {
        const targetUser = message.mentions.users.first();
        if (!targetUser) return message.reply('❌ Usage: `?duel @user`');
        if (targetUser.bot) return message.reply("❌ You can't duel bots.");
        if (targetUser.id === message.author.id) return message.reply("❌ You can't duel yourself.");
        const participants = [message.author, targetUser];
        const winner = participants[Math.floor(Math.random() * 2)];
        return message.reply({
            embeds: [new EmbedBuilder()
                .setTitle('⚔️ Duel Result')
                .setDescription(`🥊 ${message.author.username} vs ${targetUser.username}\n\n🏆 Winner: **${winner.username}**`)
                .setColor(0x2b2d31)]
        });
    }

    // ?leaderboard / ?lb
    if (cmd === 'leaderboard' || cmd === 'lb') {
        const users = await User.find({ guildId: message.guild.id }).sort({ balance: -1 }).limit(10);
        const description = users.map((u, i) => `**${i + 1}.** <@${u.userId}> - $${u.balance}`).join('\n');
        return message.reply({
            embeds: [new EmbedBuilder()
                .setTitle('🏆 Leaderboard')
                .setDescription(description || 'No data yet.')
                .setColor(0xFFD700)]
        });
    }

    // ?bankleaderboard / ?blb
    if (cmd === 'bankleaderboard' || cmd === 'blb') {
        const users = await User.find({ guildId: message.guild.id }).sort({ bank: -1 }).limit(10);
        if (!users.length) return message.reply('No data yet.');
        const description = users.map((u, i) => `**${i + 1}.** <@${u.userId}> — $${u.bank}`).join('\n');
        return message.reply({
            embeds: [new EmbedBuilder()
                .setTitle('🏦 Bank Leaderboard')
                .setDescription(description)
                .setColor(0x2b2d31)]
        });
    }

    // ?stocks
    if (cmd === 'stocks') {
        const stocks = await Stock.find().sort({ ticker: 1 });
        const rows = stocks.map(s => {
            const prev = s.history.length >= 2 ? s.history[s.history.length - 2] : s.price;
            const change = s.price - prev;
            const pct = ((change / prev) * 100).toFixed(2);
            const arrow = change > 0 ? '🟢' : change < 0 ? '🔴' : '⚪';
            return `${arrow} \`${s.ticker.padEnd(4)}\` **${s.name}** — $${s.price.toFixed(2)} (${change >= 0 ? '+' : ''}${pct}%)`;
        }).join('\n');
        return message.reply({
            embeds: [new EmbedBuilder()
                .setTitle('📈 NRG Stock Market')
                .setDescription(rows)
                .setColor(0x00FF99)
                .setFooter({ text: 'Prices update every 30 minutes' })
                .setTimestamp()]
        });
    }

    // ?buystock <TICKER> <shares>
    if (cmd === 'buystock') {
        const ticker = args[0]?.toUpperCase();
        const shares = parseInt(args[1]);
        if (!ticker || !shares || shares <= 0) return message.reply('❌ Usage: `?buystock <TICKER> <shares>`');
        const stock = await Stock.findOne({ ticker });
        if (!stock) return message.reply(`❌ Ticker \`${ticker}\` not found.`);
        const user = await User.findOne({ userId: message.author.id, guildId: message.guild.id });
        if (!user) return message.reply('❌ You have no economy account.');
        const totalCost = parseFloat((stock.price * shares).toFixed(2));
        if (user.balance < totalCost) return message.reply(`❌ You need **$${totalCost.toFixed(2)}** but only have **$${user.balance.toFixed(2)}**.`);
        user.balance = parseFloat((user.balance - totalCost).toFixed(2));
        await user.save();
        let portfolio = await Portfolio.findOne({ userId: message.author.id, guildId: message.guild.id });
        if (!portfolio) portfolio = new Portfolio({ userId: message.author.id, guildId: message.guild.id, holdings: [] });
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
        return message.reply({
            embeds: [new EmbedBuilder()
                .setTitle('✅ Stock Purchased')
                .setColor(0x00FF99)
                .addFields(
                    { name: 'Stock', value: `${stock.name} (\`${ticker}\`)`, inline: true },
                    { name: 'Shares', value: `${shares}`, inline: true },
                    { name: 'Total Cost', value: `$${totalCost.toFixed(2)}`, inline: true },
                    { name: 'New Price', value: `$${newPrice.toFixed(2)}`, inline: true },
                    { name: 'Cash Remaining', value: `$${user.balance.toFixed(2)}`, inline: true }
                )
                .setFooter({ text: 'NRG Stock Market' })
                .setTimestamp()]
        });
    }

    // ?sellstock <TICKER> <shares>
    if (cmd === 'sellstock') {
        const ticker = args[0]?.toUpperCase();
        const shares = parseInt(args[1]);
        if (!ticker || !shares || shares <= 0) return message.reply('❌ Usage: `?sellstock <TICKER> <shares>`');
        const stock = await Stock.findOne({ ticker });
        if (!stock) return message.reply(`❌ Ticker \`${ticker}\` not found.`);
        const portfolio = await Portfolio.findOne({ userId: message.author.id, guildId: message.guild.id });
        const holding = portfolio?.holdings.find(h => h.ticker === ticker);
        if (!holding || holding.shares < shares) return message.reply(`❌ You don't have enough shares of \`${ticker}\`.`);
        const totalEarned = parseFloat((stock.price * shares).toFixed(2));
        const profit = parseFloat((totalEarned - holding.avgBuyPrice * shares).toFixed(2));
        holding.shares -= shares;
        if (holding.shares === 0) portfolio.holdings = portfolio.holdings.filter(h => h.ticker !== ticker);
        await portfolio.save();
        const user = await User.findOne({ userId: message.author.id, guildId: message.guild.id });
        user.balance = parseFloat((user.balance + totalEarned).toFixed(2));
        await user.save();
        const newPrice = applyPriceImpact(stock.price, shares, -1);
        stock.history.push(newPrice);
        if (stock.history.length > 30) stock.history.shift();
        stock.price = newPrice;
        stock.totalShares = Math.max(0, stock.totalShares - shares);
        await stock.save();
        return message.reply({
            embeds: [new EmbedBuilder()
                .setTitle('💸 Stock Sold')
                .setColor(profit >= 0 ? 0x00FF99 : 0xFF4500)
                .addFields(
                    { name: 'Stock', value: `${stock.name} (\`${ticker}\`)`, inline: true },
                    { name: 'Shares Sold', value: `${shares}`, inline: true },
                    { name: 'Total Earned', value: `$${totalEarned.toFixed(2)}`, inline: true },
                    { name: 'Profit/Loss', value: `${profit >= 0 ? '+' : ''}$${profit.toFixed(2)}`, inline: true },
                    { name: 'New Cash Balance', value: `$${user.balance.toFixed(2)}`, inline: true }
                )
                .setFooter({ text: 'NRG Stock Market' })
                .setTimestamp()]
        });
    }

    // ?portfolio / ?port
    if (cmd === 'portfolio' || cmd === 'port') {
        const portfolio = await Portfolio.findOne({ userId: message.author.id, guildId: message.guild.id });
        if (!portfolio || !portfolio.holdings.length) return message.reply('📭 You have no stocks. Use `?buystock` to get started.');
        let totalValue = 0, totalCost = 0;
        const rows = [];
        for (const h of portfolio.holdings) {
            const stock = await Stock.findOne({ ticker: h.ticker });
            if (!stock) continue;
            const currentValue = stock.price * h.shares;
            const costBasis = h.avgBuyPrice * h.shares;
            const profit = currentValue - costBasis;
            totalValue += currentValue;
            totalCost += costBasis;
            rows.push(`${profit >= 0 ? '🟢' : '🔴'} \`${h.ticker}\` x${h.shares} — $${currentValue.toFixed(2)} (${profit >= 0 ? '+' : ''}$${profit.toFixed(2)})`);
        }
        const totalProfit = totalValue - totalCost;
        return message.reply({
            embeds: [new EmbedBuilder()
                .setTitle(`📊 ${message.author.username}'s Portfolio`)
                .setDescription(rows.join('\n'))
                .setColor(totalProfit >= 0 ? 0x00FF99 : 0xFF4500)
                .addFields(
                    { name: 'Total Value', value: `$${totalValue.toFixed(2)}`, inline: true },
                    { name: 'Total Profit/Loss', value: `${totalProfit >= 0 ? '+' : ''}$${totalProfit.toFixed(2)}`, inline: true }
                )
                .setFooter({ text: 'NRG Stock Market' })
                .setTimestamp()]
        });
    }

    // ?stockhistory / ?sh <TICKER>
    if (cmd === 'stockhistory' || cmd === 'sh') {
        const ticker = args[0]?.toUpperCase();
        if (!ticker) return message.reply('❌ Usage: `?stockhistory <TICKER>`');
        const stock = await Stock.findOne({ ticker });
        if (!stock) return message.reply(`❌ Ticker \`${ticker}\` not found.`);
        const history = stock.history.slice(-10);
        const chart = history.map((p, i) => {
            const prev = history[i - 1] ?? p;
            const arrow = p > prev ? '📈' : p < prev ? '📉' : '➡️';
            return `${arrow} $${p.toFixed(2)}`;
        }).join('\n');
        const first = history[0], last = history[history.length - 1];
        const overallChange = last - first;
        const overallPct = ((overallChange / first) * 100).toFixed(2);
        return message.reply({
            embeds: [new EmbedBuilder()
                .setTitle(`📋 ${stock.name} (\`${ticker}\`) — Price History`)
                .setDescription(chart || 'No history yet.')
                .setColor(overallChange >= 0 ? 0x00FF99 : 0xFF4500)
                .addFields(
                    { name: 'Current Price', value: `$${stock.price.toFixed(2)}`, inline: true },
                    { name: 'Overall Change', value: `${overallChange >= 0 ? '+' : ''}${overallPct}%`, inline: true }
                )
                .setFooter({ text: 'Last 10 price points • NRG Stock Market' })
                .setTimestamp()]
        });
    }

    // ?buy @user
    if (cmd === 'buy') {
        const target = message.mentions.users.first();
        if (!target) return message.reply('❌ Usage: `?buy @user`');
        if (target.id === message.author.id) return message.reply("❌ You can't buy yourself.");
        if (target.bot) return message.reply("❌ You can't buy a bot.");

        const buyer = await getUser(message.author.id, message.guild.id);
        const targetEcon = await getUser(target.id, message.guild.id);

        const existingSlave = await Slave.findOne({ userId: target.id, guildId: message.guild.id });
        if (existingSlave?.ownerId) return message.reply(`❌ <@${target.id}> is already owned by <@${existingSlave.ownerId}>.`);

        const buyPrice = targetEcon.balance * 2;
        if (buyPrice <= 0) return message.reply('❌ This person has no balance to determine a price.');
        if (buyer.balance < buyPrice) return message.reply(`❌ You need **$${buyPrice.toFixed(2)}** to buy <@${target.id}> but only have **$${buyer.balance.toFixed(2)}**.`);

        await message.channel.send({
            embeds: [new EmbedBuilder()
                .setTitle('🔨 Auction Started!')
                .setDescription(
                    `<@${message.author.id}> wants to buy <@${target.id}> for **$${buyPrice.toFixed(2)}**!\n\n` +
                    `<@${target.id}> you have **2 minutes** to escape by typing \`?outbid <amount>\` with more than **$${buyPrice.toFixed(2)}**.\n\n` +
                    `> If no outbid is placed, the purchase goes through automatically.`
                )
                .setColor(0xFF4500)
                .setTimestamp()]
        });

        const filter = m => m.author.id === target.id && m.content.toLowerCase().startsWith('?outbid');
        const collector = message.channel.createMessageCollector({ filter, time: 120000, max: 1 });

        collector.on('collect', async m => {
            const outbidAmount = parseInt(m.content.split(/\s+/)[1]);
            if (!outbidAmount || outbidAmount <= buyPrice) {
                return m.reply(`❌ You need to outbid more than **$${buyPrice.toFixed(2)}**.`);
            }
            const targetEconFresh = await getUser(target.id, message.guild.id);
            if (targetEconFresh.balance < outbidAmount) {
                return m.reply(`❌ You don't have **$${outbidAmount.toFixed(2)}** to outbid.`);
            }
            collector.stop('outbid');
            return m.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('🛡️ Purchase Blocked!')
                    .setDescription(`<@${target.id}> outbid with **$${outbidAmount.toFixed(2)}** and avoided being bought!`)
                    .setColor(0x00FF99)]
            });
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'outbid') return;

            const freshBuyer = await getUser(message.author.id, message.guild.id);
            freshBuyer.balance = parseFloat((freshBuyer.balance - buyPrice).toFixed(2));
            await freshBuyer.save();

            let slave = await Slave.findOne({ userId: target.id, guildId: message.guild.id });
            if (!slave) slave = new Slave({ userId: target.id, guildId: message.guild.id });
            slave.ownerId = message.author.id;
            slave.debt = parseFloat((buyPrice * 2).toFixed(2));
            slave.totalEarned = 0;
            await slave.save();

            await message.channel.send({
                embeds: [new EmbedBuilder()
                    .setTitle('⛓️ Purchase Complete!')
                    .setDescription(
                        `<@${message.author.id}> has bought <@${target.id}> for **$${buyPrice.toFixed(2)}**!\n\n` +
                        `<@${target.id}> must earn **$${(buyPrice * 2).toFixed(2)}** to be free.\n` +
                        `Every dollar they earn goes directly to <@${message.author.id}>.`
                    )
                    .setColor(0xFF0000)
                    .setTimestamp()]
            });

            try {
                await target.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('⛓️ You Have Been Bought!')
                        .setDescription(
                            `<@${message.author.id}> has purchased you for **$${buyPrice.toFixed(2)}**.\n\n` +
                            `You must earn **$${(buyPrice * 2).toFixed(2)}** to be free.\n` +
                            `All money you earn from \`?work\` goes to your owner until your debt is paid.`
                        )
                        .setColor(0xFF0000)]
                });
            } catch {}
        });
    }

    // ?slave - check your slave status
    if (cmd === 'slave') {
        const slave = await Slave.findOne({ userId: message.author.id, guildId: message.guild.id });
        if (!slave?.ownerId) return message.reply('✅ You are a free person.');
        return message.reply({
            embeds: [new EmbedBuilder()
                .setTitle('⛓️ Your Slave Status')
                .setDescription(`You are owned by <@${slave.ownerId}>`)
                .addFields(
                    { name: '💸 Debt Remaining', value: `$${slave.debt.toFixed(2)}`, inline: true },
                    { name: '💰 Total Earned for Owner', value: `$${slave.totalEarned.toFixed(2)}`, inline: true }
                )
                .setColor(0xFF0000)
                .setFooter({ text: 'Keep working to pay off your debt!' })
                .setTimestamp()]
        });
    }

    // ?slavepanel - owner panel
    if (cmd === 'slavepanel') {
        const slaves = await Slave.find({ ownerId: message.author.id, guildId: message.guild.id });
        if (!slaves.length) return message.reply("❌ You don't own anyone.");

        for (const slave of slaves) {
            const slaveEcon = await getUser(slave.userId, message.guild.id);
            const embed = new EmbedBuilder()
                .setTitle(`⛓️ Slave: <@${slave.userId}>`)
                .addFields(
                    { name: '💸 Debt Remaining', value: `$${slave.debt.toFixed(2)}`, inline: true },
                    { name: '💰 Total Earned for You', value: `$${slave.totalEarned.toFixed(2)}`, inline: true },
                    { name: '🏦 Their Current Balance', value: `$${slaveEcon.balance.toFixed(2)}`, inline: true }
                )
                .setColor(0xFF4500)
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`slave_free_${slave.userId}`)
                    .setLabel('🕊️ Set Free')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`slave_renew_${slave.userId}`)
                    .setLabel('🔄 Renew (Double Debt)')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`slave_check_${slave.userId}`)
                    .setLabel('📊 Refresh Stats')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`slave_takepay_${slave.userId}`)
                    .setLabel('💰 Take Payment')
                    .setStyle(ButtonStyle.Primary)
            );

            await message.channel.send({ embeds: [embed], components: [row] });
        }
    }

    // OWNER ONLY COMMANDS
    if (cmd === 'ogive') {
        if (message.author.id !== OWNER_ID) return;
        const targetId = message.mentions.users.first()?.id;
        const amount = parseInt(args[1]);
        if (!targetId || !amount) return message.reply('❌ Usage: `?ogive @user <amount>`');
        const user = await getUser(targetId, message.guild.id);
        user.balance += amount;
        await user.save();
        return message.reply(`Gave $${amount} to <@${targetId}>`);
    }

    if (cmd === 'osetbalance' || cmd === 'osetbal') {
        if (message.author.id !== OWNER_ID) return;
        const targetId = message.mentions.users.first()?.id;
        const amount = parseInt(args[1]);
        if (!targetId || amount === undefined) return message.reply('❌ Usage: `?osetbalance @user <amount>`');
        const user = await getUser(targetId, message.guild.id);
        user.balance = amount;
        await user.save();
        return message.reply('Balance set.');
    }

    if (cmd === 'osetbank') {
        if (message.author.id !== OWNER_ID) return;
        const targetId = message.mentions.users.first()?.id;
        const amount = parseInt(args[1]);
        if (!targetId || amount === undefined) return message.reply('❌ Usage: `?osetbank @user <amount>`');
        const user = await getUser(targetId, message.guild.id);
        user.bank = amount;
        await user.save();
        return message.reply('Bank set.');
    }

    if (cmd === 'ostockfix') {
    if (message.author.id !== OWNER_ID) return;

    const stocks = await Stock.find();
    const results = [];

    for (const stock of stocks) {
        const oldPrice = stock.price;
        const change = 1 + (Math.random() * 0.06 - 0.03);
        const newPrice = Math.max(0.01, parseFloat((stock.price * change).toFixed(2)));
        stock.history.push(newPrice);
        if (stock.history.length > 30) stock.history.shift();
        stock.price = newPrice;
        await stock.save();

        const diff = newPrice - oldPrice;
        const pct = ((diff / oldPrice) * 100).toFixed(2);
        const arrow = diff > 0 ? '🟢' : diff < 0 ? '🔴' : '⚪';
        results.push(`${arrow} \`${stock.ticker}\` $${oldPrice.toFixed(2)} → $${newPrice.toFixed(2)} (${diff >= 0 ? '+' : ''}${pct}%)`);
    }

    return message.reply({
        embeds: [new EmbedBuilder()
            .setTitle('📈 Stock Market Manually Ticked')
            .setDescription(results.join('\n'))
            .setColor(0x00FF99)
            .setFooter({ text: 'Same logic as the 30-minute auto tick' })
            .setTimestamp()]
    });
}

    
    if (cmd === 'oresetleaderboard' || cmd === 'oreset') {
        if (message.author.id !== OWNER_ID) return;
        await User.updateMany({}, { balance: 0, bank: 0 });
        return message.reply('Leaderboard reset.');
    }

    if (cmd === 'oeconomystats' || cmd === 'ostats') {
        if (message.author.id !== OWNER_ID) return;
        const users = await User.find({ guildId: message.guild.id });
        const totalMoney = users.reduce((a, b) => a + b.balance + b.bank, 0);
        const richest = users.sort((a, b) => (b.balance + b.bank) - (a.balance + a.bank))[0];
        return message.reply({
            embeds: [new EmbedBuilder()
                .setTitle('📊 Economy Stats')
                .addFields(
                    { name: 'Users', value: `${users.length}` },
                    { name: 'Total Money', value: `$${totalMoney}` },
                    { name: 'Richest', value: richest ? `<@${richest.userId}>` : 'None' }
                )]
        });
    }

    if (cmd === 'ouserinfo') {
        if (message.author.id !== OWNER_ID) return;
        const targetId = message.mentions.users.first()?.id;
        if (!targetId) return message.reply('❌ Usage: `?ouserinfo @user`');
        const user = await getUser(targetId, message.guild.id);
        return message.reply({
            embeds: [new EmbedBuilder()
                .setTitle('👤 User Info')
                .addFields(
                    { name: 'Balance', value: `${user.balance}` },
                    { name: 'Bank', value: `${user.bank}` }
                )]
        });
    }

    if (cmd === 'ojackpotdrop') {
        if (message.author.id !== OWNER_ID) return;
        const amount = parseInt(args[0]);
        if (!amount) return message.reply('❌ Usage: `?ojackpotdrop <amount>`');
        const users = await User.find({ guildId: message.guild.id });
        if (!users.length) return message.reply('No users found.');
        const winner = users[Math.floor(Math.random() * users.length)];
        winner.balance += amount;
        await winner.save();
        return message.reply({
            embeds: [new EmbedBuilder()
                .setTitle('💰 Jackpot Drop')
                .setDescription(`<@${winner.userId}> won $${amount}`)
                .setColor(0x00ff00)]
        });
    }

    if (cmd === 'clearcooldowns') {
        if (message.author.id !== OWNER_ID) return;
        workCooldowns.clear();
        coinflipCooldowns.clear();
        diceCooldowns.clear();
        slotsCooldowns.clear();
        robCooldowns.clear();
        return message.reply('Cooldowns cleared.');
    }

    // ?help
    if (cmd === 'help') {
        return message.reply({
            embeds: [new EmbedBuilder()
                .setTitle('📖 NRG Bot — Prefix Commands')
                .setColor(0x2b2d31)
                .addFields(
                    { name: '💰 Economy', value: '`?balance` `?deposit` `?withdraw` `?givemoney` `?work`', inline: false },
                    { name: '🎰 Gambling', value: '`?coinflip <bet> <heads|tails>` `?dice <bet>` `?slots <bet>` `?rob @user` `?duel @user`', inline: false },
                    { name: '📈 Stocks', value: '`?stocks` `?buystock <TICKER> <shares>` `?sellstock <TICKER> <shares>` `?portfolio` `?stockhistory <TICKER>`', inline: false },
                    { name: '🏆 Leaderboards', value: '`?leaderboard` `?bankleaderboard`', inline: false },
                    { name: '⛓️ Slave System', value: '`?buy @user` `?slave` `?slavepanel`', inline: false },
                    { name: '👑 Owner Only', value: '`?ogive` `?osetbalance` `?osetbank` `?oresetleaderboard` `?oeconomystats` `?ouserinfo` `?ojackpotdrop` `?clearcooldowns`', inline: false }
                )
                .setFooter({ text: 'NRG Economy Bot' })]
        });
    }
});

client.on('interactionCreate', async interaction => {

    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (command) await command.execute(interaction);
    }

    if (interaction.isButton()) {

        if (interaction.customId.startsWith('slave_free_')) {
            const targetId = interaction.customId.split('_')[2];
            const slave = await Slave.findOne({ userId: targetId, guildId: interaction.guild.id });
            if (!slave || slave.ownerId !== interaction.user.id) return interaction.reply({ content: '❌ Not your slave.', ephemeral: true });
            slave.ownerId = null;
            slave.debt = 0;
            slave.totalEarned = 0;
            await slave.save();
            await interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('🕊️ Slave Freed')
                    .setDescription(`<@${targetId}> has been set free.`)
                    .setColor(0x00FF99)]
            });
            try {
                const user = await client.users.fetch(targetId);
                await user.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('🕊️ You Are Free!')
                        .setDescription(`<@${interaction.user.id}> has set you free. You are no longer enslaved.`)
                        .setColor(0x00FF99)]
                });
            } catch {}
        }

        if (interaction.customId.startsWith('slave_renew_')) {
            const targetId = interaction.customId.split('_')[2];
            const slave = await Slave.findOne({ userId: targetId, guildId: interaction.guild.id });
            if (!slave || slave.ownerId !== interaction.user.id) return interaction.reply({ content: '❌ Not your slave.', ephemeral: true });

            const renewCost = parseFloat((slave.debt / 2).toFixed(2));
            const owner = await getUser(interaction.user.id, interaction.guild.id);

            if (owner.balance < renewCost) {
                return interaction.reply({
                    content: `❌ You need **$${renewCost.toFixed(2)}** (half of current debt) to renew but only have **$${owner.balance.toFixed(2)}**.`,
                    ephemeral: true
                });
            }

            owner.balance = parseFloat((owner.balance - renewCost).toFixed(2));
            await owner.save();

            const oldDebt = slave.debt;
            slave.debt = parseFloat((slave.debt * 2).toFixed(2));
            await slave.save();

            await interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('🔄 Debt Renewed')
                    .setDescription(
                        `You paid **$${renewCost.toFixed(2)}** to renew <@${targetId}>'s contract.\n\n` +
                        `Their debt went from **$${oldDebt.toFixed(2)}** → **$${slave.debt.toFixed(2)}**.`
                    )
                    .setColor(0xFF4500)]
            });
            try {
                const user = await client.users.fetch(targetId);
                await user.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('⛓️ Your Debt Has Been Renewed!')
                        .setDescription(`Your owner paid to extend your contract. Your debt has doubled to **$${slave.debt.toFixed(2)}**.`)
                        .setColor(0xFF4500)]
                });
            } catch {}
        }

        if (interaction.customId.startsWith('slave_check_')) {
            const targetId = interaction.customId.split('_')[2];
            const slave = await Slave.findOne({ userId: targetId, guildId: interaction.guild.id });
            if (!slave || slave.ownerId !== interaction.user.id) return interaction.reply({ content: '❌ Not your slave.', ephemeral: true });
            const slaveEcon = await getUser(targetId, interaction.guild.id);
            await interaction.reply({
                ephemeral: true,
                embeds: [new EmbedBuilder()
                    .setTitle(`📊 Stats for <@${targetId}>`)
                    .addFields(
                        { name: '💸 Debt Remaining', value: `$${slave.debt.toFixed(2)}`, inline: true },
                        { name: '💰 Total Earned for You', value: `$${slave.totalEarned.toFixed(2)}`, inline: true },
                        { name: '🏦 Their Balance', value: `$${slaveEcon.balance.toFixed(2)}`, inline: true }
                    )
                    .setColor(0x2b2d31)
                    .setTimestamp()]
            });
        }

        if (interaction.customId.startsWith('slave_takepay_')) {
            const targetId = interaction.customId.split('_')[2];
            const slave = await Slave.findOne({ userId: targetId, guildId: interaction.guild.id });
            if (!slave || slave.ownerId !== interaction.user.id) return interaction.reply({ content: '❌ Not your slave.', ephemeral: true });

            const modal = new ModalBuilder()
                .setCustomId(`takepay_modal_${targetId}`)
                .setTitle('Take Payment from Slave');
            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('takepay_amount')
                        .setLabel(`Amount to take (Debt: $${slave.debt.toFixed(2)})`)
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('e.g. 500')
                        .setRequired(true)
                )
            );
            return interaction.showModal(modal);
        }

        if (interaction.customId === 'open_order_modal') {
            const modal = new ModalBuilder()
                .setCustomId('order_modal')
                .setTitle('Order Form');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('website_ip').setLabel('Website IP').setStyle(TextInputStyle.Short)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('website_name').setLabel('Website Name').setStyle(TextInputStyle.Short)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('filters').setLabel('List of Filter Links you want').setStyle(TextInputStyle.Paragraph))
            );
            return interaction.showModal(modal);
        }

        if (interaction.customId.startsWith('respond_')) {
            const userId = interaction.customId.split('_')[1];
            const modal = new ModalBuilder()
                .setCustomId(`response_modal_${userId}`)
                .setTitle('Send Links');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('links').setLabel('Insert Links here').setStyle(TextInputStyle.Paragraph))
            );
            return interaction.showModal(modal);
        }
    }

    if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('takepay_modal_')) {
            const targetId = interaction.customId.split('_')[2];
            const amount = parseFloat(interaction.fields.getTextInputValue('takepay_amount'));

            if (!amount || isNaN(amount) || amount <= 0) {
                return interaction.reply({ content: '❌ Invalid amount.', ephemeral: true });
            }

            const slave = await Slave.findOne({ userId: targetId, guildId: interaction.guild.id });
            if (!slave || slave.ownerId !== interaction.user.id) {
                return interaction.reply({ content: '❌ Not your slave.', ephemeral: true });
            }

            const slaveUser = await getUser(targetId, interaction.guild.id);
            if (slaveUser.balance < amount) {
                return interaction.reply({
                    content: `❌ <@${targetId}> only has **$${slaveUser.balance.toFixed(2)}** in their wallet.`,
                    ephemeral: true
                });
            }

            const taken = parseFloat(Math.min(amount, slave.debt).toFixed(2));
            slaveUser.balance = parseFloat((slaveUser.balance - taken).toFixed(2));
            await slaveUser.save();

            slave.debt = parseFloat((slave.debt - taken).toFixed(2));

            if (slave.debt <= 0) {
                slave.ownerId = null;
                slave.debt = 0;
                await slave.save();

                await interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setTitle('✅ Debt Fully Paid!')
                        .setDescription(`You took **$${taken.toFixed(2)}** from <@${targetId}>'s wallet — their debt is now cleared and they are free.`)
                        .setColor(0x00FF99)]
                });

                try {
                    const freedUser = await client.users.fetch(targetId);
                    await freedUser.send({
                        embeds: [new EmbedBuilder()
                            .setTitle('🕊️ You Are Free!')
                            .setDescription(`<@${interaction.user.id}> took **$${taken.toFixed(2)}** from your wallet to cover your remaining debt. You are now free.`)
                            .setColor(0x00FF99)]
                    });
                } catch {}
            } else {
                await slave.save();

                await interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setTitle('💰 Payment Taken')
                        .setDescription(`Took **$${taken.toFixed(2)}** from <@${targetId}>'s wallet.`)
                        .addFields(
                            { name: '💸 Debt Remaining', value: `$${slave.debt.toFixed(2)}`, inline: true },
                            { name: '🏦 Their Remaining Balance', value: `$${slaveUser.balance.toFixed(2)}`, inline: true }
                        )
                        .setColor(0xFF4500)]
                });

                try {
                    const slaveDiscordUser = await client.users.fetch(targetId);
                    await slaveDiscordUser.send({
                        embeds: [new EmbedBuilder()
                            .setTitle('💸 Payment Taken')
                            .setDescription(`<@${interaction.user.id}> took **$${taken.toFixed(2)}** from your wallet toward your debt.`)
                            .addFields(
                                { name: '💸 Debt Remaining', value: `$${slave.debt.toFixed(2)}`, inline: true },
                                { name: '🏦 Your Remaining Balance', value: `$${slaveUser.balance.toFixed(2)}`, inline: true }
                            )
                            .setColor(0xFF4500)
                            .setFooter({ text: 'Keep working to pay off your debt!' })]
                    });
                } catch {}
            }
        }

        if (interaction.customId === 'order_modal') {
            const ip = interaction.fields.getTextInputValue('website_ip');
            const name = interaction.fields.getTextInputValue('website_name');
            const filters = interaction.fields.getTextInputValue('filters');
            const userId = interaction.user.id;
            await interaction.user.send('Your order has been received. You will get your links soon.');
            const embed = {
                title: 'New Order',
                fields: [
                    { name: 'User', value: `<@${userId}>` },
                    { name: 'Website IP', value: ip },
                    { name: 'Website Name', value: name },
                    { name: 'Filters', value: filters }
                ],
                color: 0x2b2d31
            };
            const components = [{ type: 1, components: [{ type: 2, label: 'Send Links', style: 1, custom_id: `respond_${userId}` }] }];
            await fetch(process.env.WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ embeds: [embed], components })
            });
            return interaction.reply({ content: 'Order submitted! Check your DMs.', ephemeral: true });
        }

        if (interaction.customId.startsWith('response_modal_')) {
            const userId = interaction.customId.split('_')[2];
            const links = interaction.fields.getTextInputValue('links');
            try {
                const user = await client.users.fetch(userId);
                await user.send(`📦 Your Order is Ready!\n\n${links}`);
                return interaction.reply({ content: 'Links sent to user.', ephemeral: true });
            } catch (err) {
                return interaction.reply({ content: 'Failed to DM user.', ephemeral: true });
            }
        }
    }
});

client.login(process.env.TOKEN);
