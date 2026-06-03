const { SlashCommandBuilder } = require('discord.js');
const { getUser } = require('../../utils/economy');
const { hasAnyItem } = require('../../utils/inventory');
const { execute: runFishing } = require('../work/fishing');

const RODS    = ['fishing_rod_wooden', 'fishing_rod_basic', 'fishing_rod_upgraded', 'fishing_rod_super'];
const BUCKETS = ['bucket_wooden', 'bucket_iron', 'bucket_gold', 'bucket_diamond'];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fish')
        .setDescription('Go fishing - requires a rod and bucket from the shop'),

    async execute(interaction) {
        const user = await getUser(interaction.user.id, interaction.guild.id);
        if (!hasAnyItem(user, RODS))
            return interaction.reply({ content: '❌ You need a fishing rod to fish. Start with a **Wooden Rod ($150)** from `/shop browse`.', ephemeral: true });
        if (!hasAnyItem(user, BUCKETS))
            return interaction.reply({ content: '❌ You need a bucket to store your catch. Start with a **Wooden Bucket ($100)** from `/shop browse`.', ephemeral: true });
        return runFishing(interaction, user);
    }
};
