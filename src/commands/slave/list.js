const { EmbedBuilder } = require('discord.js');
const Slave = require('../../models/slave');

async function execute(interaction) {
    const slaves = await Slave.find({ ownerId: { $ne: null } });
    if (!slaves.length) return interaction.reply({ content: 'No active slaves.', ephemeral: true });

    const ownerMap = {};
    for (const s of slaves) ownerMap[s.ownerId] = (ownerMap[s.ownerId] || 0) + 1;

    const lines = Object.entries(ownerMap)
        .sort((a, b) => b[1] - a[1])
        .map(([ownerId, count], i) => `**${i + 1}.** <@${ownerId}> - ${count} slave${count !== 1 ? 's' : ''}`);

    return interaction.reply({ embeds: [new EmbedBuilder()
        .setTitle('⛓️ Slave Leaderboard')
        .setDescription(lines.join('\n'))
        .setColor(0xFF4500)] });
}

module.exports = { execute };
