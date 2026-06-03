const { EmbedBuilder } = require('discord.js');
const PrefixRouter   = require('../utils/prefixRouter');
const { parseAmount } = require('../utils/format');

const SEARCH_MAP = {
    couch:              ['couch', 'behindthecouch', 'behindcouch'],
    car:                ['car', 'abandonedcar'],
    house:              ['house', 'emptyhouse'],
    park:               ['park', 'localpark'],
    dumpster:           ['dumpster'],
    street:             ['street', 'darkstreet'],
    alley:              ['alley', 'backalley'],
    abandoned_building: ['abandonedbuilding', 'building'],
    bank_vault:         ['bankvault', 'vault'],
    area_51:            ['area51', 'area'],
};

function lookup(map, raw) {
    for (const [canonical, aliases] of Object.entries(map)) {
        if (aliases.includes(raw)) return canonical;
    }
    return null;
}

const router = new PrefixRouter();

const mention = msg  => msg.mentions.users.first();
const bet     = args => parseAmount(args[0]);
const num     = (args, i) => parseAmount(args[i]);

const gamble = game => (args, msg, run) => run('gamble', {
    getString:  n => n === 'game' ? game    : null,
    getInteger: n => n === 'bet'  ? bet(args) : null,
});

router

    // Bank
    .on('bank', null, (args, msg, run) => {
        const s = args.shift()?.toLowerCase();
        if (s === 'deposit')  return run('bank', { getSubcommand: () => 'deposit',  getString: n => n === 'amount' ? args[0] : null });
        if (s === 'withdraw') return run('bank', { getSubcommand: () => 'withdraw', getString: n => n === 'amount' ? args[0] : null });
        return run('bank', { getSubcommand: () => 'balance', getUser: n => n === 'user' ? mention(msg) : null });
    })
    .on(['balance', 'bal'],   null,       (args, msg, run) => run('bank', { getSubcommand: () => 'balance', getUser: n => n === 'user' ? mention(msg) : null }))
    .on(['deposit', 'dep'],   'deposit',  (args, msg, run) => run('bank', { getSubcommand: () => 'deposit',  getString: n => n === 'amount' ? args[0] : null }))
    .on(['withdraw', 'with'], 'withdraw', (args, msg, run) => run('bank', { getSubcommand: () => 'withdraw', getString: n => n === 'amount' ? args[0] : null }))

    // Work / careers
    .on(['work', 'fish', 'mine', 'stream'], 'work', (args, msg, run) => {
        const s = args[0]?.toLowerCase();
        if (s === 'fish' || s === 'mine' || s === 'stream') return run('work', { getSubcommand: () => 'work' });
        if (s === 'jobs')  return run('work', { getSubcommand: () => 'jobs' });
        if (s === 'apply') return run('work', { getSubcommand: () => 'apply', getString: n => n === 'job' ? args[1]?.toLowerCase() : null });
        return run('work', { getSubcommand: () => 'work' });
    })
    .on('jobs',  'work', (args, msg, run) => run('work', { getSubcommand: () => 'jobs' }))
    .on('apply', 'work', (args, msg, run) => run('work', { getSubcommand: () => 'apply', getString: n => n === 'job' ? args[0]?.toLowerCase() : null }))
    .on('daily', null,   (args, msg, run) => run('daily', {}))

    // Give
    .on(['give', 'givemoney'], 'givemoney', (args, msg, run) => run('give', {
        getUser:   n => n === 'user'   ? mention(msg) : null,
        getString: n => n === 'amount' ? args[1]      : null,
    }))

    // Gambling
    .on(['coinflip', 'cf'],        'coinflip', gamble('coinflip'))
    .on('dice',                    'dice',     gamble('dice'))
    .on('slots',                   'slots',    gamble('slots'))
    .on('roulette',                null,       gamble('roulette'))
    .on(['blackjack', 'bj'],       null,       gamble('blackjack'))
    .on(['highlow', 'hl'],         null,       gamble('highlow'))
    .on('crash',                   null,       gamble('crash'))
    .on(['horserace', 'race'],     null,       gamble('horserace'))
    .on('mines',                   null,       gamble('mines'))
    .on(['baccarat', 'bac'],       null,       gamble('baccarat'))

    // Rob / Duel
    .on('rob', 'rob', (args, msg, run) => run('rob', { getUser: n => n === 'target' ? mention(msg) : null }))
    .on('duel', 'duel', (args, msg, run) => run('duel', {
        getUser:   n => n === 'opponent' ? mention(msg) : null,
        getString: n => n === 'bet'      ? args[1]      : null,
    }))

    // Leaderboard
    .on(['leaderboard', 'lb'], 'leaderboard', (args, msg, run) => {
        const loc = ['bank','wallet','gambling','global','global-bank'].includes(args[0]?.toLowerCase()) ? args[0].toLowerCase() : 'both';
        return run('leaderboard', { getString: n => n === 'location' ? loc : null });
    })
    .on(['bankleaderboard', 'blb'],    'leaderboard', (args, msg, run) => run('leaderboard', { getString: n => n === 'location' ? 'bank' : null }))
    .on(['gleaderboard', 'glb'],       'leaderboard', (args, msg, run) => run('leaderboard', { getString: n => n === 'location' ? 'global' : null }))
    .on(['gbankleaderboard', 'gblb'],  'leaderboard', (args, msg, run) => run('leaderboard', { getString: n => n === 'location' ? 'global-bank' : null }))

    // Stocks
    .on('stock', 'stocks', (args, msg, run) => {
        const s = args.shift()?.toLowerCase();
        if (s === 'buy')       return run('stock', { getSubcommand: () => 'buy',       getString: n => n === 'ticker' ? args[0] : n === 'shares' ? args[1] : null });
        if (s === 'sell')      return run('stock', { getSubcommand: () => 'sell',      getString: n => n === 'ticker' ? args[0] : n === 'shares' ? args[1] : null });
        if (s === 'portfolio') return run('stock', { getSubcommand: () => 'portfolio' });
        if (s === 'history')   return run('stock', { getSubcommand: () => 'history',   getString: n => n === 'ticker' ? args[0] : null });
        return run('stock', { getSubcommand: () => 'list' });
    })
    .on(['stocks', 'stocklist'],   'stocks', (args, msg, run) => run('stock', { getSubcommand: () => 'list' }))
    .on('buystock',                'stocks', (args, msg, run) => run('stock', { getSubcommand: () => 'buy',  getString: n => n === 'ticker' ? args[0] : n === 'shares' ? args[1] : null }))
    .on('sellstock',               'stocks', (args, msg, run) => run('stock', { getSubcommand: () => 'sell', getString: n => n === 'ticker' ? args[0] : n === 'shares' ? args[1] : null }))
    .on(['portfolio', 'port'],     'stocks', (args, msg, run) => run('stock', { getSubcommand: () => 'portfolio' }))
    .on(['stockhistory', 'sh'],    'stocks', (args, msg, run) => run('stock', { getSubcommand: () => 'history', getString: n => n === 'ticker' ? args[0] : null }))

    // Slave
    .on('slave', 'slave', (args, msg, run) => {
        const s = args.shift()?.toLowerCase();
        if (s === 'buy')    return run('slave', { getSubcommand: () => 'buy',    getUser: n => n === 'user' ? mention(msg) : null });
        if (s === 'sell')   return run('slave', { getSubcommand: () => 'sell',   getUser: n => n === 'user' ? mention(msg) : null, getInteger: n => n === 'startingbid' ? parseAmount(args[0]) : null });
        if (s === 'outbid') return run('slave', { getSubcommand: () => 'outbid', getNumber: n => n === 'amount' ? parseAmount(args[0]) : null });
        if (s === 'panel')  return run('slave', { getSubcommand: () => 'panel' });
        if (s === 'list')   return run('slave', { getSubcommand: () => 'list' });
        return run('slave', { getSubcommand: () => 'status' });
    })
    .on('buy',        'slave', (args, msg, run) => run('slave', { getSubcommand: () => 'buy',    getUser: n => n === 'user' ? mention(msg) : null }))
    .on('sellslave',  'slave', (args, msg, run) => run('slave', { getSubcommand: () => 'sell',   getUser: n => n === 'user' ? mention(msg) : null, getInteger: n => n === 'startingbid' ? parseAmount(args[1]) : null }))
    .on('outbid',     'slave', (args, msg, run) => run('slave', { getSubcommand: () => 'outbid', getNumber: n => n === 'amount' ? parseAmount(args[0]) : null }))
    .on('slavepanel', 'slave', (args, msg, run) => run('slave', { getSubcommand: () => 'panel' }))
    .on('slavelist',  'slave', (args, msg, run) => run('slave', { getSubcommand: () => 'list' }))

    // Owner
    .on('owner', null, (args, msg, run) => {
        const s = args.shift()?.toLowerCase();
        const u = () => mention(msg);
        if (s === 'give')           return run('owner', { getSubcommand: () => 'give',          getUser: n => n === 'user' ? u() : null, getNumber: n => n === 'amount' ? num(args, 1) : null });
        if (s === 'setbalance')     return run('owner', { getSubcommand: () => 'setbalance',    getUser: n => n === 'user' ? u() : null, getNumber: n => n === 'amount' ? num(args, 1) : null });
        if (s === 'setbank')        return run('owner', { getSubcommand: () => 'setbank',       getUser: n => n === 'user' ? u() : null, getNumber: n => n === 'amount' ? num(args, 1) : null });
        if (s === 'stats')          return run('owner', { getSubcommand: () => 'stats' });
        if (s === 'userinfo')       return run('owner', { getSubcommand: () => 'userinfo',      getUser: n => n === 'user' ? u() : null });
        if (s === 'jackpot')        return run('owner', { getSubcommand: () => 'jackpot',       getNumber: n => n === 'amount' ? num(args, 0) : null });
        if (s === 'reseteconomy')   return run('owner', { getSubcommand: () => 'reseteconomy' });
        if (s === 'clearcooldowns') return run('owner', { getSubcommand: () => 'clearcooldowns' });
        if (s === 'stockfix')       return run('owner', { getSubcommand: () => 'stockfix' });
        if (s === 'removestock')    return run('owner', { getSubcommand: () => 'removestock',   getUser: n => n === 'user' ? u() : null, getString: n => n === 'ticker' ? args[0]?.toUpperCase() : null });
        if (s === 'setupmarket')    return run('owner', { getSubcommand: () => 'setupmarket' });
        if (s === 'bounty')         return run('owner', { getSubcommand: () => 'bounty',        getUser: n => n === 'user' ? u() : null, getNumber: n => n === 'amount' ? num(args, 1) : null });
    })
    .on('ogive',                           null, (args, msg, run) => run('owner', { getSubcommand: () => 'give',          getUser: n => n === 'user' ? mention(msg) : null, getNumber: n => n === 'amount' ? num(args, 1) : null }))
    .on(['osetbalance', 'osetbal'],        null, (args, msg, run) => run('owner', { getSubcommand: () => 'setbalance',    getUser: n => n === 'user' ? mention(msg) : null, getNumber: n => n === 'amount' ? num(args, 1) : null }))
    .on('osetbank',                        null, (args, msg, run) => run('owner', { getSubcommand: () => 'setbank',       getUser: n => n === 'user' ? mention(msg) : null, getNumber: n => n === 'amount' ? num(args, 1) : null }))
    .on(['oeconomystats', 'ostats'],       null, (args, msg, run) => run('owner', { getSubcommand: () => 'stats' }))
    .on('ouserinfo',                       null, (args, msg, run) => run('owner', { getSubcommand: () => 'userinfo',      getUser: n => n === 'user' ? mention(msg) : null }))
    .on('ojackpotdrop',                    null, (args, msg, run) => run('owner', { getSubcommand: () => 'jackpot',       getNumber: n => n === 'amount' ? num(args, 0) : null }))
    .on(['oresetleaderboard', 'oreset'],   null, (args, msg, run) => run('owner', { getSubcommand: () => 'reseteconomy' }))
    .on('clearcooldowns',                  null, (args, msg, run) => run('owner', { getSubcommand: () => 'clearcooldowns' }))
    .on('ostockfix',                       null, (args, msg, run) => run('owner', { getSubcommand: () => 'stockfix' }))
    .on('oremovestock',                    null, (args, msg, run) => run('owner', { getSubcommand: () => 'removestock',   getUser: n => n === 'user' ? mention(msg) : null, getString: n => n === 'ticker' ? args[1]?.toUpperCase() : null }))
    .on('setupmarket',                     null, (args, msg, run) => run('owner', { getSubcommand: () => 'setupmarket' }))

    // Search (fuzzy location matching)
    .on('search', null, (args, msg, run) => {
        const raw = args.join('').toLowerCase().replace(/[\s_-]/g, '');
        const loc = lookup(SEARCH_MAP, raw);
        if (!loc) {
            const valid = 'couch, car, house, park, dumpster, street, alley, abandoned building, bank vault, area 51';
            return msg.reply({ embeds: [new EmbedBuilder()
                .setTitle('Unknown Location')
                .setDescription(args.length ? `"${args.join(' ')}" is not a valid location.\n\n**Valid locations:** ${valid}` : `You need to provide a location.\n\n**Valid locations:** ${valid}`)
                .setColor(0xff3333)] });
        }
        return run('search', { getString: n => n === 'location' ? loc : null });
    })

    .on('crime', null, (args, msg, run) => run('crime', {}))

    // Shop
    .on('shop', null, (args, msg, run) => {
        const s = args.shift()?.toLowerCase();
        if (s === 'buy') return run('shop', {
            getSubcommand: () => 'buy',
            getString:  n => n === 'item'     ? args[0]           : null,
            getInteger: n => n === 'quantity' ? parseInt(args[1]) : null,
        });
        return run('shop', { getSubcommand: () => 'browse' });
    })

    // Lottery
    .on('lottery', null, (args, msg, run) => {
        const s = args.shift()?.toLowerCase();
        if (s === 'buy') return run('lottery', {
            getSubcommand: () => 'buy',
            getString:  n => n === 'type'    ? args[0]           : null,
            getInteger: n => n === 'tickets' ? parseInt(args[1]) : null,
        });
        return run('lottery', { getSubcommand: () => 'info', getString: n => n === 'type' ? args[0] : null });
    })

    // Misc
    .on('beg',           null,            (args, msg, run) => run('beg', {}))
    .on('prestige',      'prestige',      (args, msg, run) => run('prestige', {}))
    .on(['settings', 'notifications'], 'settings', (args, msg, run) => run('settings', {}))
    .on('help',          null,            (args, msg, run) => run('help', {}));

module.exports = router;
