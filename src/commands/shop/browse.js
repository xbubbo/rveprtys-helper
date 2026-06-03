const { EmbedBuilder } = require('discord.js');
const { formatNumber } = require('../../utils/format');
const ITEMS = require('./items');

async function execute(interaction, user) {
    const shopLines = Object.entries(ITEMS).map(([key, item]) => {
        const owned = user.inventory?.find(i => i.item === key)?.quantity ?? 0;
        return `${item.emoji} **${item.name}** - $${formatNumber(item.price)}\n> ${item.description}\n> You own: **${owned}**`;
    }).join('\n\n');

    const invLines = user.inventory?.length
        ? user.inventory.map(i => {
            const item = ITEMS[i.item];
            return `${item?.emoji ?? '📦'} **${item?.name ?? i.item}** x${i.quantity}`;
        }).join('\n')
        : 'Your inventory is empty.';

    return interaction.reply({
        embeds: [new EmbedBuilder()
            .setTitle('🏪 Shop')
            .addFields(
                { name: '🛒 Available Items', value: shopLines, inline: false },
                { name: '🎒 Your Inventory',  value: invLines,  inline: false },
            )
            .setColor(0x5865F2)
            .setFooter({ text: 'Use /shop buy <item> to purchase' })]
    });
}

module.exports = { execute };
