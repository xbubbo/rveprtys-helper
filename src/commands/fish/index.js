const { SlashCommandBuilder } = require('discord.js');
const { getUser } = require('../../utils/economy');
const { getRod, getBucket, bucketCount, calcSellTotal, getTier, buildPanel, mainButtons, statusFooter } = require('./utils');
const { handleCast, handleReel, handleCut, handleSell, handleBucket, handleBack } = require('./handlers');
const { CATCH_ITEMS, TIERS } = require('./catalog');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fish')
        .setDescription('Go fishing - requires a rod and bucket from the shop'),

    async execute(interaction) {
        const user   = await getUser(interaction.user.id, interaction.guild.id);
        const rod    = getRod(user);
        const bucket = getBucket(user);

        if (!rod)    return interaction.reply({ content: 'You need a fishing rod. Buy one from `/shop`.', ephemeral: true });
        if (!bucket) return interaction.reply({ content: 'You need a bucket. Start with a Wooden Bucket ($500) from `/shop`.', ephemeral: true });

        const tier      = getTier(user.balance + user.bank);
        const sellTotal = await calcSellTotal(interaction.guild.id, user.fishBucket, bucket.sellMultiplier ?? 1);

        return interaction.reply({
            ...buildPanel(
                'Fishing',
                `Ready to cast at the **${tier.label}**.`,
                statusFooter(rod, tier, user, bucket),
                mainButtons(sellTotal, bucketCount(user))
            ),
            fetchReply: true,
        });
    },

    // Re-exported for interactionCreate.js
    handleCast, handleReel, handleCut, handleSell, handleBucket, handleBack,
    CATCH_ITEMS, TIERS,
};
