const { EmbedBuilder } = require('discord.js');
const { formatNumber } = require('../../utils/format');

const bountyMap = new Map();

async function execute(interaction) {
    const target = interaction.options.getUser('user');
    const amount = interaction.options.getNumber('amount');
    bountyMap.set(target.id, amount);
    return interaction.reply({ embeds: [new EmbedBuilder()
        .setTitle('🎯 Bounty Set')
        .setDescription(`${target.username} now has a bounty of $${formatNumber(amount)}`)
        .setColor(0xFF4500)] });
}

module.exports = { execute, bountyMap };
