require('dotenv').config();

const {
    Client, Collection, GatewayIntentBits,
    ModalBuilder, TextInputBuilder, TextInputStyle,
    ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle,
    REST, Routes
} = require('discord.js');

const fs = require('fs');
const fetch = require('node-fetch');
const mongoose = require('mongoose');
const Stock = require('./models/Stock');
const Slave = require('./models/Slave');
const Lottery = require('./models/Lottery');
const { getUser } = require('./src/utils/economy');
const { seedMarket, COMPANIES } = require('./src/utils/market');
const { drawLottery } = require('./src/utils/lottery');
const Config = require('./models/Config');

const PREFIX = '?';
const OWNER_ID = '1453078748080504996';
const isAdmin = (member) => member.permissions.has('Administrator') || member.id === OWNER_ID;

const { formatNumber } = require('./src/utils/format');

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

function loadCommands() {
    client.commands.clear();
    for (const file of fs.readdirSync('./src/commands').filter(f => f.endsWith('.js'))) {
        try {
            delete require.cache[require.resolve(`./src/commands/${file}`)];
            const command = require(`./src/commands/${file}`);
            client.commands.set(command.data.name, command);
        } catch (e) {
            console.error(`Failed to load ${file}:`, e.message);
        }
    }
}

async function deployCommands() {
    const commands = [];
    for (const file of fs.readdirSync('./src/commands').filter(f => f.endsWith('.js'))) {
        try {
            delete require.cache[require.resolve(`./src/commands/${file}`)];
            const cmd = require(`./src/commands/${file}`);
            if (cmd?.data?.toJSON) commands.push(cmd.data.toJSON());
        } catch (e) {
            console.error(`Failed to read ${file}:`, e.message);
        }
    }
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log(`Deployed ${commands.length} slash commands.`);
}

