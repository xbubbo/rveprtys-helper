const Lottery = require('../../models/Lottery');
const { getUser } = require('./economy');

const TICKET_PRICES = { hourly: 200,   daily: 1000  };
const BASE_REWARDS  = { hourly: 1000,  daily: 5000  };

const fmt    = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (n) => Number(n).toLocaleString('en-US');

function getNextDraw(type) {
    const now = new Date();
    if (type === 'hourly') {
        const next = new Date(now);
        next.setUTCMinutes(0, 0, 0);
        next.setUTCHours(next.getUTCHours() + 1);
        return next;
    }
    const next = new Date(now);
    next.setUTCHours(24, 0, 0, 0);
    return next;
}

async function getOrCreate(guildId, type) {
    let lottery = await Lottery.findOne({ guildId, type });
    if (!lottery) {
        lottery = await Lottery.create({
            guildId, type,
            pot:    BASE_REWARDS[type],
            tickets: [],
            drawAt: getNextDraw(type),
        });
    }
    return lottery;
}

async function drawLottery(client, lottery) {
    const guild = await client.guilds.fetch(lottery.guildId).catch(() => null);
    if (!guild) {
        lottery.tickets = [];
        lottery.pot     = BASE_REWARDS[lottery.type];
        lottery.drawAt  = getNextDraw(lottery.type);
        await lottery.save();
        return;
    }

    const ch = guild.systemChannel ?? guild.channels.cache
        .filter(c => c.type === 0 && c.permissionsFor(guild.members.me)?.has('SendMessages'))
        .sort((a, b) => a.position - b.position).first();

    const { EmbedBuilder } = require('discord.js');
    const label = lottery.type === 'hourly' ? 'Hourly' : 'Daily';

    if (lottery.tickets.length < 2) {
        for (const t of lottery.tickets) {
            const u      = await getUser(t.userId, lottery.guildId);
            const refund = parseFloat((t.count * TICKET_PRICES[lottery.type]).toFixed(2));
            u.balance    = parseFloat((u.balance + refund).toFixed(2));
            await u.save();
        }

        if (ch) await ch.send({ embeds: [new EmbedBuilder()
            .setTitle(`🎟️ ${label} Lottery — No Draw`)
            .setDescription(`Not enough players entered (need at least **2**).\nAll tickets have been refunded.`)
            .setColor(0x71717a)] }).catch(() => {});

        lottery.tickets = [];
        lottery.pot     = BASE_REWARDS[lottery.type];
        lottery.drawAt  = getNextDraw(lottery.type);
        await lottery.save();
        return;
    }

    const totalTickets = lottery.tickets.reduce((a, t) => a + t.count, 0);
    let rand = Math.floor(Math.random() * totalTickets);
    let winnerId = lottery.tickets[0].userId;
    for (const t of lottery.tickets) {
        rand -= t.count;
        if (rand < 0) { winnerId = t.userId; break; }
    }

    const winner = await getUser(winnerId, lottery.guildId);
    const prize  = parseFloat(lottery.pot.toFixed(2));
    winner.balance = parseFloat((winner.balance + prize).toFixed(2));
    await winner.save();

    const winnerTickets = lottery.tickets.find(t => t.userId === winnerId)?.count ?? 0;

    if (ch) await ch.send({ embeds: [new EmbedBuilder()
        .setTitle(`🎉 ${label} Lottery Draw!`)
        .setDescription(`<@${winnerId}> won the lottery!`)
        .addFields(
            { name: '🏆 Prize',          value: `$${fmt(prize)}`,                        inline: true },
            { name: '🎟️ Winning Tickets', value: `${fmtInt(winnerTickets)} / ${fmtInt(totalTickets)}`, inline: true },
            { name: '👥 Players',         value: `${lottery.tickets.length}`,             inline: true },
        )
        .setColor(0xFFD700)
        .setTimestamp()] }).catch(() => {});

    lottery.tickets = [];
    lottery.pot     = BASE_REWARDS[lottery.type];
    lottery.drawAt  = getNextDraw(lottery.type);
    await lottery.save();
}

module.exports = { TICKET_PRICES, BASE_REWARDS, getNextDraw, getOrCreate, drawLottery };
