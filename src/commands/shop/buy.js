const { EmbedBuilder } = require('discord.js');
const { formatNumber } = require('../../utils/format');
const ITEMS = require('./items');

async function execute(interaction, user) {
    const key      = interaction.options.getString('item');
    const quantity = interaction.options.getInteger('quantity') ?? 1;
    const item     = ITEMS[key];
    const total    = item.price * quantity;

    if (user.balance < total)
        return interaction.reply({ content: `❌ You need **$${formatNumber(total)}** but only have **$${formatNumber(user.balance)}**.`, ephemeral: true });

    user.balance = parseFloat((user.balance - total).toFixed(2));

    const existing = user.inventory?.find(i => i.item === key);
    if (existing) {
        existing.quantity += quantity;
    } else {
        if (!user.inventory) user.inventory = [];
        user.inventory.push({ item: key, quantity });
    }

    await user.save();

    const owned = user.inventory.find(i => i.item === key)?.quantity ?? quantity;

    return interaction.reply({
        embeds: [new EmbedBuilder()
            .setTitle(`${item.emoji} Purchase Successful`)
            .setDescription(`You bought **${quantity}x ${item.name}** for **$${formatNumber(total)}**.`)
            .addFields(
                { name: '💵 Balance',   value: `$${formatNumber(user.balance)}`, inline: true },
                { name: '🎒 Now Owned', value: `${owned}x`,                      inline: true },
            )
            .setColor(0x00cc44)]
    });
}

module.exports = { execute };
