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
const Config = require('./models/Config');

const PREFIX = '?';
const OWNER_ID = '1453078748080504996';
const isAdmin = (member) => member.permissions.has('Administrator') || member.id === OWNER_ID;
const MAX_BALANCE = 999_999_999_999_999;

// Cooldown maps
const workCooldowns = new Map();
const coinflipCooldowns = new Map();
const diceCooldowns = new Map();
const slotsCooldowns = new Map();
const robCooldowns = new Map();

const symbols = ['🍒', '🍋', '🍉', '⭐', '💎', '🍀'];

// ── Format helper ──────────────────────────────────────────────────
const fmt = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (n) => Number(n).toLocaleString('en-US');

// ── Parse amount helper (handles "all", "max", decimals, big numbers) ──
function parseAmount(str, balance) {
    if (!str) return NaN;
    const s = str.toString().toLowerCase();
    if (s === 'all' || s === 'max') return balance;
    const n = parseFloat(s);
    return isNaN(n) ? NaN : n;
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

const COMPANIES = [
    { ticker: 'VLR',  name: 'Velera Inc',           price: 142.50 },
    { ticker: 'FRGS', name: "Frogiee's Arcade",      price: 34.20  },
    { ticker: 'DOGE', name: 'Doge UB',               price: 0.85   },
    { ticker: 'CHRI', name: 'Cherri Inc',             price: 58.00  },
    { ticker: 'TGLC', name: 'TGLSC Corp',             price: 210.00 },
    { ticker: 'GNMT', name: 'Gn Math',               price: 76.40  },
    { ticker: 'CNOS', name: 'Cine OS',               price: 99.99  },
    { ticker: 'OVCL', name: 'Overcloaked Corp',       price: 185.30 },
    { ticker: 'TRFL', name: 'Truffled Inc',           price: 47.60  },
    { ticker: 'LNR',  name: 'LUNAR Research Inc',     price: 320.00 },
    { ticker: 'VOID', name: 'Void Network Corp',      price: 5.55   },
    { ticker: 'HDR',  name: 'Hydra Network Corp',     price: 88.88  },
    { ticker: 'NRGX', name: 'NRG Exchange',           price: 500.00 },
    { ticker: 'PLSM', name: 'Plasma Dynamics Inc',    price: 63.75  },
    { ticker: 'ZRTH', name: 'Zeroth Systems',         price: 112.00 },
];

async function seedMarket(guildId) {
    for (const c of COMPANIES) {
        await Stock.findOneAndUpdate(
            { guildId, ticker: c.ticker },
            { guildId, ...c, history: [c.price], totalShares: 0 },
            { upsert: true, new: true }
        );
    }
}

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
    // Market tick every 30 minutes — only auto tick
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

client.on('guildCreate', async guild => {
    console.log(`Joined new guild: ${guild.name} (${guild.id})`);
    try {
        await seedMarket(guild.id);
        console.log(`Seeded stocks for ${guild.name}`);
    } catch (e) {
        console.error(`Failed to seed stocks for ${guild.name}:`, e);
    }

    const welcomeEmbed = new EmbedBuilder()
        .setTitle('💣 Economic Bomb has arrived!')
        .setDescription(
            `Thanks for adding **Economic Bomb** to your server!\n\n` +
            `The stock market has been automatically set up with **15 companies**.\n\n` +
            `**Getting started:**\n` +
            `> \`?help\` — view all commands\n` +
            `> \`?stocks\` — view the stock market\n` +
            `> \`?work\` — start earning money\n` +
            `> \`?daily\` — claim your daily reward\n\n` +
            `**Admin commands:**\n` +
            `> \`?setupmarket\` — re-seed the stock market anytime\n` +
            `> Dashboard: https://economicbomb.nrglearning.xyz`
        )
        .setColor(0xFFD700)
        .setFooter({ text: 'Economic Bomb • Use ?help for all commands' });

    try {
        const ch = guild.systemChannel ?? guild.channels.cache
            .filter(c => c.type === 0 && c.permissionsFor(guild.members.me)?.has('SendMessages'))
            .sort((a, b) => a.position - b.position).first();
        if (ch) await ch.send({ embeds: [welcomeEmbed] });
    } catch {}
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const cmd = args.shift().toLowerCase();
    const now = Date.now();
    const guildId = message.guild.id;

    // ── Config helpers ─────────────────────────────────────────
    const config = await Config.findOne({ guildId }) || {};
    const modules = config.modules || {};
    const bannedUsers = config.bannedUsers || [];
    const allowedChannels = config.allowedChannels || [];

    // ── Channel restriction ─────────────────────────────────────
    if (allowedChannels.length > 0 && !allowedChannels.includes(message.channel.id)) return;

    // ── Ban check ───────────────────────────────────────────────
    const banEntry = bannedUsers.find(b => b.userId === message.author.id);
    if (banEntry) {
        return message.reply({
            embeds: [new EmbedBuilder()
                .setTitle('You Are Banned')
                .setDescription(`You have been banned from using this bot.\n**Reason:** ${banEntry.reason || 'No reason given'}`)
                .setColor(0xff0000)]
        });
    }

    // ── Module check ────────────────────────────────────────────
    const MODULE_MAP = {
        work: ['work'],
        rob: ['rob'],
        coinflip: ['coinflip', 'cf'],
        dice: ['dice'],
        slots: ['slots'],
        duel: ['duel'],
        stocks: ['stocks', 'buystock', 'sellstock', 'portfolio', 'port', 'stockhistory', 'sh'],
        slave: ['buy', 'outbid', 'slave', 'slavepanel', 'slavelist'],
        givemoney: ['givemoney', 'give'],
        deposit: ['deposit', 'dep'],
        withdraw: ['withdraw', 'with'],
        leaderboard: ['leaderboard', 'lb', 'bankleaderboard', 'blb']
    };
    for (const [mod, cmds] of Object.entries(MODULE_MAP)) {
        if (cmds.includes(cmd) && modules[mod] === false) {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('Feature Disabled')
                    .setDescription(`The \`?${cmd}\` command is currently disabled in this server.`)
                    .setColor(0x71717a)]
            });
        }
    }

    // ── Anti-cheat helper ───────────────────────────────────────
    async function anticheatCheck(userId) {
        const u = await getUser(userId, guildId);
        const total = u.balance + u.bank;
        if (total > MAX_BALANCE) {
            u.balance = 0;
            u.bank = 0;
            await u.save();
            try {
                const du = await client.users.fetch(userId);
                await du.send({ embeds: [new EmbedBuilder().setTitle('Anti-Cheat Triggered').setDescription('Your balance was reset to $0 for exceeding the maximum allowed amount.').setColor(0xff0000)] });
            } catch {}
            return true;
        }
        return false;
    }

    // ── Cooldown helper ─────────────────────────────────────────
    function checkCooldown(map, userId, ms) {
        if (map.has(userId)) {
            const exp = map.get(userId) + ms;
            if (now < exp) {
                const left = exp - now;
                const m = Math.floor(left / 60000);
                const s = Math.ceil((left % 60000) / 1000);
                return m > 0 ? `${m}m ${s}s` : `${s}s`;
            }
        }
        map.set(userId, now);
        return null;
    }

    // ────────────────────────────────────────────────────────────
    // ?balance / ?bal
    // ────────────────────────────────────────────────────────────
    if (cmd === 'balance' || cmd === 'bal') {
        const user = await getUser(message.author.id, guildId);
        return message.reply({
            embeds: [new EmbedBuilder()
                .setTitle(`${message.author.username}'s Balance`)
                .addFields(
                    { name: 'Wallet', value: `$${fmt(user.balance)}`, inline: true },
                    { name: 'Bank', value: `$${fmt(user.bank)}`, inline: true }
                )
                .setColor(0x2b2d31)]
        });
    }

    // ────────────────────────────────────────────────────────────
    // ?work
    // ────────────────────────────────────────────────────────────
    if (cmd === 'work') {
        const COOLDOWN = 2 * 60 * 1000;
        const user = await getUser(message.author.id, guildId);

        if (user.lastWork && now - user.lastWork < COOLDOWN) {
            const left = COOLDOWN - (now - user.lastWork);
            const s = Math.ceil(left / 1000);
            return message.reply(`⏳ You need to wait **${s}s** before working again.`);
        }

        const amount = Math.floor(Math.random() * 76) + 25;
        user.lastWork = now;

        const slave = await Slave.findOne({ userId: message.author.id, guildId });

        if (slave?.ownerId) {
            slave.debt = parseFloat((slave.debt - amount).toFixed(2));
            slave.totalEarned = parseFloat((slave.totalEarned + amount).toFixed(2));

            const owner = await getUser(slave.ownerId, guildId);
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
                    await ownerUser.send({ embeds: [new EmbedBuilder().setTitle('Slave Debt Paid Off').setDescription(`<@${message.author.id}> has paid off their debt and is now free.`).setColor(0x00FF99)] });
                } catch {}
                return message.reply({ embeds: [new EmbedBuilder().setTitle('You Are Free!').setDescription(`You worked and earned **$${fmtInt(amount)}** — your debt is fully paid off!`).setColor(0x00FF99)] });
            }

            await slave.save();
            await user.save();
            try {
                const ownerUser = await client.users.fetch(slave.ownerId);
                await ownerUser.send({ embeds: [new EmbedBuilder().setTitle('Your Slave Worked!').setDescription(`<@${message.author.id}> earned **$${fmtInt(amount)}** for you.\nRemaining debt: **$${fmt(slave.debt)}**`).setColor(0x2b2d31)] });
            } catch {}
            return message.reply({ embeds: [new EmbedBuilder().setTitle('Work Complete').setDescription(`You earned **$${fmtInt(amount)}** — but it went to your owner <@${slave.ownerId}>.\n\n**Debt Remaining:** $${fmt(slave.debt)}`).setColor(0xFF4500).setFooter({ text: 'Keep working to pay off your debt!' })] });
        }

        user.balance += amount;
        await user.save();
        await anticheatCheck(message.author.id);
        return message.reply({ embeds: [new EmbedBuilder().setTitle('Work Complete').setDescription(`You earned **$${fmtInt(amount)}**`).setColor(0x00ff00)] });
    }

    // ────────────────────────────────────────────────────────────
    // ?deposit / ?dep
    // ────────────────────────────────────────────────────────────
    if (cmd === 'deposit' || cmd === 'dep') {
        const user = await getUser(message.author.id, guildId);
        const amount = parseAmount(args[0], user.balance);
        if (isNaN(amount) || amount <= 0) return message.reply('❌ Usage: `?deposit <amount|all>`');
        if (amount > MAX_BALANCE) return message.reply(`❌ Amount too large. Max is $${fmtInt(MAX_BALANCE)}.`);
        if (user.balance < amount) return message.reply("❌ You don't have enough in your wallet.");
        user.balance = parseFloat((user.balance - amount).toFixed(2));
        user.bank = parseFloat((user.bank + amount).toFixed(2));
        await user.save();
        return message.reply({ embeds: [new EmbedBuilder().setTitle('Deposit Successful').setDescription(`Deposited **$${fmt(amount)}** into your bank.`).addFields({ name: 'New Bank Balance', value: `$${fmt(user.bank)}`, inline: true }).setColor(0x00ff00)] });
    }

    // ────────────────────────────────────────────────────────────
    // ?withdraw / ?with
    // ────────────────────────────────────────────────────────────
    if (cmd === 'withdraw' || cmd === 'with') {
        const user = await getUser(message.author.id, guildId);
        const amount = parseAmount(args[0], user.bank);
        if (isNaN(amount) || amount <= 0) return message.reply('❌ Usage: `?withdraw <amount|all>`');
        if (amount > MAX_BALANCE) return message.reply(`❌ Amount too large. Max is $${fmtInt(MAX_BALANCE)}.`);
        if (user.bank < amount) return message.reply("❌ You don't have enough in your bank.");
        user.bank = parseFloat((user.bank - amount).toFixed(2));
        user.balance = parseFloat((user.balance + amount).toFixed(2));
        await user.save();
        return message.reply({ embeds: [new EmbedBuilder().setTitle('Withdrawal Successful').setDescription(`Withdrew **$${fmt(amount)}** from your bank.`).addFields({ name: 'New Wallet Balance', value: `$${fmt(user.balance)}`, inline: true }).setColor(0x00ff00)] });
    }

    // ────────────────────────────────────────────────────────────
    // ?givemoney / ?give
    // ────────────────────────────────────────────────────────────
    if (cmd === 'givemoney' || cmd === 'give') {
        const targetId = message.mentions.users.first()?.id;
        if (!targetId) return message.reply('❌ Usage: `?give @user <amount>`');
        if (targetId === message.author.id) return message.reply('❌ You cannot give money to yourself.');
        const amount = parseFloat(args[1]);
        if (isNaN(amount) || amount <= 0) return message.reply('❌ Usage: `?give @user <amount>`');
        const user = await getUser(message.author.id, guildId);
        if (user.balance < amount) return message.reply('❌ Not enough money.');
        const receiver = await getUser(targetId, guildId);
        user.balance = parseFloat((user.balance - amount).toFixed(2));
        receiver.balance = parseFloat((receiver.balance + amount).toFixed(2));
        await user.save();
        await receiver.save();
        return message.reply({ embeds: [new EmbedBuilder().setTitle('Transfer Complete').setDescription(`You gave **$${fmt(amount)}** to <@${targetId}>`).setColor(0x00ff00)] });
    }

    // ────────────────────────────────────────────────────────────
    // ?coinflip / ?cf
    // ────────────────────────────────────────────────────────────
    if (cmd === 'coinflip' || cmd === 'cf') {
        const COOLDOWN = 5 * 60 * 1000;
        const bet = parseFloat(args[0]);
        const choice = args[1]?.toLowerCase();
        if (isNaN(bet) || bet <= 0 || !['heads', 'tails', 'h', 't'].includes(choice)) return message.reply('❌ Usage: `?coinflip <bet> <heads|tails>`');
        const cd = checkCooldown(coinflipCooldowns, message.author.id, COOLDOWN);
        if (cd) return message.reply(`⏳ Coinflip cooldown active. Try again in **${cd}**.`);
        const user = await getUser(message.author.id, guildId);
        if (user.balance < bet) return message.reply('❌ Not enough balance.');
        user.balance = parseFloat((user.balance - bet).toFixed(2));
        const normalizedChoice = choice === 'h' ? 'heads' : choice === 't' ? 'tails' : choice;
        const result = Math.random() < 0.5 ? 'heads' : 'tails';
        let winnings = 0;
        let text = `Coin landed on **${result}**\n`;
        if (normalizedChoice === result) { winnings = parseFloat((bet * 2).toFixed(2)); text += `You won **$${fmt(winnings)}**!`; }
        else { text += `You lost **$${fmt(bet)}**.`; }
        user.balance = parseFloat((user.balance + winnings).toFixed(2));
        await user.save();
        await anticheatCheck(message.author.id);
        return message.reply({ embeds: [new EmbedBuilder().setTitle('Coinflip').setDescription(text).setColor(winnings ? 0x00ff00 : 0xff0000)] });
    }

    // ────────────────────────────────────────────────────────────
    // ?dice
    // ────────────────────────────────────────────────────────────
    if (cmd === 'dice') {
        const COOLDOWN = 5 * 60 * 1000;
        const bet = parseFloat(args[0]);
        if (isNaN(bet) || bet <= 0) return message.reply('❌ Usage: `?dice <bet>`');
        const cd = checkCooldown(diceCooldowns, message.author.id, COOLDOWN);
        if (cd) return message.reply(`⏳ Dice cooldown active. Try again in **${cd}**.`);
        const user = await getUser(message.author.id, guildId);
        if (user.balance < bet) return message.reply('❌ Not enough balance.');
        user.balance = parseFloat((user.balance - bet).toFixed(2));
        const userRoll = Math.floor(Math.random() * 6) + 1;
        const botRoll = Math.floor(Math.random() * 6) + 1;
        let winnings = 0;
        let text = `You: **${userRoll}** | Bot: **${botRoll}**\n`;
        if (userRoll > botRoll) { winnings = parseFloat((bet * 2).toFixed(2)); text += `You won **$${fmt(winnings)}**!`; }
        else if (userRoll === botRoll) { winnings = bet; text += `Tie — bet refunded.`; }
        else { text += `You lost **$${fmt(bet)}**.`; }
        user.balance = parseFloat((user.balance + winnings).toFixed(2));
        await user.save();
        await anticheatCheck(message.author.id);
        return message.reply({ embeds: [new EmbedBuilder().setTitle('Dice Roll').setDescription(text).setColor(winnings > bet ? 0x00ff00 : winnings === bet ? 0xffff00 : 0xff0000)] });
    }

    // ────────────────────────────────────────────────────────────
    // ?slots
    // ────────────────────────────────────────────────────────────
    if (cmd === 'slots') {
        const COOLDOWN = 5 * 60 * 1000;
        const bet = parseFloat(args[0]);
        if (isNaN(bet) || bet <= 0) return message.reply('❌ Usage: `?slots <bet>`');
        const cd = checkCooldown(slotsCooldowns, message.author.id, COOLDOWN);
        if (cd) return message.reply(`⏳ Slots cooldown active. Try again in **${cd}**.`);
        const user = await getUser(message.author.id, guildId);
        if (user.balance < bet) return message.reply('❌ Not enough balance.');
        user.balance = parseFloat((user.balance - bet).toFixed(2));
        const spin = [0,1,2].map(() => symbols[Math.floor(Math.random() * symbols.length)]);
        let winnings = 0;
        let text = '';
        if (spin[0] === spin[1] && spin[1] === spin[2]) { winnings = parseFloat((bet * 5).toFixed(2)); text = `JACKPOT! You won **$${fmt(winnings)}**!`; }
        else if (spin[0] === spin[1] || spin[1] === spin[2] || spin[0] === spin[2]) { winnings = parseFloat((bet * 2).toFixed(2)); text = `You won **$${fmt(winnings)}**!`; }
        else { text = `You lost **$${fmt(bet)}**.`; }
        user.balance = parseFloat((user.balance + winnings).toFixed(2));
        await user.save();
        await anticheatCheck(message.author.id);
        return message.reply({ embeds: [new EmbedBuilder().setTitle('Slots').setDescription(`${spin.join(' | ')}\n\n${text}`).setColor(winnings ? 0x00ff00 : 0xff0000)] });
    }

    // ────────────────────────────────────────────────────────────
    // ?rob
    // ────────────────────────────────────────────────────────────
    if (cmd === 'rob') {
        const COOLDOWN = 10 * 60 * 1000;
        const targetId = message.mentions.users.first()?.id;
        if (!targetId) return message.reply('❌ Usage: `?rob @user`');
        if (targetId === message.author.id) return message.reply("❌ You can't rob yourself.");
        const cd = checkCooldown(robCooldowns, message.author.id, COOLDOWN);
        if (cd) return message.reply(`⏳ Rob cooldown active. Try again in **${cd}**.`);
        const user = await getUser(message.author.id, guildId);
        const victim = await getUser(targetId, guildId);
        if (victim.balance < 50) return message.reply('❌ Target is too poor to rob.');
        const victimTotal = victim.balance + victim.bank;
        if (victimTotal > user.balance * 5) return message.reply('❌ This target is too powerful to rob.');
        let successChance = 0.6;
        if (victimTotal > 1000) successChance = 0.5;
        if (victimTotal > 5000) successChance = 0.4;
        if (victimTotal > 10000) successChance = 0.3;
        if (victimTotal > 25000) successChance = 0.2;
        if (victimTotal > 50000) successChance = 0.1;
        if (Math.random() < successChance) {
            const amount = parseFloat(Math.min(victim.balance * (0.15 + Math.random() * 0.15), 4000).toFixed(2));
            victim.balance = parseFloat((victim.balance - amount).toFixed(2));
            user.balance = parseFloat((user.balance + amount).toFixed(2));
            await user.save(); await victim.save();
            await anticheatCheck(message.author.id);
            return message.reply({ embeds: [new EmbedBuilder().setTitle('Rob Success').setDescription(`You stole **$${fmt(amount)}** from <@${targetId}>`).setFooter({ text: `Success chance: ${Math.round(successChance * 100)}%` }).setColor(0x00ff00)] });
        } else {
            const penalty = parseFloat(Math.max(user.balance * 0.15, 200).toFixed(2));
            user.balance = parseFloat((user.balance - penalty).toFixed(2));
            await user.save();
            return message.reply({ embeds: [new EmbedBuilder().setTitle('Rob Failed').setDescription(`You got caught and lost **$${fmt(penalty)}**`).setFooter({ text: `Success chance: ${Math.round(successChance * 100)}%` }).setColor(0xff0000)] });
        }
    }

    // ────────────────────────────────────────────────────────────
    // ?duel — with optional bet, "all" support, and death chance
    // ────────────────────────────────────────────────────────────
    if (cmd === 'duel') {
        const targetUser = message.mentions.users.first();
        if (!targetUser) return message.reply('❌ Usage: `?duel @user [bet|all]`');
        if (targetUser.bot) return message.reply("❌ You can't duel bots.");
        if (targetUser.id === message.author.id) return message.reply("❌ You can't duel yourself.");

        const challenger = await getUser(message.author.id, guildId);
        const opponent = await getUser(targetUser.id, guildId);

        let betAmount = 0;
        if (args[1]) {
            const raw = args[1].toLowerCase();
            betAmount = raw === 'all' ? Math.min(challenger.balance, opponent.balance) : parseFloat(raw);
            if (isNaN(betAmount) || betAmount <= 0) return message.reply('❌ Invalid bet amount.');
            if (challenger.balance < betAmount) return message.reply(`❌ You don't have **$${fmt(betAmount)}** to bet.`);
            if (opponent.balance < betAmount) return message.reply(`❌ <@${targetUser.id}> doesn't have **$${fmt(betAmount)}** to bet.`);
        }

        // 0.0000001% chance both die
        const DEATH_CHANCE = 0.000001;
        if (Math.random() < DEATH_CHANCE) {
            if (betAmount > 0) {
                challenger.balance = parseFloat((challenger.balance - betAmount).toFixed(2));
                opponent.balance = parseFloat((opponent.balance - betAmount).toFixed(2));
                await challenger.save();
                await opponent.save();
            }
            return message.reply({ embeds: [new EmbedBuilder().setTitle('Both players died...').setDescription(`${message.author.username} and ${targetUser.username} somehow managed to kill each other.${betAmount > 0 ? `\n\nBoth lost **$${fmt(betAmount)}**.` : ''}`).setColor(0x71717a)] });
        }

        const winner = Math.random() < 0.5 ? message.author : targetUser;
        const loser = winner.id === message.author.id ? targetUser : message.author;

        if (betAmount > 0) {
            const winnerEcon = await getUser(winner.id, guildId);
            const loserEcon = await getUser(loser.id, guildId);
            winnerEcon.balance = parseFloat((winnerEcon.balance + betAmount).toFixed(2));
            loserEcon.balance = parseFloat((loserEcon.balance - betAmount).toFixed(2));
            await winnerEcon.save();
            await loserEcon.save();
        }

        return message.reply({ embeds: [new EmbedBuilder().setTitle('Duel Result').setDescription(`${message.author.username} vs ${targetUser.username}\n\nWinner: **${winner.username}**${betAmount > 0 ? `\n\n**$${fmt(betAmount)}** transferred to winner` : ''}`).setColor(0x2b2d31)] });
    }

    // ────────────────────────────────────────────────────────────
    // ?leaderboard / ?lb — combined wallet+bank with pagination
    // ────────────────────────────────────────────────────────────
    if (cmd === 'leaderboard' || cmd === 'lb' || cmd === 'bankleaderboard' || cmd === 'blb') {
        const page = 1;
        const pageSize = 10;
        const mode = (cmd === 'bankleaderboard' || cmd === 'blb') ? 'bank' : 'both';
        const users = await User.find({ guildId }).sort(mode === 'bank' ? { bank: -1 } : { balance: -1 });

        const buildEmbed = (users, page) => {
            const start = (page - 1) * pageSize;
            const slice = users.slice(start, start + pageSize);
            const totalPages = Math.ceil(users.length / pageSize);
            const medals = ['🥇', '🥈', '🥉'];
            const lines = slice.map((u, i) => {
                const pos = start + i;
                const prefix = medals[pos] || `**${pos + 1}.**`;
                if (mode === 'bank') return `${prefix} <@${u.userId}> — Bank: **$${fmt(u.bank)}**`;
                return `${prefix} <@${u.userId}> — Wallet: **$${fmt(u.balance)}** | Bank: **$${fmt(u.bank)}**`;
            });
            return new EmbedBuilder()
                .setTitle(mode === 'bank' ? 'Bank Leaderboard' : 'Leaderboard')
                .setDescription(lines.join('\n') || 'No data yet.')
                .setColor(0xFFD700)
                .setFooter({ text: `Page ${page}/${totalPages} • ${users.length} players` });
        };

        const totalPages = Math.ceil(users.length / pageSize);
        const embed = buildEmbed(users, page);
        const row = totalPages > 1 ? new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`lb_next_1_${mode}`).setLabel('Next Page →').setStyle(ButtonStyle.Secondary)
        ) : null;

        return message.reply({ embeds: [embed], components: row ? [row] : [] });
    }

    // ────────────────────────────────────────────────────────────
    // ?stocks
    // ────────────────────────────────────────────────────────────
    if (cmd === 'stocks') {
        const stocks = await Stock.find({ guildId }).sort({ ticker: 1 });
        if (!stocks.length) return message.reply('❌ No stocks set up yet. An admin can run `?setupmarket` to initialize the market.');
        const rows = stocks.map(s => {
            const prev = s.history.length >= 2 ? s.history[s.history.length - 2] : s.price;
            const change = s.price - prev;
            const pct = ((change / prev) * 100).toFixed(2);
            const arrow = change > 0 ? '▲' : change < 0 ? '▼' : '—';
            return `${arrow} \`${s.ticker.padEnd(4)}\` **${s.name}** — $${fmt(s.price)} (${change >= 0 ? '+' : ''}${pct}%)`;
        }).join('\n');
        return message.reply({ embeds: [new EmbedBuilder().setTitle('Stock Market').setDescription(rows).setColor(0x00FF99).setFooter({ text: 'Prices update every 30 minutes' }).setTimestamp()] });
    }

    // ────────────────────────────────────────────────────────────
    // ?buystock <TICKER> <shares|max>
    // ────────────────────────────────────────────────────────────
    if (cmd === 'buystock') {
        const ticker = args[0]?.toUpperCase();
        if (!ticker) return message.reply('❌ Usage: `?buystock <TICKER> <shares|max>`');
        const stock = await Stock.findOne({ guildId, ticker });
        if (!stock) return message.reply(`❌ Ticker \`${ticker}\` not found.`);
        const user = await User.findOne({ userId: message.author.id, guildId });
        if (!user) return message.reply('❌ You have no economy account.');

        // shares: integer only, or "max"
        let shares;
        if (!args[1] || args[1].toLowerCase() === 'max') {
            shares = Math.floor(user.balance / stock.price);
            if (shares <= 0) return message.reply(`❌ You can't afford even 1 share of \`${ticker}\` at $${fmt(stock.price)}.`);
        } else {
            shares = parseInt(args[1]);
            if (isNaN(shares) || shares <= 0) return message.reply('❌ Shares must be a whole number.');
        }

        const totalCost = parseFloat((stock.price * shares).toFixed(2));
        if (user.balance < totalCost) return message.reply(`❌ You need **$${fmt(totalCost)}** but only have **$${fmt(user.balance)}**.`);

        user.balance = parseFloat((user.balance - totalCost).toFixed(2));
        await user.save();

        let portfolio = await Portfolio.findOne({ userId: message.author.id, guildId });
        if (!portfolio) portfolio = new Portfolio({ userId: message.author.id, guildId, holdings: [] });
        const existing = portfolio.holdings.find(h => h.ticker === ticker);
        if (existing) {
            const totalShares = existing.shares + shares;
            existing.avgBuyPrice = parseFloat(((existing.avgBuyPrice * existing.shares + stock.price * shares) / totalShares).toFixed(2));
            existing.shares = totalShares;
        } else {
            portfolio.holdings.push({ ticker, shares, avgBuyPrice: stock.price });
        }
        await portfolio.save();

        const buyImpact = 1 + Math.min(shares / Math.max(stock.totalShares + shares, 10000), 0.1) * 0.5;
        stock.price = Math.min(parseFloat((stock.price * buyImpact).toFixed(2)), 999999);
        stock.totalShares += shares;
        await stock.save();

        return message.reply({ embeds: [new EmbedBuilder().setTitle('Stock Purchased').setColor(0x00FF99).addFields(
            { name: 'Stock', value: `${stock.name} (\`${ticker}\`)`, inline: true },
            { name: 'Shares', value: `${fmtInt(shares)}`, inline: true },
            { name: 'Price Per Share', value: `$${fmt(stock.price)}`, inline: true },
            { name: 'Total Cost', value: `$${fmt(totalCost)}`, inline: true },
            { name: 'Cash Remaining', value: `$${fmt(user.balance)}`, inline: true }
        ).setFooter({ text: 'Economic Bomb Stock Market' }).setTimestamp()] });
    }

    // ────────────────────────────────────────────────────────────
    // ?sellstock <TICKER> <shares|all>
    // ────────────────────────────────────────────────────────────
    if (cmd === 'sellstock') {
        const ticker = args[0]?.toUpperCase();
        if (!ticker) return message.reply('❌ Usage: `?sellstock <TICKER> <shares|all>`');
        const stock = await Stock.findOne({ guildId, ticker });
        if (!stock) return message.reply(`❌ Ticker \`${ticker}\` not found.`);
        const portfolio = await Portfolio.findOne({ userId: message.author.id, guildId });
        const holding = portfolio?.holdings.find(h => h.ticker === ticker);
        if (!holding || holding.shares <= 0) return message.reply(`❌ You don't hold any shares of \`${ticker}\`.`);

        let shares;
        if (!args[1] || args[1].toLowerCase() === 'all') {
            shares = holding.shares;
        } else {
            shares = parseInt(args[1]);
            if (isNaN(shares) || shares <= 0) return message.reply('❌ Shares must be a whole number.');
        }
        if (shares > holding.shares) return message.reply(`❌ You only have **${fmtInt(holding.shares)}** shares of \`${ticker}\`.`);

        const totalEarned = parseFloat((stock.price * shares).toFixed(2));
        const profit = parseFloat((totalEarned - holding.avgBuyPrice * shares).toFixed(2));

        holding.shares -= shares;
        if (holding.shares === 0) portfolio.holdings = portfolio.holdings.filter(h => h.ticker !== ticker);
        await portfolio.save();

        const user = await User.findOne({ userId: message.author.id, guildId });
        user.balance = parseFloat((user.balance + totalEarned).toFixed(2));
        await user.save();

        const sellImpact = Math.min(shares / Math.max(stock.totalShares, 10000), 0.1) * 0.5;
        const newPrice = Math.max(parseFloat((stock.price * (1 - sellImpact)).toFixed(2)), 0.01);
        stock.price = newPrice;
        stock.totalShares = Math.max(0, stock.totalShares - shares);
        await stock.save();

        return message.reply({ embeds: [new EmbedBuilder().setTitle('Stock Sold').setColor(profit >= 0 ? 0x00FF99 : 0xFF4500).addFields(
            { name: 'Stock', value: `${stock.name} (\`${ticker}\`)`, inline: true },
            { name: 'Shares Sold', value: `${fmtInt(shares)}`, inline: true },
            { name: 'Price Per Share', value: `$${fmt(stock.price)}`, inline: true },
            { name: 'Total Earned', value: `$${fmt(totalEarned)}`, inline: true },
            { name: 'Profit/Loss', value: `${profit >= 0 ? '+' : ''}$${fmt(profit)}`, inline: true },
            { name: 'New Cash Balance', value: `$${fmt(user.balance)}`, inline: true }
        ).setFooter({ text: 'Economic Bomb Stock Market' }).setTimestamp()] });
    }

    // ────────────────────────────────────────────────────────────
    // ?portfolio / ?port
    // ────────────────────────────────────────────────────────────
    if (cmd === 'portfolio' || cmd === 'port') {
        const portfolio = await Portfolio.findOne({ userId: message.author.id, guildId });
        if (!portfolio || !portfolio.holdings.length) return message.reply('📭 You have no stocks. Use `?buystock` to get started.');
        let totalValue = 0, totalCost = 0;
        const rows = [];
        for (const h of portfolio.holdings) {
            const stock = await Stock.findOne({ guildId, ticker: h.ticker });
            if (!stock) continue;
            const currentValue = stock.price * h.shares;
            const costBasis = h.avgBuyPrice * h.shares;
            const profit = currentValue - costBasis;
            totalValue += currentValue;
            totalCost += costBasis;
            const arrow = profit >= 0 ? '▲' : '▼';
            rows.push(`${arrow} \`${h.ticker}\` x${fmtInt(h.shares)} — $${fmt(currentValue)} (${profit >= 0 ? '+' : ''}$${fmt(profit)})`);
        }
        const totalProfit = totalValue - totalCost;
        return message.reply({ embeds: [new EmbedBuilder().setTitle(`${message.author.username}'s Portfolio`).setDescription(rows.join('\n')).setColor(totalProfit >= 0 ? 0x00FF99 : 0xFF4500).addFields(
            { name: 'Total Value', value: `$${fmt(totalValue)}`, inline: true },
            { name: 'Total Profit/Loss', value: `${totalProfit >= 0 ? '+' : ''}$${fmt(totalProfit)}`, inline: true }
        ).setFooter({ text: 'Economic Bomb Stock Market' }).setTimestamp()] });
    }

    // ────────────────────────────────────────────────────────────
    // ?stockhistory / ?sh
    // ────────────────────────────────────────────────────────────
    if (cmd === 'stockhistory' || cmd === 'sh') {
        const ticker = args[0]?.toUpperCase();
        if (!ticker) return message.reply('❌ Usage: `?stockhistory <TICKER>`');
        const stock = await Stock.findOne({ guildId, ticker });
        if (!stock) return message.reply(`❌ Ticker \`${ticker}\` not found.`);
        const history = stock.history.slice(-10);
        const chart = history.map((p, i) => {
            const prev = history[i - 1] ?? p;
            const arrow = p > prev ? '▲' : p < prev ? '▼' : '—';
            return `${arrow} $${fmt(p)}`;
        }).join('\n');
        const first = history[0], last = history[history.length - 1];
        const overallChange = last - first;
        const overallPct = ((overallChange / first) * 100).toFixed(2);
        return message.reply({ embeds: [new EmbedBuilder().setTitle(`${stock.name} (\`${ticker}\`) — Price History`).setDescription(chart || 'No history yet.').setColor(overallChange >= 0 ? 0x00FF99 : 0xFF4500).addFields(
            { name: 'Current Price', value: `$${fmt(stock.price)}`, inline: true },
            { name: 'Overall Change', value: `${overallChange >= 0 ? '+' : ''}${overallPct}%`, inline: true }
        ).setFooter({ text: 'Last 10 price points' }).setTimestamp()] });
    }

    // ────────────────────────────────────────────────────────────
    // ?buy @user — slave purchase
    // ────────────────────────────────────────────────────────────
    if (cmd === 'buy') {
        const target = message.mentions.users.first();
        if (!target) return message.reply('❌ Usage: `?buy @user`');
        if (target.id === message.author.id) return message.reply("❌ You can't buy yourself.");
        if (target.bot) return message.reply("❌ You can't buy a bot.");
        const buyer = await getUser(message.author.id, guildId);
        const targetEcon = await getUser(target.id, guildId);
        const existingSlave = await Slave.findOne({ userId: target.id, guildId });
        if (existingSlave?.ownerId) return message.reply(`❌ <@${target.id}> is already owned by <@${existingSlave.ownerId}>.`);
        const buyPrice = parseFloat((targetEcon.balance * 2).toFixed(2));
        if (buyPrice <= 0) return message.reply('❌ This person has no balance to determine a price.');
        if (buyer.balance < buyPrice) return message.reply(`❌ You need **$${fmt(buyPrice)}** to buy <@${target.id}> but only have **$${fmt(buyer.balance)}**.`);

        await message.channel.send({ embeds: [new EmbedBuilder().setTitle('Auction Started!').setDescription(`<@${message.author.id}> wants to buy <@${target.id}> for **$${fmt(buyPrice)}**!\n\n<@${target.id}> you have **2 minutes** to escape by typing \`?outbid <amount>\` with more than **$${fmt(buyPrice)}**.`).setColor(0xFF4500).setTimestamp()] });

        const collector = message.channel.createMessageCollector({ filter: m => m.author.id === target.id && m.content.toLowerCase().startsWith('?outbid'), time: 120000, max: 1 });
        collector.on('collect', async m => {
            const outbidAmount = parseFloat(m.content.split(/\s+/)[1]);
            if (!outbidAmount || outbidAmount <= buyPrice) return m.reply(`❌ You need to outbid more than **$${fmt(buyPrice)}**.`);
            const fresh = await getUser(target.id, guildId);
            if (fresh.balance < outbidAmount) return m.reply(`❌ You don't have **$${fmt(outbidAmount)}** to outbid.`);
            collector.stop('outbid');
            return m.reply({ embeds: [new EmbedBuilder().setTitle('Purchase Blocked!').setDescription(`<@${target.id}> outbid with **$${fmt(outbidAmount)}** and avoided being bought!`).setColor(0x00FF99)] });
        });
        collector.on('end', async (_, reason) => {
            if (reason === 'outbid') return;
            const freshBuyer = await getUser(message.author.id, guildId);
            freshBuyer.balance = parseFloat((freshBuyer.balance - buyPrice).toFixed(2));
            await freshBuyer.save();
            let slave = await Slave.findOne({ userId: target.id, guildId });
            if (!slave) slave = new Slave({ userId: target.id, guildId });
            slave.ownerId = message.author.id;
            slave.debt = parseFloat((buyPrice * 2).toFixed(2));
            slave.totalEarned = 0;
            await slave.save();
            await message.channel.send({ embeds: [new EmbedBuilder().setTitle('Purchase Complete!').setDescription(`<@${message.author.id}> has bought <@${target.id}> for **$${fmt(buyPrice)}**!\n\n<@${target.id}> must earn **$${fmt(buyPrice * 2)}** to be free.`).setColor(0xFF0000).setTimestamp()] });
            try { await target.send({ embeds: [new EmbedBuilder().setTitle('You Have Been Bought!').setDescription(`<@${message.author.id}> purchased you for **$${fmt(buyPrice)}**. You must earn **$${fmt(buyPrice * 2)}** to be free.`).setColor(0xFF0000)] }); } catch {}
        });
    }

    // ────────────────────────────────────────────────────────────
    // ?slave
    // ────────────────────────────────────────────────────────────
    if (cmd === 'slave') {
        const slave = await Slave.findOne({ userId: message.author.id, guildId });
        if (!slave?.ownerId) return message.reply('✅ You are a free person.');
        return message.reply({ embeds: [new EmbedBuilder().setTitle('Your Slave Status').setDescription(`You are owned by <@${slave.ownerId}>`).addFields(
            { name: 'Debt Remaining', value: `$${fmt(slave.debt)}`, inline: true },
            { name: 'Total Earned for Owner', value: `$${fmt(slave.totalEarned)}`, inline: true }
        ).setColor(0xFF0000).setFooter({ text: 'Keep working to pay off your debt!' }).setTimestamp()] });
    }

    // ────────────────────────────────────────────────────────────
    // ?slavepanel
    // ────────────────────────────────────────────────────────────
    if (cmd === 'slavepanel') {
        const slaves = await Slave.find({ ownerId: message.author.id, guildId });
        if (!slaves.length) return message.reply("❌ You don't own anyone.");
        for (const slave of slaves) {
            const slaveEcon = await getUser(slave.userId, guildId);
            const embed = new EmbedBuilder().setTitle(`Slave: <@${slave.userId}>`).addFields(
                { name: 'Debt Remaining', value: `$${fmt(slave.debt)}`, inline: true },
                { name: 'Total Earned for You', value: `$${fmt(slave.totalEarned)}`, inline: true },
                { name: 'Their Current Balance', value: `$${fmt(slaveEcon.balance)}`, inline: true }
            ).setColor(0xFF4500).setTimestamp();
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`slave_free_${slave.userId}`).setLabel('Set Free').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`slave_renew_${slave.userId}`).setLabel('Renew (Double Debt)').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId(`slave_check_${slave.userId}`).setLabel('Refresh Stats').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`slave_takepay_${slave.userId}`).setLabel('Take Payment').setStyle(ButtonStyle.Primary)
            );
            await message.channel.send({ embeds: [embed], components: [row] });
        }
    }

    // ────────────────────────────────────────────────────────────
    // ?daily
    // ────────────────────────────────────────────────────────────
    if (cmd === 'daily') {
        const user = await getUser(message.author.id, guildId);
        const COOLDOWN = 24 * 60 * 60 * 1000;
        if (user.lastDaily && now - user.lastDaily < COOLDOWN) {
            const left = COOLDOWN - (now - user.lastDaily);
            const h = Math.floor(left / 3600000);
            const m = Math.floor((left % 3600000) / 60000);
            const s = Math.floor((left % 60000) / 1000);
            return message.reply({ embeds: [new EmbedBuilder().setTitle('Daily Already Claimed').setDescription(`Come back in **${h}h ${m}m ${s}s**.`).setColor(0x2b2d31)] });
        }
        const streak = user.dailyStreak && user.lastDaily && (now - user.lastDaily < 48 * 60 * 60 * 1000) ? user.dailyStreak + 1 : 1;
        const amount = 200 + Math.min(streak - 1, 30) * 25;
        user.lastDaily = now;
        user.dailyStreak = streak;
        user.balance = parseFloat((user.balance + amount).toFixed(2));
        await user.save();
        return message.reply({ embeds: [new EmbedBuilder().setTitle('Daily Reward').setDescription(`You claimed your daily reward!`).addFields(
            { name: 'Amount', value: `$${fmtInt(amount)}`, inline: true },
            { name: 'Streak', value: `${streak} day${streak !== 1 ? 's' : ''}`, inline: true },
            { name: 'New Balance', value: `$${fmt(user.balance)}`, inline: true }
        ).setColor(0xFFD700).setFooter({ text: streak >= 7 ? 'Hot streak! Keep it going!' : 'Come back tomorrow for a streak bonus!' })] });
    }

    // ────────────────────────────────────────────────────────────
    // ?setupmarket — admin re-seeds market
    // ────────────────────────────────────────────────────────────
    if (cmd === 'setupmarket') {
        if (!isAdmin(message.member)) return message.reply('❌ You need Administrator permission.');
        await seedMarket(guildId);
        return message.reply({ embeds: [new EmbedBuilder().setTitle('Market Initialized').setDescription(`Successfully seeded **${COMPANIES.length} stocks** for this server.\nUse \`?stocks\` to view the market.`).setColor(0x00FF99).setTimestamp()] });
    }

    // ────────────────────────────────────────────────────────────
    // ?slavelist
    // ────────────────────────────────────────────────────────────
    if (cmd === 'slavelist') {
        const slaves = await Slave.find({ guildId, ownerId: { $ne: null } });
        if (!slaves.length) return message.reply('No active slaves in this server.');
        const ownerMap = {};
        for (const s of slaves) ownerMap[s.ownerId] = (ownerMap[s.ownerId] || 0) + 1;
        const sorted = Object.entries(ownerMap).sort((a, b) => b[1] - a[1]);
        const lines = sorted.map(([ ownerId, count ], i) => `**${i+1}.** <@${ownerId}> — ${count} slave${count !== 1 ? 's' : ''}`);
        return message.reply({ embeds: [new EmbedBuilder().setTitle('Slave Leaderboard').setDescription(lines.join('\n')).setColor(0xFF4500)] });
    }

    // ────────────────────────────────────────────────────────────
    // OWNER / ADMIN COMMANDS
    // ────────────────────────────────────────────────────────────
    if (cmd === 'ogive') {
        if (!isAdmin(message.member)) return;
        const targetId = message.mentions.users.first()?.id;
        const amount = parseFloat(args[1]);
        if (!targetId || isNaN(amount)) return message.reply('❌ Usage: `?ogive @user <amount>`');
        const user = await getUser(targetId, guildId);
        user.balance = parseFloat((user.balance + amount).toFixed(2));
        await user.save();
        return message.reply(`✅ Gave **$${fmt(amount)}** to <@${targetId}>`);
    }

    if (cmd === 'osetbalance' || cmd === 'osetbal') {
        if (!isAdmin(message.member)) return;
        const targetId = message.mentions.users.first()?.id;
        const amount = parseFloat(args[1]);
        if (!targetId || isNaN(amount)) return message.reply('❌ Usage: `?osetbalance @user <amount>`');
        const user = await getUser(targetId, guildId);
        user.balance = amount;
        await user.save();
        return message.reply(`✅ Set <@${targetId}>'s wallet to **$${fmt(amount)}**`);
    }

    if (cmd === 'osetbank') {
        if (!isAdmin(message.member)) return;
        const targetId = message.mentions.users.first()?.id;
        const amount = parseFloat(args[1]);
        if (!targetId || isNaN(amount)) return message.reply('❌ Usage: `?osetbank @user <amount>`');
        const user = await getUser(targetId, guildId);
        user.bank = amount;
        await user.save();
        return message.reply(`✅ Set <@${targetId}>'s bank to **$${fmt(amount)}**`);
    }

    if (cmd === 'ostockfix') {
        if (!isAdmin(message.member)) return;
        const stocks = await Stock.find({ guildId });
        if (!stocks.length) return message.reply('❌ No stocks found. Run `?setupmarket` first.');
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
            results.push(`${diff >= 0 ? '▲' : '▼'} \`${stock.ticker}\` $${fmt(oldPrice)} → $${fmt(newPrice)} (${diff >= 0 ? '+' : ''}${pct}%)`);
        }
        return message.reply({ embeds: [new EmbedBuilder().setTitle('Stock Market Manually Ticked').setDescription(results.join('\n')).setColor(0x00FF99).setFooter({ text: 'Same logic as the 30-minute auto tick' }).setTimestamp()] });
    }

    if (cmd === 'oremovestock') {
        if (!isAdmin(message.member)) return;
        const targetId = message.mentions.users.first()?.id;
        const ticker = args[1]?.toUpperCase();
        if (!targetId || !ticker) return message.reply('❌ Usage: `?oremovestock @user <TICKER>`');
        const portfolio = await Portfolio.findOne({ userId: targetId, guildId });
        if (!portfolio) return message.reply('❌ User has no portfolio.');
        const before = portfolio.holdings.length;
        portfolio.holdings = portfolio.holdings.filter(h => h.ticker !== ticker);
        if (portfolio.holdings.length === before) return message.reply(`❌ <@${targetId}> doesn't hold \`${ticker}\`.`);
        await portfolio.save();
        return message.reply(`✅ Removed all \`${ticker}\` shares from <@${targetId}>'s portfolio.`);
    }

    if (cmd === 'oresetleaderboard' || cmd === 'oreset') {
        if (!isAdmin(message.member)) return;
        await User.updateMany({ guildId }, { balance: 0, bank: 0 });
        return message.reply('✅ Economy reset for this server.');
    }

    if (cmd === 'oeconomystats' || cmd === 'ostats') {
        if (!isAdmin(message.member)) return;
        const users = await User.find({ guildId });
        const totalMoney = users.reduce((a, b) => a + b.balance + b.bank, 0);
        const richest = [...users].sort((a, b) => (b.balance + b.bank) - (a.balance + a.bank))[0];
        return message.reply({ embeds: [new EmbedBuilder().setTitle('Economy Stats').addFields(
            { name: 'Total Players', value: `${users.length}`, inline: true },
            { name: 'Total Money', value: `$${fmt(totalMoney)}`, inline: true },
            { name: 'Richest', value: richest ? `<@${richest.userId}> ($${fmt(richest.balance + richest.bank)})` : 'None', inline: true }
        ).setColor(0x2b2d31)] });
    }

    if (cmd === 'ouserinfo') {
        if (!isAdmin(message.member)) return;
        const targetId = message.mentions.users.first()?.id;
        if (!targetId) return message.reply('❌ Usage: `?ouserinfo @user`');
        const user = await getUser(targetId, guildId);
        return message.reply({ embeds: [new EmbedBuilder().setTitle('User Info').addFields(
            { name: 'Wallet', value: `$${fmt(user.balance)}`, inline: true },
            { name: 'Bank', value: `$${fmt(user.bank)}`, inline: true }
        ).setColor(0x2b2d31)] });
    }

    if (cmd === 'ojackpotdrop') {
        if (!isAdmin(message.member)) return;
        const amount = parseFloat(args[0]);
        if (isNaN(amount)) return message.reply('❌ Usage: `?ojackpotdrop <amount>`');
        const users = await User.find({ guildId });
        if (!users.length) return message.reply('No users found.');
        const winner = users[Math.floor(Math.random() * users.length)];
        winner.balance = parseFloat((winner.balance + amount).toFixed(2));
        await winner.save();
        return message.reply({ embeds: [new EmbedBuilder().setTitle('Jackpot Drop').setDescription(`<@${winner.userId}> won **$${fmt(amount)}**!`).setColor(0x00ff00)] });
    }

    if (cmd === 'clearcooldowns') {
        if (!isAdmin(message.member)) return;
        workCooldowns.clear(); coinflipCooldowns.clear(); diceCooldowns.clear(); slotsCooldowns.clear(); robCooldowns.clear();
        return message.reply('✅ All cooldowns cleared.');
    }

    // ────────────────────────────────────────────────────────────
    // ?help — hides owner commands from non-admins
    // ────────────────────────────────────────────────────────────
    if (cmd === 'help') {
        const admin = isAdmin(message.member);
        const embed = new EmbedBuilder()
            .setTitle('Economic Bomb — Commands')
            .setColor(0x2b2d31)
            .addFields(
                { name: 'Economy', value: '`?balance` `?deposit <amount|all>` `?withdraw <amount|all>` `?givemoney @user <amount>` `?work` `?daily`', inline: false },
                { name: 'Gambling', value: '`?coinflip <bet> <h|t>` `?dice <bet>` `?slots <bet>` `?rob @user` `?duel @user [bet|all]`', inline: false },
                { name: 'Stocks', value: '`?stocks` `?buystock <TICKER> <shares|max>` `?sellstock <TICKER> <shares|all>` `?portfolio` `?stockhistory <TICKER>`', inline: false },
                { name: 'Leaderboard', value: '`?leaderboard` `?bankleaderboard`', inline: false },
                { name: 'Slave System', value: '`?buy @user` `?slave` `?slavepanel` `?slavelist`', inline: false }
            )
            .setFooter({ text: 'Economic Bomb' });

        if (admin) {
            embed.addFields({ name: 'Admin Only', value: '`?ogive` `?osetbalance` `?osetbank` `?oresetleaderboard` `?oeconomystats` `?ouserinfo` `?ojackpotdrop` `?clearcooldowns` `?setupmarket` `?ostockfix` `?oremovestock`', inline: false });
        }

        return message.reply({ embeds: [embed] });
    }
});

