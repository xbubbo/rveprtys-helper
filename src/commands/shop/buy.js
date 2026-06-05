const { EmbedBuilder } = require('discord.js');
const { formatNumber } = require('../../utils/format');
const { hasItem } = require('../../utils/inventory');
const { ITEMS, ROD_TIERS, PICKAXE_TIERS, resolveItem } = require('./items');

async function execute(interaction, user) {
    const key      = resolveItem(interaction.options.getString('item'));
    const quantity = interaction.options.getInteger('quantity') ?? 1;
    const item     = key ? ITEMS[key] : null;
    if (!item) return interaction.reply({ content: '❌ Invalid item.', ephemeral: true });

    // Upgrade chain requirement
    if (item.requires && !hasItem(user, item.requires)) {
        const req = ITEMS[item.requires];
        return interaction.reply({ content: `❌ You need a **${req?.name ?? item.requires}** before buying this.`, ephemeral: true });
    }

    // Non-consumable: can only own one at a time (equipment)
    if (!item.consumable && hasItem(user, key)) {
        return interaction.reply({ content: `❌ You already own a **${item.name}**.`, ephemeral: true });
    }

    const total = item.price * quantity;
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

    if (ROD_TIERS.includes(key) && item.durability)     user.fishRodDurability = item.durability;
    if (PICKAXE_TIERS.includes(key) && item.durability) user.pickaxeDurability  = item.durability;

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
