const { EmbedBuilder } = require('discord.js');
const { formatNumber } = require('../../utils/format');
const { ITEMS, CATEGORY_LABELS } = require('./items');

async function execute(interaction, user) {
    const byCategory = {};
    for (const [key, item] of Object.entries(ITEMS)) {
        const cat = item.category ?? 'general';
        if (!byCategory[cat]) byCategory[cat] = [];
        const owned = user.inventory?.find(i => i.item === key)?.quantity ?? 0;
        const reqNote = item.requires ? ` *(requires ${ITEMS[item.requires]?.name ?? item.requires})*` : '';
        byCategory[cat].push(`${item.emoji} **${item.name}** - $${formatNumber(item.price)}${item.consumable ? ' (consumable)' : ''}${reqNote}\n> ${item.description}\n> You own: **${owned}**`);
    }

    const embed = new EmbedBuilder()
        .setTitle('🏪 Shop')
        .setColor(0x5865F2)
        .setFooter({ text: 'Use /shop buy <item> to purchase' });

    for (const [cat, lines] of Object.entries(byCategory)) {
        embed.addFields({ name: CATEGORY_LABELS[cat] ?? cat, value: lines.join('\n\n'), inline: false });
    }

    const invLines = user.inventory?.filter(i => i.quantity > 0).length
        ? user.inventory.filter(i => i.quantity > 0).map(i => {
            const item = ITEMS[i.item];
            return `${item?.emoji ?? '📦'} **${item?.name ?? i.item}** x${i.quantity}`;
        }).join('\n')
        : 'Your inventory is empty.';

    embed.addFields({ name: '🎒 Your Inventory', value: invLines, inline: false });

    return interaction.reply({ embeds: [embed] });
}

module.exports = { execute };
