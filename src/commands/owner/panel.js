const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

async function execute(interaction) {
    return interaction.reply({
        embeds: [new EmbedBuilder()
            .setTitle('📦 Make an Order')
            .setDescription('To order a link, fill out the form by clicking the button and the bot will DM you the links when done.')
            .setColor(0x2b2d31)],
        components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('open_order_modal').setLabel('Order Now').setStyle(ButtonStyle.Primary)
        )],
    });
}

module.exports = { execute };