// ── Interaction handler ────────────────────────────────────────────
client.on('interactionCreate', async interaction => {

    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (command) await command.execute(interaction);
    }

    if (interaction.isButton()) {
        const guildId = interaction.guild.id;

        // Leaderboard pagination
        if (interaction.customId.startsWith('lb_')) {
            const parts = interaction.customId.split('_');
            const currentPage = parseInt(parts[2]);
            const mode = parts[3];
            const newPage = currentPage + 1;
            const pageSize = 10;
            const users = await User.find({ guildId }).sort(mode === 'bank' ? { bank: -1 } : { balance: -1 });
            const totalPages = Math.ceil(users.length / pageSize);
            if (newPage > totalPages) return interaction.reply({ content: "You're on the last page.", ephemeral: true });
            const start = (newPage - 1) * pageSize;
            const slice = users.slice(start, start + pageSize);
            const medals = ['🥇', '🥈', '🥉'];
            const lines = slice.map((u, i) => {
                const pos = start + i;
                const prefix = medals[pos] || `**${pos + 1}.**`;
                if (mode === 'bank') return `${prefix} <@${u.userId}> — Bank: **$${fmt(u.bank)}**`;
                return `${prefix} <@${u.userId}> — Wallet: **$${fmt(u.balance)}** | Bank: **$${fmt(u.bank)}**`;
            });
            const embed = new EmbedBuilder().setTitle(mode === 'bank' ? 'Bank Leaderboard' : 'Leaderboard').setDescription(lines.join('\n')).setColor(0xFFD700).setFooter({ text: `Page ${newPage}/${totalPages} • ${users.length} players` });
            const row = newPage < totalPages ? new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`lb_next_${newPage}_${mode}`).setLabel('Next Page →').setStyle(ButtonStyle.Secondary)) : null;
            return interaction.reply({ embeds: [embed], components: row ? [row] : [] });
        }

        if (interaction.customId.startsWith('slave_free_')) {
            const targetId = interaction.customId.split('_')[2];
            const slave = await Slave.findOne({ userId: targetId, guildId });
            if (!slave || slave.ownerId !== interaction.user.id) return interaction.reply({ content: '❌ Not your slave.', ephemeral: true });
            slave.ownerId = null; slave.debt = 0; slave.totalEarned = 0;
            await slave.save();
            await interaction.reply({ embeds: [new EmbedBuilder().setTitle('Slave Freed').setDescription(`<@${targetId}> has been set free.`).setColor(0x00FF99)] });
            try { const u = await client.users.fetch(targetId); await u.send({ embeds: [new EmbedBuilder().setTitle('You Are Free!').setDescription(`<@${interaction.user.id}> has set you free.`).setColor(0x00FF99)] }); } catch {}
        }

        if (interaction.customId.startsWith('slave_renew_')) {
            const targetId = interaction.customId.split('_')[2];
            const slave = await Slave.findOne({ userId: targetId, guildId });
            if (!slave || slave.ownerId !== interaction.user.id) return interaction.reply({ content: '❌ Not your slave.', ephemeral: true });
            const renewCost = parseFloat((slave.debt / 2).toFixed(2));
            const owner = await getUser(interaction.user.id, guildId);
            if (owner.balance < renewCost) return interaction.reply({ content: `❌ You need **$${fmt(renewCost)}** to renew but only have **$${fmt(owner.balance)}**.`, ephemeral: true });
            owner.balance = parseFloat((owner.balance - renewCost).toFixed(2));
            await owner.save();
            const oldDebt = slave.debt;
            slave.debt = parseFloat((slave.debt * 2).toFixed(2));
            await slave.save();
            await interaction.reply({ embeds: [new EmbedBuilder().setTitle('Debt Renewed').setDescription(`You paid **$${fmt(renewCost)}** to renew <@${targetId}>'s contract.\nDebt: **$${fmt(oldDebt)}** → **$${fmt(slave.debt)}**`).setColor(0xFF4500)] });
            try { const u = await client.users.fetch(targetId); await u.send({ embeds: [new EmbedBuilder().setTitle('Your Debt Has Been Renewed!').setDescription(`Your debt has doubled to **$${fmt(slave.debt)}**.`).setColor(0xFF4500)] }); } catch {}
        }

        if (interaction.customId.startsWith('slave_check_')) {
            const targetId = interaction.customId.split('_')[2];
            const slave = await Slave.findOne({ userId: targetId, guildId });
            if (!slave || slave.ownerId !== interaction.user.id) return interaction.reply({ content: '❌ Not your slave.', ephemeral: true });
            const slaveEcon = await getUser(targetId, guildId);
            await interaction.reply({ ephemeral: true, embeds: [new EmbedBuilder().setTitle(`Stats for <@${targetId}>`).addFields(
                { name: 'Debt Remaining', value: `$${fmt(slave.debt)}`, inline: true },
                { name: 'Total Earned for You', value: `$${fmt(slave.totalEarned)}`, inline: true },
                { name: 'Their Balance', value: `$${fmt(slaveEcon.balance)}`, inline: true }
            ).setColor(0x2b2d31).setTimestamp()] });
        }

        if (interaction.customId.startsWith('slave_takepay_')) {
            const targetId = interaction.customId.split('_')[2];
            const slave = await Slave.findOne({ userId: targetId, guildId });
            if (!slave || slave.ownerId !== interaction.user.id) return interaction.reply({ content: '❌ Not your slave.', ephemeral: true });
            const modal = new ModalBuilder().setCustomId(`takepay_modal_${targetId}`).setTitle('Take Payment from Slave');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('takepay_amount').setLabel(`Amount to take (Debt: $${fmt(slave.debt)})`).setStyle(TextInputStyle.Short).setPlaceholder('e.g. 500').setRequired(true)));
            return interaction.showModal(modal);
        }

        if (interaction.customId === 'open_order_modal') {
            const modal = new ModalBuilder().setCustomId('order_modal').setTitle('Order Form');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('website_ip').setLabel('Website IP').setStyle(TextInputStyle.Short)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('website_name').setLabel('Website Name').setStyle(TextInputStyle.Short)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('filters').setLabel('Filter Links').setStyle(TextInputStyle.Paragraph))
            );
            return interaction.showModal(modal);
        }

        if (interaction.customId.startsWith('respond_')) {
            const userId = interaction.customId.split('_')[1];
            const modal = new ModalBuilder().setCustomId(`response_modal_${userId}`).setTitle('Send Links');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('links').setLabel('Insert Links here').setStyle(TextInputStyle.Paragraph)));
            return interaction.showModal(modal);
        }
    }

    if (interaction.isModalSubmit()) {
        const guildId = interaction.guild.id;

        if (interaction.customId.startsWith('takepay_modal_')) {
            const targetId = interaction.customId.split('_')[2];
            const amount = parseFloat(interaction.fields.getTextInputValue('takepay_amount'));
            if (!amount || isNaN(amount) || amount <= 0) return interaction.reply({ content: '❌ Invalid amount.', ephemeral: true });
            const slave = await Slave.findOne({ userId: targetId, guildId });
            if (!slave || slave.ownerId !== interaction.user.id) return interaction.reply({ content: '❌ Not your slave.', ephemeral: true });
            const slaveUser = await getUser(targetId, guildId);
            if (slaveUser.balance < amount) return interaction.reply({ content: `❌ <@${targetId}> only has **$${fmt(slaveUser.balance)}** in their wallet.`, ephemeral: true });
            const taken = parseFloat(Math.min(amount, slave.debt).toFixed(2));
            slaveUser.balance = parseFloat((slaveUser.balance - taken).toFixed(2));
            await slaveUser.save();
            slave.debt = parseFloat((slave.debt - taken).toFixed(2));
            if (slave.debt <= 0) {
                slave.ownerId = null; slave.debt = 0;
                await slave.save();
                await interaction.reply({ embeds: [new EmbedBuilder().setTitle('Debt Fully Paid!').setDescription(`Took **$${fmt(taken)}** from <@${targetId}>'s wallet — debt cleared, they are free.`).setColor(0x00FF99)] });
                try { const u = await client.users.fetch(targetId); await u.send({ embeds: [new EmbedBuilder().setTitle('You Are Free!').setDescription(`Your remaining debt was paid. You are now free.`).setColor(0x00FF99)] }); } catch {}
            } else {
                await slave.save();
                await interaction.reply({ embeds: [new EmbedBuilder().setTitle('Payment Taken').setDescription(`Took **$${fmt(taken)}** from <@${targetId}>'s wallet.`).addFields(
                    { name: 'Debt Remaining', value: `$${fmt(slave.debt)}`, inline: true },
                    { name: 'Their Remaining Balance', value: `$${fmt(slaveUser.balance)}`, inline: true }
                ).setColor(0xFF4500)] });
                try { const u = await client.users.fetch(targetId); await u.send({ embeds: [new EmbedBuilder().setTitle('Payment Taken').setDescription(`**$${fmt(taken)}** was taken from your wallet toward your debt.\nDebt remaining: **$${fmt(slave.debt)}**`).setColor(0xFF4500)] }); } catch {}
            }
        }

        if (interaction.customId === 'order_modal') {
            const ip = interaction.fields.getTextInputValue('website_ip');
            const name = interaction.fields.getTextInputValue('website_name');
            const filters = interaction.fields.getTextInputValue('filters');
            const userId = interaction.user.id;
            await interaction.user.send('Your order has been received. You will get your links soon.');
            await fetch(process.env.WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ embeds: [{ title: 'New Order', fields: [{ name: 'User', value: `<@${userId}>` }, { name: 'Website IP', value: ip }, { name: 'Website Name', value: name }, { name: 'Filters', value: filters }], color: 0x2b2d31 }], components: [{ type: 1, components: [{ type: 2, label: 'Send Links', style: 1, custom_id: `respond_${userId}` }] }] }) });
            return interaction.reply({ content: 'Order submitted! Check your DMs.', ephemeral: true });
        }

        if (interaction.customId.startsWith('response_modal_')) {
            const userId = interaction.customId.split('_')[2];
            const links = interaction.fields.getTextInputValue('links');
            try { const u = await client.users.fetch(userId); await u.send(`Your Order is Ready!\n\n${links}`); return interaction.reply({ content: 'Links sent to user.', ephemeral: true }); }
            catch { return interaction.reply({ content: 'Failed to DM user.', ephemeral: true }); }
        }
    }
});

client.login(process.env.TOKEN);
