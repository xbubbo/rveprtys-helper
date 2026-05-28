const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Stock = require('../models/Stock');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stocks')
        .setDescription('View the UBG stock market'),

    async execute(interaction) {
        const stocks = await Stock.find().sort({ ticker: 1 });

        const rows = stocks.map(s => {
            const prev = s.history.length >= 2 ? s.history[s.history.length - 2] : s.price;
            const change = s.price - prev;
            const pct = ((change / prev) * 100).toFixed(2);
            const arrow = change > 0 ? '🟢' : change < 0 ? '🔴' : '⚪';
            return `${arrow} \`${s.ticker.padEnd(4)}\` **${s.name}** — $${s.price.toFixed(2)} (${change >= 0 ? '+' : ''}${pct}%)`;
        }).join('\n');

        const embed = new EmbedBuilder()
            .setTitle('📈 NRG Stock Market')
            .setDescription(rows)
            .setColor(0x00FF99)
            .setFooter({ text: 'Prices update on buy/sell activity' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};
