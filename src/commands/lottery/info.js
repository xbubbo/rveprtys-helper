const { EmbedBuilder } = require('discord.js');
const { TICKET_PRICES, BASE_REWARDS, getOrCreate } = require('../../utils/lottery');
const { formatNumber } = require('../../utils/format');

async function execute(interaction) {
    const type    = interaction.options.getString('type') ?? 'hourly';
    const lottery = await getOrCreate(type);
    const drawTs  = Math.floor(lottery.drawAt.getTime() / 1000);
    const total   = lottery.tickets.reduce((a, t) => a + t.count, 0);
    const label   = type === 'hourly' ? 'Hourly' : 'Daily';

    const topLines = lottery.tickets.length
        ? lottery.tickets
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
            .map(t => {
                const pct = ((t.count / (total || 1)) * 100).toFixed(1);
                return `<@${t.userId}> - ${formatNumber(t.count)} ticket${t.count !== 1 ? 's' : ''} (${pct}%)`;
            })
            .join('\n')
        : 'No tickets sold yet.';

    return interaction.reply({ embeds: [new EmbedBuilder()
        .setTitle(`🎟️ ${label} Lottery`)
        .addFields(
            { name: '🏆 Current Pot',   value: `$${formatNumber(lottery.pot)}`,          inline: true  },
            { name: '👥 Players',       value: `${lottery.tickets.length}`,               inline: true  },
            { name: '🎟️ Total Tickets', value: formatNumber(total),                       inline: true  },
            { name: '⏰ Draw',          value: `<t:${drawTs}:F> (<t:${drawTs}:R>)`,       inline: false },
            { name: '🏅 Top Holders',   value: topLines,                                  inline: false },
        )
        .setColor(0xFFD700)
        .setFooter({ text: `$${formatNumber(TICKET_PRICES[type])}/ticket • Base pot: $${formatNumber(BASE_REWARDS[type])} • Needs 2+ players to award` })] });
}

module.exports = { execute };
