const { EmbedBuilder } = require('discord.js');
const { formatNumber } = require('../../utils/format');
const { hasItem } = require('../../utils/inventory');
const { ITEMS, ROD_TIERS, PICKAXE_TIERS, resolveItem } = require('./items');

const SELL_RATE = 0.25;

async function execute(interaction, user) {
    const key      = resolveItem(interaction.options.getString('item'));
    const quantity = interaction.options.getInteger('quantity') ?? 1;
    const item     = key ? ITEMS[key] : null;
    if (!item) return interaction.reply({ content: '❌ Invalid item.', ephemeral: true });

    if (!hasItem(user, key))
        return interaction.reply({ content: `❌ You don't own a **${item.name}**.`, ephemeral: true });

    const entry   = user.inventory.find(i => i.item === key);
    const sellQty = item.consumable ? Math.min(quantity, entry.quantity) : 1;

    if (item.consumable && quantity > entry.quantity)
        return interaction.reply({ content: `❌ You only have **${entry.quantity}x ${item.name}** to sell.`, ephemeral: true });

    const sellPriceEach = Math.floor(item.price * SELL_RATE);
    const total         = sellPriceEach * sellQty;

    entry.quantity -= sellQty;
    if (entry.quantity <= 0) user.inventory = user.inventory.filter(i => i.item !== key);

    // Reset durability tracking so next mine/fish session uses the new active item's full durability
    if (PICKAXE_TIERS.includes(key)) user.pickaxeDurability = 0;
    if (ROD_TIERS.includes(key))     user.fishRodDurability = 0;

    user.balance = parseFloat((user.balance + total).toFixed(2));
    await user.save();

    return interaction.reply({
        embeds: [new EmbedBuilder()
            .setTitle(`${item.emoji} Item Sold`)
            .setDescription(`You sold **${sellQty}x ${item.name}** for **$${formatNumber(total)}**.`)
            .addFields(
                { name: '💵 Balance',   value: `$${formatNumber(user.balance)}`, inline: true },
                { name: '📉 Sell Rate', value: `${Math.round(SELL_RATE * 100)}% of buy price`, inline: true },
            )
            .setColor(0xff6600)],
    });
}

module.exports = { execute };
