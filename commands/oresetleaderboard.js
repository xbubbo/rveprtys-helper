const { SlashCommandBuilder } = require('discord.js');
const User = require('../models/User');

const OWNER_ID = "1453078748080504996";

module.exports = {
    data: new SlashCommandBuilder()
        .setName('oresetleaderboard')
        .setDescription('Owner: reset economy'),

    async execute(interaction) {
        if (interaction.user.id !== OWNER_ID) return;

        await User.updateMany({}, { balance: 0, bank: 0 });

        await interaction.reply("Leaderboard reset.");
    }
};
