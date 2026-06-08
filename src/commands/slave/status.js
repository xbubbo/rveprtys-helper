const { EmbedBuilder } = require('discord.js');
const Slave = require('../../models/slave');
const { formatNumber } = require('../../utils/format');

async function execute(interaction) {
    const slave = await Slave.findOne({ userId: interaction.user.id });
    if (!slave?.ownerId) return interaction.reply({ content: '✅ You are a free person.', ephemeral: true });

    return interaction.reply({ embeds: [new EmbedBuilder()
        .setTitle('⛓️ Your Slave Status')
        .setDescription(`You are owned by <@${slave.ownerId}>`)
        .addFields(
            { name: 'Debt Remaining',         value: `$${formatNumber(slave.debt)}`,        inline: true },
            { name: 'Total Earned for Owner', value: `$${formatNumber(slave.totalEarned)}`, inline: true },
        )
        .setColor(0xFF0000)
        .setFooter({ text: 'Keep working to pay off your debt!' })
        .setTimestamp()] });
}

module.exports = { execute };
