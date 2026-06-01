const { EmbedBuilder } = require('discord.js');
const Config = require('../models/config');
const { parseAmount } = require('../utils/format');

const PREFIX = '?';

const MODULE_MAP = {
    work:        ['work'],
    rob:         ['rob'],
    coinflip:    ['coinflip', 'cf'],
    dice:        ['dice'],
    slots:       ['slots'],
    duel:        ['duel'],
    stocks:      ['stocks', 'stock', 'stocklist', 'buystock', 'sellstock', 'portfolio', 'port', 'stockhistory', 'sh'],
    slave:       ['buy', 'sellslave', 'outbid', 'slave', 'slavepanel', 'slavelist'],
    givemoney:   ['givemoney', 'give'],
    deposit:     ['deposit', 'dep', 'bank'],
    withdraw:    ['withdraw', 'with'],
    leaderboard: ['leaderboard', 'lb', 'bankleaderboard', 'blb', 'gleaderboard', 'glb', 'gbankleaderboard', 'gblb']
};

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

const CRIME_MAP = {
    pickpocket: 'pickpocket', pick: 'pickpocket',
    shoplift: 'shoplift', lift: 'shoplift',
    carjack: 'carjack', jack: 'carjack',
    mugging: 'mugging', mug: 'mugging',
    fraud: 'fraud',
    bankrobbery: 'bank_robbery', bankrob: 'bank_robbery', robbery: 'bank_robbery', rob: 'bank_robbery',
};

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        if (message.author.bot) return;
        if (!message.content.startsWith(PREFIX)) return;

        const args    = message.content.slice(PREFIX.length).trim().split(/\s+/);
        const cmd     = args.shift().toLowerCase();
        const guildId = message.guild.id;

        const config          = await Config.findOne({ guildId }) || {};
        const modules         = config.modules         || {};
        const bannedUsers     = config.bannedUsers     || [];
        const allowedChannels = config.allowedChannels || [];

        if (allowedChannels.length > 0 && !allowedChannels.includes(message.channel.id)) return;

        const banEntry = bannedUsers.find(b => b.userId === message.author.id);
        if (banEntry) {
            return message.reply({ embeds: [new EmbedBuilder()
                .setTitle('🔨 You Are Banned')
                .setDescription(`You have been banned from using this bot.\n**Reason:** ${banEntry.reason || 'No reason given'}`)
                .setColor(0xff0000)] });
        }

        for (const [mod, cmds] of Object.entries(MODULE_MAP)) {
            if (cmds.includes(cmd) && modules[mod] === false) {
                return message.reply({ embeds: [new EmbedBuilder()
                    .setTitle('🚫 Feature Disabled')
                    .setDescription(`The \`?${cmd}\` command is currently disabled in this server.`)
                    .setColor(0x71717a)] });
            }
        }

        const adapt = (opts = {}) => ({
            user:    message.author,
            guild:   message.guild,
            member:  message.member,
            channel: message.channel,
            client,
            options: {
                getUser:       n => opts.getUser?.(n)       ?? null,
                getInteger:    n => opts.getInteger?.(n)    ?? null,
                getString:     n => opts.getString?.(n)     ?? null,
                getNumber:     n => opts.getNumber?.(n)     ?? null,
                getSubcommand: () => opts.getSubcommand?.() ?? null,
            },
            reply:    d => message.reply(d),
            followUp: d => message.channel.send(d),
        });

        const run = (name, opts) => client.commands.get(name).execute(adapt(opts));

        if (cmd === 'bank') {
            const sub = args.shift()?.toLowerCase();
            if (sub === 'deposit')  return run('bank', { getSubcommand: () => 'deposit',  getString: n => n === 'amount' ? args[0] : null });
            if (sub === 'withdraw') return run('bank', { getSubcommand: () => 'withdraw', getString: n => n === 'amount' ? args[0] : null });
            return run('bank', { getSubcommand: () => 'balance', getUser: n => n === 'user' ? message.mentions.users.first() : null });
        }

        if (cmd === 'balance' || cmd === 'bal')
            return run('bank', { getSubcommand: () => 'balance', getUser: n => n === 'user' ? message.mentions.users.first() : null });

        if (cmd === 'deposit' || cmd === 'dep')
            return run('bank', { getSubcommand: () => 'deposit',  getString: n => n === 'amount' ? args[0] : null });

        if (cmd === 'withdraw' || cmd === 'with')
            return run('bank', { getSubcommand: () => 'withdraw', getString: n => n === 'amount' ? args[0] : null });

        if (cmd === 'work')  return run('work', {});
        if (cmd === 'daily') return run('daily', {});

        if (cmd === 'givemoney' || cmd === 'give')
            return run('give', {
                getUser:   n => n === 'user'   ? message.mentions.users.first() : null,
                getString: n => n === 'amount' ? args[1]                        : null,
            });

        if (cmd === 'coinflip'  || cmd === 'cf') return run('gamble', { getString: n => n === 'game' ? 'coinflip'  : null, getInteger: n => n === 'bet' ? parseAmount(args[0]) : null });
        if (cmd === 'dice')                      return run('gamble', { getString: n => n === 'game' ? 'dice'      : null, getInteger: n => n === 'bet' ? parseAmount(args[0]) : null });
        if (cmd === 'slots')                     return run('gamble', { getString: n => n === 'game' ? 'slots'     : null, getInteger: n => n === 'bet' ? parseAmount(args[0]) : null });
        if (cmd === 'roulette')                  return run('gamble', { getString: n => n === 'game' ? 'roulette'  : null, getInteger: n => n === 'bet' ? parseAmount(args[0]) : null });
        if (cmd === 'blackjack' || cmd === 'bj') return run('gamble', { getString: n => n === 'game' ? 'blackjack' : null, getInteger: n => n === 'bet' ? parseAmount(args[0]) : null });
        if (cmd === 'highlow'   || cmd === 'hl') return run('gamble', { getString: n => n === 'game' ? 'highlow'   : null, getInteger: n => n === 'bet' ? parseAmount(args[0]) : null });

        if (cmd === 'rob')
            return run('rob', { getUser: n => n === 'target' ? message.mentions.users.first() : null });

        if (cmd === 'duel')
            return run('duel', {
                getUser:   n => n === 'opponent' ? message.mentions.users.first() : null,
                getString: n => n === 'bet'      ? args[1]                        : null,
            });

        if (cmd === 'leaderboard' || cmd === 'lb') {
            const loc = ['bank','wallet','gambling','global','global-bank'].includes(args[0]?.toLowerCase()) ? args[0].toLowerCase() : 'both';
            return run('leaderboard', { getString: n => n === 'location' ? loc : null });
        }
        if (cmd === 'bankleaderboard' || cmd === 'blb')  return run('leaderboard', { getString: n => n === 'location' ? 'bank'        : null });
        if (cmd === 'gleaderboard'    || cmd === 'glb')  return run('leaderboard', { getString: n => n === 'location' ? 'global'      : null });
        if (cmd === 'gbankleaderboard'|| cmd === 'gblb') return run('leaderboard', { getString: n => n === 'location' ? 'global-bank' : null });

        if (cmd === 'stock') {
            const sub = args.shift()?.toLowerCase();
            if (sub === 'buy')       return run('stock', { getSubcommand: () => 'buy',       getString: n => n === 'ticker' ? args[0] : n === 'shares' ? args[1] : null });
            if (sub === 'sell')      return run('stock', { getSubcommand: () => 'sell',      getString: n => n === 'ticker' ? args[0] : n === 'shares' ? args[1] : null });
            if (sub === 'portfolio') return run('stock', { getSubcommand: () => 'portfolio' });
            if (sub === 'history')   return run('stock', { getSubcommand: () => 'history',   getString: n => n === 'ticker' ? args[0] : null });
            return run('stock', { getSubcommand: () => 'list' });
        }
        if (cmd === 'stocks' || cmd === 'stocklist')   return run('stock', { getSubcommand: () => 'list' });
        if (cmd === 'buystock')                        return run('stock', { getSubcommand: () => 'buy',     getString: n => n === 'ticker' ? args[0] : n === 'shares' ? args[1] : null });
        if (cmd === 'sellstock')                       return run('stock', { getSubcommand: () => 'sell',    getString: n => n === 'ticker' ? args[0] : n === 'shares' ? args[1] : null });
        if (cmd === 'portfolio' || cmd === 'port')     return run('stock', { getSubcommand: () => 'portfolio' });
        if (cmd === 'stockhistory' || cmd === 'sh')    return run('stock', { getSubcommand: () => 'history', getString: n => n === 'ticker' ? args[0] : null });

        if (cmd === 'slave') {
            const sub = args.shift()?.toLowerCase();
            if (sub === 'buy')    return run('slave', { getSubcommand: () => 'buy',    getUser: n => n === 'user' ? message.mentions.users.first() : null });
            if (sub === 'sell')   return run('slave', { getSubcommand: () => 'sell',   getUser: n => n === 'user' ? message.mentions.users.first() : null, getInteger: n => n === 'startingbid' ? parseAmount(args[0]) : null });
            if (sub === 'outbid') return run('slave', { getSubcommand: () => 'outbid', getNumber: n => n === 'amount' ? parseAmount(args[0]) : null });
            if (sub === 'panel')  return run('slave', { getSubcommand: () => 'panel' });
            if (sub === 'list')   return run('slave', { getSubcommand: () => 'list' });
            return run('slave', { getSubcommand: () => 'status' });
        }
        if (cmd === 'buy')        return run('slave', { getSubcommand: () => 'buy',    getUser: n => n === 'user' ? message.mentions.users.first() : null });
        if (cmd === 'sellslave')  return run('slave', { getSubcommand: () => 'sell',   getUser: n => n === 'user' ? message.mentions.users.first() : null, getInteger: n => n === 'startingbid' ? parseAmount(args[1]) : null });
        if (cmd === 'outbid')     return run('slave', { getSubcommand: () => 'outbid', getNumber: n => n === 'amount' ? parseAmount(args[0]) : null });
        if (cmd === 'slavepanel') return run('slave', { getSubcommand: () => 'panel' });
        if (cmd === 'slavelist')  return run('slave', { getSubcommand: () => 'list' });

        if (cmd === 'owner') {
            const sub  = args.shift()?.toLowerCase();
            const user = () => message.mentions.users.first();
            const num  = i => parseAmount(args[i]);
            if (sub === 'give')           return run('owner', { getSubcommand: () => 'give',          getUser: n => n === 'user' ? user() : null, getNumber: n => n === 'amount' ? num(1) : null });
            if (sub === 'setbalance')     return run('owner', { getSubcommand: () => 'setbalance',    getUser: n => n === 'user' ? user() : null, getNumber: n => n === 'amount' ? num(1) : null });
            if (sub === 'setbank')        return run('owner', { getSubcommand: () => 'setbank',       getUser: n => n === 'user' ? user() : null, getNumber: n => n === 'amount' ? num(1) : null });
            if (sub === 'stats')          return run('owner', { getSubcommand: () => 'stats' });
            if (sub === 'userinfo')       return run('owner', { getSubcommand: () => 'userinfo',      getUser: n => n === 'user' ? user() : null });
            if (sub === 'jackpot')        return run('owner', { getSubcommand: () => 'jackpot',       getNumber: n => n === 'amount' ? num(0) : null });
            if (sub === 'reseteconomy')   return run('owner', { getSubcommand: () => 'reseteconomy' });
            if (sub === 'clearcooldowns') return run('owner', { getSubcommand: () => 'clearcooldowns' });
            if (sub === 'stockfix')       return run('owner', { getSubcommand: () => 'stockfix' });
            if (sub === 'removestock')    return run('owner', { getSubcommand: () => 'removestock',   getUser: n => n === 'user' ? user() : null, getString: n => n === 'ticker' ? args[0]?.toUpperCase() : null });
            if (sub === 'setupmarket')    return run('owner', { getSubcommand: () => 'setupmarket' });
            if (sub === 'bounty')         return run('owner', { getSubcommand: () => 'bounty',        getUser: n => n === 'user' ? user() : null, getNumber: n => n === 'amount' ? num(1) : null });
        }

        if (cmd === 'ogive')                             return run('owner', { getSubcommand: () => 'give',          getUser: n => n === 'user' ? message.mentions.users.first() : null, getNumber: n => n === 'amount' ? parseAmount(args[1]) : null });
        if (cmd === 'osetbalance' || cmd === 'osetbal')  return run('owner', { getSubcommand: () => 'setbalance',    getUser: n => n === 'user' ? message.mentions.users.first() : null, getNumber: n => n === 'amount' ? parseAmount(args[1]) : null });
        if (cmd === 'osetbank')                          return run('owner', { getSubcommand: () => 'setbank',       getUser: n => n === 'user' ? message.mentions.users.first() : null, getNumber: n => n === 'amount' ? parseAmount(args[1]) : null });
        if (cmd === 'oeconomystats' || cmd === 'ostats') return run('owner', { getSubcommand: () => 'stats' });
        if (cmd === 'ouserinfo')                         return run('owner', { getSubcommand: () => 'userinfo',      getUser: n => n === 'user' ? message.mentions.users.first() : null });
        if (cmd === 'ojackpotdrop')                      return run('owner', { getSubcommand: () => 'jackpot',       getNumber: n => n === 'amount' ? parseAmount(args[0]) : null });
        if (cmd === 'oresetleaderboard' || cmd === 'oreset') return run('owner', { getSubcommand: () => 'reseteconomy' });
        if (cmd === 'clearcooldowns')                    return run('owner', { getSubcommand: () => 'clearcooldowns' });
        if (cmd === 'ostockfix')                         return run('owner', { getSubcommand: () => 'stockfix' });
        if (cmd === 'oremovestock')                      return run('owner', { getSubcommand: () => 'removestock',   getUser: n => n === 'user' ? message.mentions.users.first() : null, getString: n => n === 'ticker' ? args[1]?.toUpperCase() : null });
        if (cmd === 'setupmarket')                       return run('owner', { getSubcommand: () => 'setupmarket' });

        if (cmd === 'search') {
            const raw      = args.join('').toLowerCase().replace(/[\s_-]/g, '');
            const location = SEARCH_MAP[raw] ?? null;
            if (!location) {
                const valid = 'couch, car, house, park, dumpster, street, alley, abandoned building, bank vault, area 51';
                return message.reply({ embeds: [new EmbedBuilder()
                    .setTitle('Unknown Location')
                    .setDescription(args.length ? `"${args.join(' ')}" is not a valid location.\n\n**Valid locations:** ${valid}` : `You need to provide a location.\n\n**Valid locations:** ${valid}`)
                    .setColor(0xff3333)] });
            }
            return run('search', { getString: n => n === 'location' ? location : null });
        }

        if (cmd === 'crime') {
            const raw  = args.join('').toLowerCase().replace(/[\s_-]/g, '');
            const type = CRIME_MAP[raw] ?? null;
            if (!type) {
                const valid = 'pickpocket, shoplift, carjack, mugging, fraud, bank robbery';
                return message.reply({ embeds: [new EmbedBuilder()
                    .setTitle('Unknown Crime')
                    .setDescription(args.length ? `"${args.join(' ')}" is not a valid crime type.\n\n**Valid types:** ${valid}` : `You need to provide a crime type.\n\n**Valid types:** ${valid}`)
                    .setColor(0xff3333)] });
            }
            return run('crime', { getString: n => n === 'type' ? type : null });
        }

        if (cmd === 'crash')                       return run('gamble', { getString: n => n === 'game' ? 'crash'     : null, getInteger: n => n === 'bet' ? parseAmount(args[0]) : null });
        if (cmd === 'horserace' || cmd === 'race') return run('gamble', { getString: n => n === 'game' ? 'horserace' : null, getInteger: n => n === 'bet' ? parseAmount(args[0]) : null });
        if (cmd === 'scratch')                     return run('gamble', { getString: n => n === 'game' ? 'scratch'   : null, getInteger: n => n === 'bet' ? parseAmount(args[0]) : null });
        if (cmd === 'baccarat' || cmd === 'bac')   return run('gamble', { getString: n => n === 'game' ? 'baccarat'  : null, getInteger: n => n === 'bet' ? parseAmount(args[0]) : null });

        if (cmd === 'beg') return run('beg', {});

        if (cmd === 'shop') {
            const sub = args.shift()?.toLowerCase();
            if (sub === 'buy') return run('shop', {
                getSubcommand: () => 'buy',
                getString:  n => n === 'item'     ? args[0]          : null,
                getInteger: n => n === 'quantity' ? parseInt(args[1]) : null,
            });
            return run('shop', { getSubcommand: () => 'browse' });
        }

        if (cmd === 'lottery') {
            const sub = args.shift()?.toLowerCase();
            if (sub === 'buy') return run('lottery', {
                getSubcommand: () => 'buy',
                getString:  n => n === 'type'    ? args[0]          : null,
                getInteger: n => n === 'tickets' ? parseInt(args[1]) : null,
            });
            return run('lottery', {
                getSubcommand: () => 'info',
                getString: n => n === 'type' ? args[0] : null,
            });
        }

        if (cmd === 'help') return run('help', {});
    }
};
