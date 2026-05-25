const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../models/User');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Top richest players'),

    async execute(interaction) {
        const users = await User.find({ guildId: interaction.guild.id })
            .sort({ balance: -1 })
            .limit(10);

        const description = users.map((u, i) => {
            return `**${i + 1}.** <@${u.userId}> - $${u.balance}`;
        }).join('\n');

        const embed = new EmbedBuilder()
            .setTitle('🏆 Leaderboard')
            .setDescription(description || "No data yet.")
            .setColor(0xFFD700);

        await interaction.reply({ embeds: [embed] });
    }
};
