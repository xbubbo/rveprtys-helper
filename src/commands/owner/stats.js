const { EmbedBuilder } = require('discord.js');
const User = require('../../models/user');
const { formatNumber } = require('../../utils/format');

async function execute(interaction) {
    const users      = await User.find();
    const totalMoney = users.reduce((a, b) => a + b.balance + b.bank, 0);
    const richest    = [...users].sort((a, b) => (b.balance + b.bank) - (a.balance + a.bank))[0];
    return interaction.reply({ embeds: [new EmbedBuilder()
        .setTitle('📊 Economy Stats (Global)')
        .addFields(
            { name: 'Total Players', value: `${users.length}`, inline: true },
            { name: 'Total Money',   value: `$${formatNumber(totalMoney)}`, inline: true },
            { name: 'Richest',       value: richest ? `<@${richest.userId}> ($${formatNumber(richest.balance + richest.bank)})` : 'None', inline: true },
        )
        .setColor(0x2b2d31)] });
}

module.exports = { execute };
