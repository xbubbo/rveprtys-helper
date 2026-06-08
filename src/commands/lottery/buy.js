const { EmbedBuilder } = require('discord.js');
const { getUser } = require('../../utils/economy');
const { TICKET_PRICES, getOrCreate } = require('../../utils/lottery');
const { formatNumber } = require('../../utils/format');

async function execute(interaction) {
    const type  = interaction.options.getString('type');
    const count = interaction.options.getInteger('tickets');
    const price = TICKET_PRICES[type];
    const total = price * count;

    const user = await getUser(interaction.user.id);
    if (user.balance < total)
        return interaction.reply({ content: `❌ You need **$${formatNumber(total)}** for ${count} ticket${count > 1 ? 's' : ''} but only have **$${formatNumber(user.balance)}**.`, ephemeral: true });

    user.balance = parseFloat((user.balance - total).toFixed(2));
    await user.save();

    const lottery = await getOrCreate(type);
    lottery.pot   = parseFloat((lottery.pot + total).toFixed(2));
    const existing = lottery.tickets.find(t => t.userId === interaction.user.id);
    if (existing) existing.count += count;
    else lottery.tickets.push({ userId: interaction.user.id, count });
    await lottery.save();

    const totalTickets = lottery.tickets.reduce((a, t) => a + t.count, 0);
    const myTickets    = lottery.tickets.find(t => t.userId === interaction.user.id)?.count ?? count;
    const chance       = ((myTickets / totalTickets) * 100).toFixed(1);
    const drawTs       = Math.floor(lottery.drawAt.getTime() / 1000);
    const label        = type === 'hourly' ? 'Hourly' : 'Daily';

    return interaction.reply({ embeds: [new EmbedBuilder()
        .setTitle(`🎟️ ${label} Lottery - Tickets Purchased!`)
        .addFields(
            { name: '🎟️ Your Tickets', value: `${formatNumber(myTickets)} (${chance}% chance)`, inline: true },
            { name: '🏆 Current Pot',  value: `$${formatNumber(lottery.pot)}`,                  inline: true },
            { name: '👥 Players',      value: `${lottery.tickets.length}`,                      inline: true },
            { name: '⏰ Draw',         value: `<t:${drawTs}:R>`,                                inline: true },
        )
        .setColor(0xFFD700)
        .setFooter({ text: 'At least 2 players required - otherwise everyone is refunded' })] });
}

module.exports = { execute };
