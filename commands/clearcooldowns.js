const { SlashCommandBuilder } = require('discord.js');

const OWNER_ID = "1453078748080504996";

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clearcooldowns')
        .setDescription('Owner: clear cooldowns'),

    async execute(interaction) {
        if (interaction.user.id !== OWNER_ID) return;

        global.cooldowns = new Map();

        interaction.reply("Cooldowns cleared.");
    }
};
