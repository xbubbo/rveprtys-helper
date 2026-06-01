const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser } = require('../utils/economy');
const { TICKET_PRICES, BASE_REWARDS, getOrCreate } = require('../utils/lottery');

const fmt    = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (n) => Number(n).toLocaleString('en-US');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lottery')
        .setDescription('Buy tickets and win the lottery pot')
        .addSubcommand(sub =>
            sub.setName('buy')
                .setDescription('Buy lottery tickets')
                .addStringOption(o =>
                    o.setName('type').setDescription('Which lottery').setRequired(true)
                        .addChoices(
                            { name: 'Hourly  ($200 / ticket)', value: 'hourly' },
                            { name: 'Daily  ($1,000 / ticket)', value: 'daily' }
                        )
                )
                .addIntegerOption(o =>
                    o.setName('tickets').setDescription('Number of tickets').setRequired(true).setMinValue(1).setMaxValue(100)
                )
        )
        .addSubcommand(sub =>
            sub.setName('info')
                .setDescription('View current lottery status')
                .addStringOption(o =>
                    o.setName('type').setDescription('Which lottery (default: hourly)').setRequired(false)
                        .addChoices(
                            { name: 'Hourly',  value: 'hourly' },
                            { name: 'Daily',   value: 'daily'  }
                        )
                )
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'buy') {
            const type    = interaction.options.getString('type');
            const count   = interaction.options.getInteger('tickets');
            const price   = TICKET_PRICES[type];
            const total   = price * count;

            const user = await getUser(interaction.user.id, interaction.guild.id);
            if (user.balance < total)
                return interaction.reply({ content: `❌ You need **$${fmt(total)}** for ${count} ticket${count > 1 ? 's' : ''} but only have **$${fmt(user.balance)}**.`, ephemeral: true });

            user.balance = parseFloat((user.balance - total).toFixed(2));
            await user.save();

            const lottery = await getOrCreate(interaction.guild.id, type);
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
                .setTitle(`🎟️ ${label} Lottery — Tickets Purchased!`)
                .addFields(
                    { name: '🎟️ Your Tickets',  value: `${fmtInt(myTickets)} (${chance}% chance)`, inline: true },
                    { name: '🏆 Current Pot',    value: `$${fmt(lottery.pot)}`,                     inline: true },
                    { name: '👥 Players',         value: `${lottery.tickets.length}`,               inline: true },
                    { name: '⏰ Draw',            value: `<t:${drawTs}:R>`,                         inline: true },
                )
                .setColor(0xFFD700)
                .setFooter({ text: 'At least 2 players required — otherwise everyone is refunded' })] });
        }

        if (sub === 'info') {
            const type    = interaction.options.getString('type') ?? 'hourly';
            const lottery = await getOrCreate(interaction.guild.id, type);
            const drawTs  = Math.floor(lottery.drawAt.getTime() / 1000);
            const total   = lottery.tickets.reduce((a, t) => a + t.count, 0);
            const label   = type === 'hourly' ? 'Hourly' : 'Daily';

            const topLines = lottery.tickets.length
                ? lottery.tickets
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 5)
                    .map(t => {
                        const pct = ((t.count / (total || 1)) * 100).toFixed(1);
                        return `<@${t.userId}> — ${fmtInt(t.count)} ticket${t.count !== 1 ? 's' : ''} (${pct}%)`;
                    })
                    .join('\n')
                : 'No tickets sold yet.';

            return interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle(`🎟️ ${label} Lottery`)
                .addFields(
                    { name: '🏆 Current Pot',   value: `$${fmt(lottery.pot)}`,              inline: true },
                    { name: '👥 Players',        value: `${lottery.tickets.length}`,         inline: true },
                    { name: '🎟️ Total Tickets',  value: `${fmtInt(total)}`,                  inline: true },
                    { name: '⏰ Draw',           value: `<t:${drawTs}:F> (<t:${drawTs}:R>)`, inline: false },
                    { name: '🏅 Top Holders',    value: topLines,                            inline: false },
                )
                .setColor(0xFFD700)
                .setFooter({ text: `$${fmtInt(TICKET_PRICES[type])}/ticket • Base pot: $${fmtInt(BASE_REWARDS[type])} • Needs 2+ players to award` })] });
        }
    }
};
