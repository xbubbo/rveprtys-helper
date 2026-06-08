const { EmbedBuilder } = require('discord.js');
const User = require('../../models/user');
const { formatNumber } = require('../../utils/format');

async function execute(interaction) {
    const amount = interaction.options.getNumber('amount');
    const users  = await User.find();
    if (!users.length) return interaction.reply({ content: 'No users found.', ephemeral: true });
    const winner = users[Math.floor(Math.random() * users.length)];
    winner.balance = parseFloat((winner.balance + amount).toFixed(2));
    await winner.save();
    return interaction.reply({ embeds: [new EmbedBuilder()
        .setTitle('💰 Jackpot Drop')
        .setDescription(`<@${winner.userId}> won **$${formatNumber(amount)}**!`)
        .setColor(0x00ff00)] });
}

module.exports = { execute };
