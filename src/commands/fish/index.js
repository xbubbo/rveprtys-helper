const { SlashCommandBuilder } = require('discord.js');
const { getUser } = require('../../utils/economy');
const { ITEMS, ROD_TIERS } = require('../shop/items');
const { getRod, getBucket, bucketCount, calcSellTotal, getTier, buildPanel, mainButtons, statusFooter } = require('./utils');
const { handleCast, handleReel, handleCut, handleSell, handleBucket, handleBack } = require('./handlers');
const { CATCH_ITEMS, TIERS } = require('./catalog');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fish')
        .setDescription('Go fishing - requires a rod and bucket from the shop')
        .addStringOption(o =>
            o.setName('location').setDescription('Where to fish (defaults to highest zone your rod can reach)').setRequired(false)
                .addChoices(
                    { name: 'Pond',                   value: 'pond'    },
                    { name: 'River (Basic Rod+)',      value: 'river'   },
                    { name: 'Ocean (Upgraded Rod+)',   value: 'ocean'   },
                    { name: 'Deep Sea (Super Rod+)',   value: 'deepsea' },
                )
        ),

    async execute(interaction) {
        const user   = await getUser(interaction.user.id, interaction.guild.id);
        const rod    = getRod(user);
        const bucket = getBucket(user);

        if (!rod)    return interaction.reply({ content: 'You need a fishing rod. Buy one from `/shop`.', ephemeral: true });
        if (!bucket) return interaction.reply({ content: 'You need a bucket. Start with a Wooden Bucket ($500) from `/shop`.', ephemeral: true });

        const chosenLoc = interaction.options.getString('location');
        const maxTier   = getTier(rod.id);
        let tier = maxTier;

        if (chosenLoc) {
            const req    = TIERS.find(t => t.loc === chosenLoc);
            const rodIdx = ROD_TIERS.indexOf(rod.id);
            if (req && rodIdx < req.rodMin) {
                const reqRodName = ITEMS[ROD_TIERS[req.rodMin]]?.name ?? 'a better rod';
                return interaction.reply({
                    content: `❌ You need a **${reqRodName}** or better to fish at the **${req.label}**.`,
                    ephemeral: true,
                });
            }
            if (req) tier = req;
        }

        const loc       = tier.loc;
        const sellTotal = await calcSellTotal(interaction.guild.id, user.fishBucket, bucket.sellMultiplier ?? 1);

        return interaction.reply({
            ...buildPanel(
                'Fishing',
                `Ready to cast at the **${tier.label}**.`,
                statusFooter(rod, tier, user, bucket),
                mainButtons(sellTotal, bucketCount(user), loc)
            ),
            fetchReply: true,
        });
    },

    // Re-exported for interactionCreate.js
    handleCast, handleReel, handleCut, handleSell, handleBucket, handleBack,
    CATCH_ITEMS, TIERS,
};
