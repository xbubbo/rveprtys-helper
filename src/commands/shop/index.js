const { SlashCommandBuilder } = require('discord.js');
const { getUser } = require('../../utils/economy');
const browse = require('./browse');
const buy    = require('./buy');

const SUBS = { browse, buy };

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shop')
        .setDescription('Buy items and view your inventory')
        .addSubcommand(sub =>
            sub.setName('browse')
                .setDescription('Browse available items and view your inventory')
        )
        .addSubcommand(sub =>
            sub.setName('buy')
                .setDescription('Buy an item')
                .addStringOption(o =>
                    o.setName('item').setDescription('Item to buy').setRequired(true)
                        .addChoices({ name: 'Lifesaver ($5,000)', value: 'lifesaver' })
                )
                .addIntegerOption(o =>
                    o.setName('quantity').setDescription('How many to buy (default: 1)').setRequired(false).setMinValue(1).setMaxValue(99)
                )
        ),

    async execute(interaction) {
        const sub  = interaction.options.getSubcommand();
        const user = await getUser(interaction.user.id, interaction.guild.id);
        return SUBS[sub].execute(interaction, user);
    }
};
