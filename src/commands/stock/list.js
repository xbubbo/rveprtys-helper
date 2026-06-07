const { EmbedBuilder } = require('discord.js');
const Stock = require('../../models/stock');
const { stockPrice } = require('../../utils/format');

async function execute(interaction) {
    const stocks = await Stock.find({ guildId: interaction.guild.id }).sort({ ticker: 1 });
    if (!stocks.length)
        return interaction.reply({ content: '❌ No stocks set up yet. An admin can run `/owner setupmarket` to initialize the market.', ephemeral: true });

    const rows = stocks.map(s => {
        const prev   = s.history.length >= 2 ? s.history[s.history.length - 2] : s.price;
        const change = s.price - prev;
        const pct    = ((change / prev) * 100).toFixed(2);
        const circle = change > 0 ? '🟢' : change < 0 ? '🔴' : '⚪';
        return `${circle} \`${s.ticker.padEnd(4)}\` **${s.name}** - $${stockPrice(s.price)} (${change >= 0 ? '+' : ''}${pct}%)`;
    }).join('\n');

    return interaction.reply({
        embeds: [new EmbedBuilder()
            .setTitle('📈 Stock Market')
            .setDescription(rows)
            .setColor(0x00FF99)
            .setFooter({ text: 'Prices update every 30 minutes' })
            .setTimestamp()],
    });
}

module.exports = { execute };