loadCommands();

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

    setInterval(async () => {
        const overdue = await Lottery.find({ drawAt: { $lte: new Date() } });
        for (const lottery of overdue) await drawLottery(client, lottery);
    }, 60 * 1000);
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
            `The stock market has been automatically set up with **${COMPANIES.length} companies**.\n\n` +
            `**Getting started:**\n` +
            `> \`/help\` - view all commands\n` +
            `> \`/stock list\` - view the stock market\n` +
            `> \`/work\` - start earning money\n` +
            `> \`/daily\` - claim your daily reward`
        )
        .setColor(0xFFD700)
        .setFooter({ text: 'Economic Bomb' });

    try {
        const ch = guild.systemChannel ?? guild.channels.cache
            .filter(c => c.type === 0 && c.permissionsFor(guild.members.me)?.has('SendMessages'))
            .sort((a, b) => a.position - b.position).first();
        if (ch) await ch.send({ embeds: [welcomeEmbed] });
    } catch { }
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const cmd = args.shift().toLowerCase();
    const guildId = message.guild.id;

    const config = await Config.findOne({ guildId }) || {};
    const modules = config.modules || {};
    const bannedUsers = config.bannedUsers || [];
    const allowedChannels = config.allowedChannels || [];

    if (allowedChannels.length > 0 && !allowedChannels.includes(message.channel.id)) return;

    const banEntry = bannedUsers.find(b => b.userId === message.author.id);
    if (banEntry) {
        return message.reply({
            embeds: [new EmbedBuilder()
                .setTitle('🔨 You Are Banned')
                .setDescription(`You have been banned from using this bot.\n**Reason:** ${banEntry.reason || 'No reason given'}`)
                .setColor(0xff0000)]
        });
    }

    // MODULE_MAP: category keys map to arrays of commands they cover.
    // Individual command keys (same as cmd name) can also be toggled directly.
    const MODULE_MAP = {
        // Categories
        economy:     ['balance', 'bal', 'daily', 'weekly'],
        work:        ['work'],
        rob:         ['rob'],
        coinflip:    ['coinflip', 'cf'],
        dice:        ['dice'],
        slots:       ['slots'],
        duel:        ['duel'],
        stocks:      ['stocks', 'stock', 'buystock', 'sellstock', 'portfolio', 'port', 'stockhistory', 'sh', 'setupmarket', 'ostockfix'],
        slave:       ['buy', 'outbid', 'slave', 'slavepanel', 'slavelist'],
        givemoney:   ['givemoney', 'give'],
        deposit:     ['deposit', 'dep'],
        withdraw:    ['withdraw', 'with'],
        leaderboard: ['leaderboard', 'lb', 'bankleaderboard', 'blb', 'gleaderboard', 'glb', 'gbankleaderboard', 'gblb'],
        // Individual command overrides (cmd name = module key)
        balance:      ['balance', 'bal'],
        daily:        ['daily'],
        weekly:       ['weekly'],
        buystock:     ['buystock'],
        sellstock:    ['sellstock'],
        portfolio:    ['portfolio', 'port'],
        stockhistory: ['stockhistory', 'sh'],
        slavepanel:   ['slavepanel'],
        slavelist:    ['slavelist'],
        outbid:       ['outbid'],
    };
    // Check both category and individual command disable
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

    const adapt = (opts = {}) => ({
        user: message.author,
        guild: message.guild,
        member: message.member,
        channel: message.channel,
        client,
        options: {
            getUser: n => opts.getUser?.(n) ?? null,
            getInteger: n => opts.getInteger?.(n) ?? null,
            getString: n => opts.getString?.(n) ?? null,
            getNumber: n => opts.getNumber?.(n) ?? null,
            getSubcommand: () => opts.getSubcommand?.() ?? null,
        },
        reply: d => message.reply(d),
        followUp: d => message.channel.send(d),
    });

    const run = (name, opts) => client.commands.get(name).execute(adapt(opts));

    if (cmd === 'bank') {
        const sub = args.shift()?.toLowerCase();
        if (sub === 'deposit') return run('bank', { getSubcommand: () => 'deposit', getString: n => n === 'amount' ? args[0] : null });
        if (sub === 'withdraw') return run('bank', { getSubcommand: () => 'withdraw', getString: n => n === 'amount' ? args[0] : null });
        return run('bank', { getSubcommand: () => 'balance', getUser: n => n === 'user' ? message.mentions.users.first() : null });
    }

    if (cmd === 'balance' || cmd === 'bal')
        return run('bank', { getSubcommand: () => 'balance', getUser: n => n === 'user' ? message.mentions.users.first() : null });

    if (cmd === 'deposit' || cmd === 'dep')
        return run('bank', { getSubcommand: () => 'deposit', getString: n => n === 'amount' ? args[0] : null });

    if (cmd === 'withdraw' || cmd === 'with')
        return run('bank', { getSubcommand: () => 'withdraw', getString: n => n === 'amount' ? args[0] : null });

    if (cmd === 'work') return run('work', {});
    if (cmd === 'daily') return run('daily', {});

    if (cmd === 'givemoney' || cmd === 'give') {
        const giveTarget = message.mentions.users.first();
        if (giveTarget && giveTarget.id === message.author.id) {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('Nice try')
                    .setDescription("You can't give money to yourself.")
                    .setColor(0xff0000)]
            });
        }
        return run('give', {
            getUser: n => n === 'user' ? giveTarget : null,
            getInteger: n => n === 'amount' ? parseInt(args[1]) : null,
        });
    }

    if (cmd === 'coinflip' || cmd === 'cf') return run('gamble', { getString: n => n === 'game' ? 'coinflip' : null, getInteger: n => n === 'bet' ? parseFloat(args[0]) : null });
    if (cmd === 'dice') return run('gamble', { getString: n => n === 'game' ? 'dice' : null, getInteger: n => n === 'bet' ? parseFloat(args[0]) : null });
    if (cmd === 'slots') return run('gamble', { getString: n => n === 'game' ? 'slots' : null, getInteger: n => n === 'bet' ? parseFloat(args[0]) : null });
    if (cmd === 'roulette') return run('gamble', { getString: n => n === 'game' ? 'roulette' : null, getInteger: n => n === 'bet' ? parseFloat(args[0]) : null });
    if (cmd === 'blackjack' || cmd === 'bj') return run('gamble', { getString: n => n === 'game' ? 'blackjack' : null, getInteger: n => n === 'bet' ? parseFloat(args[0]) : null });
    if (cmd === 'highlow' || cmd === 'hl') return run('gamble', { getString: n => n === 'game' ? 'highlow' : null, getInteger: n => n === 'bet' ? parseFloat(args[0]) : null });

    if (cmd === 'rob')
        return run('rob', { getUser: n => n === 'target' ? message.mentions.users.first() : null });

    if (cmd === 'duel')
        return run('duel', {
            getUser: n => n === 'opponent' ? message.mentions.users.first() : null,
            getString: n => n === 'bet' ? args[1] : null,
        });

    if (cmd === 'leaderboard' || cmd === 'lb') {
        const loc = ['bank', 'wallet', 'gambling', 'global', 'global-bank'].includes(args[0]?.toLowerCase()) ? args[0].toLowerCase() : 'both';
        return run('leaderboard', { getString: n => n === 'location' ? loc : null });
    }
    if (cmd === 'bankleaderboard' || cmd === 'blb')
        return run('leaderboard', { getString: n => n === 'location' ? 'bank' : null });
    if (cmd === 'gleaderboard' || cmd === 'glb')
        return run('leaderboard', { getString: n => n === 'location' ? 'global' : null });
    if (cmd === 'gbankleaderboard' || cmd === 'gblb')
        return run('leaderboard', { getString: n => n === 'location' ? 'global-bank' : null });

    if (cmd === 'stock') {
        const sub = args.shift()?.toLowerCase();
        if (sub === 'buy') return run('stock', { getSubcommand: () => 'buy', getString: n => n === 'ticker' ? args[0] : n === 'shares' ? args[1] : null });
        if (sub === 'sell') return run('stock', { getSubcommand: () => 'sell', getString: n => n === 'ticker' ? args[0] : n === 'shares' ? args[1] : null });
        if (sub === 'portfolio') return run('stock', { getSubcommand: () => 'portfolio' });
        if (sub === 'history') return run('stock', { getSubcommand: () => 'history', getString: n => n === 'ticker' ? args[0] : null });
        return run('stock', { getSubcommand: () => 'list' });
    }
    if (cmd === 'stocks' || cmd === 'stocklist') return run('stock', { getSubcommand: () => 'list' });
    if (cmd === 'buystock') return run('stock', { getSubcommand: () => 'buy', getString: n => n === 'ticker' ? args[0] : n === 'shares' ? args[1] : null });
    if (cmd === 'sellstock') return run('stock', { getSubcommand: () => 'sell', getString: n => n === 'ticker' ? args[0] : n === 'shares' ? args[1] : null });
    if (cmd === 'portfolio' || cmd === 'port') return run('stock', { getSubcommand: () => 'portfolio' });
    if (cmd === 'stockhistory' || cmd === 'sh') return run('stock', { getSubcommand: () => 'history', getString: n => n === 'ticker' ? args[0] : null });

    if (cmd === 'slave') {
        const sub = args.shift()?.toLowerCase();
        if (sub === 'buy') return run('slave', { getSubcommand: () => 'buy', getUser: n => n === 'user' ? message.mentions.users.first() : null });
        if (sub === 'sell') return run('slave', { getSubcommand: () => 'sell', getUser: n => n === 'user' ? message.mentions.users.first() : null, getInteger: n => n === 'startingbid' ? parseInt(args[0]) : null });
        if (sub === 'outbid') return run('slave', { getSubcommand: () => 'outbid', getNumber: n => n === 'amount' ? parseFloat(args[0]) : null });
        if (sub === 'panel') return run('slave', { getSubcommand: () => 'panel' });
        if (sub === 'list') return run('slave', { getSubcommand: () => 'list' });
        return run('slave', { getSubcommand: () => 'status' });
    }
    if (cmd === 'buy') return run('slave', { getSubcommand: () => 'buy', getUser: n => n === 'user' ? message.mentions.users.first() : null });
    if (cmd === 'sellslave') return run('slave', { getSubcommand: () => 'sell', getUser: n => n === 'user' ? message.mentions.users.first() : null, getInteger: n => n === 'startingbid' ? parseInt(args[1]) : null });
    if (cmd === 'outbid') return run('slave', { getSubcommand: () => 'outbid', getNumber: n => n === 'amount' ? parseFloat(args[0]) : null });
    if (cmd === 'slavepanel') return run('slave', { getSubcommand: () => 'panel' });
    if (cmd === 'slavelist') return run('slave', { getSubcommand: () => 'list' });

    if (cmd === 'owner') {
        const sub = args.shift()?.toLowerCase();
        const user = () => message.mentions.users.first();
        const num = i => parseFloat(args[i]);
        if (sub === 'give') return run('owner', { getSubcommand: () => 'give', getUser: n => n === 'user' ? user() : null, getNumber: n => n === 'amount' ? num(1) : null });
        if (sub === 'setbalance') return run('owner', { getSubcommand: () => 'setbalance', getUser: n => n === 'user' ? user() : null, getNumber: n => n === 'amount' ? num(1) : null });
        if (sub === 'setbank') return run('owner', { getSubcommand: () => 'setbank', getUser: n => n === 'user' ? user() : null, getNumber: n => n === 'amount' ? num(1) : null });
        if (sub === 'stats') return run('owner', { getSubcommand: () => 'stats' });
        if (sub === 'userinfo') return run('owner', { getSubcommand: () => 'userinfo', getUser: n => n === 'user' ? user() : null });
        if (sub === 'jackpot') return run('owner', { getSubcommand: () => 'jackpot', getNumber: n => n === 'amount' ? num(0) : null });
        if (sub === 'reseteconomy') return run('owner', { getSubcommand: () => 'reseteconomy' });
        if (sub === 'clearcooldowns') return run('owner', { getSubcommand: () => 'clearcooldowns' });
        if (sub === 'stockfix') return run('owner', { getSubcommand: () => 'stockfix' });
        if (sub === 'removestock') return run('owner', { getSubcommand: () => 'removestock', getUser: n => n === 'user' ? user() : null, getString: n => n === 'ticker' ? args[0]?.toUpperCase() : null });
        if (sub === 'setupmarket') return run('owner', { getSubcommand: () => 'setupmarket' });
        if (sub === 'bounty') return run('owner', { getSubcommand: () => 'bounty', getUser: n => n === 'user' ? user() : null, getNumber: n => n === 'amount' ? num(1) : null });
    }

    if (cmd === 'ogive') return run('owner', { getSubcommand: () => 'give', getUser: n => n === 'user' ? message.mentions.users.first() : null, getNumber: n => n === 'amount' ? parseFloat(args[1]) : null });
    if (cmd === 'osetbalance' || cmd === 'osetbal') return run('owner', { getSubcommand: () => 'setbalance', getUser: n => n === 'user' ? message.mentions.users.first() : null, getNumber: n => n === 'amount' ? parseFloat(args[1]) : null });
    if (cmd === 'osetbank') return run('owner', { getSubcommand: () => 'setbank', getUser: n => n === 'user' ? message.mentions.users.first() : null, getNumber: n => n === 'amount' ? parseFloat(args[1]) : null });
    if (cmd === 'oeconomystats' || cmd === 'ostats') return run('owner', { getSubcommand: () => 'stats' });
    if (cmd === 'ouserinfo') return run('owner', { getSubcommand: () => 'userinfo', getUser: n => n === 'user' ? message.mentions.users.first() : null });
    if (cmd === 'ojackpotdrop') return run('owner', { getSubcommand: () => 'jackpot', getNumber: n => n === 'amount' ? parseFloat(args[0]) : null });
    if (cmd === 'oresetleaderboard' || cmd === 'oreset') return run('owner', { getSubcommand: () => 'reseteconomy' });
    if (cmd === 'clearcooldowns') return run('owner', { getSubcommand: () => 'clearcooldowns' });
    if (cmd === 'ostockfix') return run('owner', { getSubcommand: () => 'stockfix' });
    if (cmd === 'oremovestock') return run('owner', { getSubcommand: () => 'removestock', getUser: n => n === 'user' ? message.mentions.users.first() : null, getString: n => n === 'ticker' ? args[1]?.toUpperCase() : null });
    if (cmd === 'setupmarket') return run('owner', { getSubcommand: () => 'setupmarket' });

    if (cmd === 'search') {
        const SEARCH_MAP = {
            couch: 'couch', behindthecouch: 'couch', behindcouch: 'couch',
            car: 'car', abandonedcar: 'car',
            house: 'house', emptyhouse: 'house',
            park: 'park', localpark: 'park',
            dumpster: 'dumpster',
            street: 'street', darkstreet: 'street',
            alley: 'alley', backalley: 'alley',
            abandonedbuilding: 'abandoned_building', building: 'abandoned_building',
            bankvault: 'bank_vault', vault: 'bank_vault',
            area51: 'area_51', area: 'area_51',
        };
        const raw = args.join('').toLowerCase().replace(/[\s_-]/g, '');
        const location = SEARCH_MAP[raw] ?? null;
        if (!location) {
            const valid = 'couch, car, house, park, dumpster, street, alley, abandoned building, bank vault, area 51';
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('Unknown Location')
                    .setDescription(args.length ? `"${args.join(' ')}" is not a valid location.\n\n**Valid locations:** ${valid}` : `You need to provide a location.\n\n**Valid locations:** ${valid}`)
                    .setColor(0xff3333)]
            });
        }
        return run('search', { getString: n => n === 'location' ? location : null });
    }

    if (cmd === 'crime') {
        const CRIME_MAP = {
            pickpocket: 'pickpocket', pick: 'pickpocket',
            shoplift: 'shoplift', lift: 'shoplift',
            carjack: 'carjack', jack: 'carjack',
            mugging: 'mugging', mug: 'mugging',
            fraud: 'fraud',
            bankrobbery: 'bank_robbery', bankrob: 'bank_robbery', robbery: 'bank_robbery', rob: 'bank_robbery',
        };
        const raw = args.join('').toLowerCase().replace(/[\s_-]/g, '');
        const type = CRIME_MAP[raw] ?? null;
        if (!type) {
            const valid = 'pickpocket, shoplift, carjack, mugging, fraud, bank robbery';
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('Unknown Crime')
                    .setDescription(args.length ? `"${args.join(' ')}" is not a valid crime type.\n\n**Valid types:** ${valid}` : `You need to provide a crime type.\n\n**Valid types:** ${valid}`)
                    .setColor(0xff3333)]
            });
        }
        return run('crime', { getString: n => n === 'type' ? type : null });
    }

    if (cmd === 'crash')
        return run('gamble', { getString: n => n === 'game' ? 'crash' : null, getInteger: n => n === 'bet' ? parseInt(args[0]) : null });

    if (cmd === 'horserace' || cmd === 'race')
        return run('gamble', { getString: n => n === 'game' ? 'horserace' : null, getInteger: n => n === 'bet' ? parseInt(args[0]) : null });

    if (cmd === 'scratch')
        return run('gamble', { getString: n => n === 'game' ? 'scratch' : null, getInteger: n => n === 'bet' ? parseInt(args[0]) : null });

    if (cmd === 'baccarat' || cmd === 'bac')
        return run('gamble', { getString: n => n === 'game' ? 'baccarat' : null, getInteger: n => n === 'bet' ? parseInt(args[0]) : null });

    if (cmd === 'beg')
        return run('beg', {});

    if (cmd === 'shop') {
        const sub = args.shift()?.toLowerCase();
        if (sub === 'buy') return run('shop', {
            getSubcommand: () => 'buy',
            getString: n => n === 'item' ? args[0] : null,
            getInteger: n => n === 'quantity' ? parseInt(args[1]) : null,
        });
        return run('shop', { getSubcommand: () => 'browse' });
    }

    if (cmd === 'lottery') {
        const sub = args.shift()?.toLowerCase();
        if (sub === 'buy') return run('lottery', {
            getSubcommand: () => 'buy',
            getString: n => n === 'type' ? args[0] : null,
            getInteger: n => n === 'tickets' ? parseInt(args[1]) : null,
        });
        return run('lottery', {
            getSubcommand: () => 'info',
            getString: n => n === 'type' ? args[0] : null,
        });
    }

    if (cmd === 'help') return run('help', {});
});

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (command) await command.execute(interaction);
    }

    if (interaction.isButton()) {
        const guildId = interaction.guild.id;

        if (interaction.customId.startsWith('slave_free_')) {
            const targetId = interaction.customId.split('_')[2];
            const slave = await Slave.findOne({ userId: targetId, guildId });
            if (!slave || slave.ownerId !== interaction.user.id) return interaction.reply({ content: '❌ Not your slave.', ephemeral: true });
            slave.ownerId = null; slave.debt = 0; slave.totalEarned = 0;
            await slave.save();
            await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🕊️ Slave Freed').setDescription(`<@${targetId}> has been set free.`).setColor(0x00FF99)] });
            try { const u = await client.users.fetch(targetId); await u.send({ embeds: [new EmbedBuilder().setTitle('🕊️ You Are Free!').setDescription(`<@${interaction.user.id}> has set you free.`).setColor(0x00FF99)] }); } catch { }
        }

        if (interaction.customId.startsWith('slave_renew_')) {
            const targetId = interaction.customId.split('_')[2];
            const slave = await Slave.findOne({ userId: targetId, guildId });
            if (!slave || slave.ownerId !== interaction.user.id) return interaction.reply({ content: '❌ Not your slave.', ephemeral: true });
            const renewCost = parseFloat((slave.debt / 2).toFixed(2));
            const owner = await getUser(interaction.user.id, guildId);
            if (owner.balance < renewCost) return interaction.reply({ content: `❌ You need **$${formatNumber(renewCost)}** to renew.`, ephemeral: true });
            owner.balance = parseFloat((owner.balance - renewCost).toFixed(2));
            await owner.save();
            const oldDebt = slave.debt;
            slave.debt = parseFloat((slave.debt * 2).toFixed(2));
            await slave.save();
            await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🔄 Debt Renewed').setDescription(`Paid **$${formatNumber(renewCost)}** to renew.\nDebt: **$${formatNumber(oldDebt)}** → **$${formatNumber(slave.debt)}**`).setColor(0xFF4500)] });
            try { const u = await client.users.fetch(targetId); await u.send({ embeds: [new EmbedBuilder().setTitle('🔄 Your Debt Has Been Renewed!').setDescription(`Your debt doubled to **$${formatNumber(slave.debt)}**.`).setColor(0xFF4500)] }); } catch { }
        }

        if (interaction.customId.startsWith('slave_check_')) {
            const targetId = interaction.customId.split('_')[2];
            const slave = await Slave.findOne({ userId: targetId, guildId });
            if (!slave || slave.ownerId !== interaction.user.id) return interaction.reply({ content: '❌ Not your slave.', ephemeral: true });
            const slaveEcon = await getUser(targetId, guildId);
            await interaction.reply({
                ephemeral: true, embeds: [new EmbedBuilder()
                    .setTitle(`📊 Stats for <@${targetId}>`)
                    .addFields(
                        { name: 'Debt Remaining', value: `$${formatNumber(slave.debt)}`, inline: true },
                        { name: 'Total Earned for You', value: `$${formatNumber(slave.totalEarned)}`, inline: true },
                        { name: 'Their Balance', value: `$${formatNumber(slaveEcon.balance)}`, inline: true }
                    )
                    .setColor(0x2b2d31).setTimestamp()]
            });
        }

        if (interaction.customId.startsWith('slave_takepay_')) {
            const targetId = interaction.customId.split('_')[2];
            const slave = await Slave.findOne({ userId: targetId, guildId });
            if (!slave || slave.ownerId !== interaction.user.id) return interaction.reply({ content: '❌ Not your slave.', ephemeral: true });
            const modal = new ModalBuilder().setCustomId(`takepay_modal_${targetId}`).setTitle('Take Payment from Slave');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('takepay_amount').setLabel(`Amount to take (Debt: $${formatNumber(slave.debt)})`).setStyle(TextInputStyle.Short).setPlaceholder('e.g. 500').setRequired(true)));
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
            if (slaveUser.balance < amount) return interaction.reply({ content: `❌ <@${targetId}> only has **$${formatNumber(slaveUser.balance)}**.`, ephemeral: true });
            const taken = parseFloat(Math.min(amount, slave.debt).toFixed(2));
            slaveUser.balance = parseFloat((slaveUser.balance - taken).toFixed(2));
            await slaveUser.save();
            slave.debt = parseFloat((slave.debt - taken).toFixed(2));
            if (slave.debt <= 0) {
                slave.ownerId = null; slave.debt = 0;
                await slave.save();
                await interaction.reply({ embeds: [new EmbedBuilder().setTitle('✅ Debt Fully Paid!').setDescription(`Took **$${formatNumber(taken)}** from <@${targetId}> - debt cleared, they are free.`).setColor(0x00FF99)] });
                try { const u = await client.users.fetch(targetId); await u.send({ embeds: [new EmbedBuilder().setTitle('🕊️ You Are Free!').setDescription('Your remaining debt was paid. You are now free.').setColor(0x00FF99)] }); } catch { }
            } else {
                await slave.save();
                await interaction.reply({
                    embeds: [new EmbedBuilder().setTitle('💰 Payment Taken').setDescription(`Took **$${formatNumber(taken)}** from <@${targetId}>.`).addFields(
                        { name: 'Debt Remaining', value: `$${formatNumber(slave.debt)}`, inline: true },
                        { name: 'Their Remaining Balance', value: `$${formatNumber(slaveUser.balance)}`, inline: true }
                    ).setColor(0xFF4500)]
                });
                try { const u = await client.users.fetch(targetId); await u.send({ embeds: [new EmbedBuilder().setTitle('💰 Payment Taken').setDescription(`**$${formatNumber(taken)}** taken toward your debt.\nDebt remaining: **$${formatNumber(slave.debt)}**`).setColor(0xFF4500)] }); } catch { }
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

(async () => {
    try {
        await deployCommands();
    } catch (e) {
        console.error('Command deploy failed:', e.message);
    }

    let redeployTimer = null;
    fs.watch('./src/commands', async (_, filename) => {
        if (!filename?.endsWith('.js')) return;
        clearTimeout(redeployTimer);
        redeployTimer = setTimeout(async () => {
            console.log(`${filename} changed - redeploying commands...`);
            try {
                await deployCommands();
                loadCommands();
                console.log('Commands reloaded.');
            } catch (e) {
                console.error('Redeploy failed:', e.message);
            }
        }, 2000);
    });

    client.login(process.env.TOKEN);
})();
