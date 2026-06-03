const { EmbedBuilder } = require('discord.js');
const { formatNumber } = require('../../utils/format');
const { ITEMS, CATEGORY_LABELS } = require('./items');

function chunkFields(name, lines) {
    const fields = [];
    let current = '';
    for (const line of lines) {
        const addition = (current ? '\n\n' : '') + line;
        if (current.length + addition.length > 1000) {
            fields.push({ name, value: current, inline: false });
            current = line;
            name = '​'; // blank continuation header
        } else {
            current += addition;
        }
    }
    if (current) fields.push({ name, value: current, inline: false });
    return fields;
}

async function execute(interaction, user) {
    const byCategory = {};
    for (const [key, item] of Object.entries(ITEMS)) {
        const cat = item.category ?? 'general';
        if (!byCategory[cat]) byCategory[cat] = [];
        const owned   = user.inventory?.find(i => i.item === key)?.quantity ?? 0;
        const reqNote = item.requires ? ` *(needs ${ITEMS[item.requires]?.name ?? item.requires})*` : '';
        const durNote = item.durability ? ` | ${item.durability} casts` : '';
        const slotsNote = item.slots ? ` | ${item.slots} slots${item.sellMultiplier > 1 ? ` +${Math.round((item.sellMultiplier - 1) * 100)}% sell` : ''}` : '';
        byCategory[cat].push(
            `${item.emoji} **${item.name}** - $${formatNumber(item.price)}${item.consumable ? ' *(consumable)*' : ''}${durNote}${slotsNote}${reqNote}\n> ${item.description} | Owned: **${owned}**`
        );
    }

    const embed = new EmbedBuilder()
        .setTitle('🏪 Shop')
        .setColor(0x5865F2)
        .setFooter({ text: 'Use /shop buy <item> to purchase' });

    for (const [cat, lines] of Object.entries(byCategory)) {
        const label = CATEGORY_LABELS[cat] ?? cat;
        for (const field of chunkFields(label, lines)) {
            embed.addFields(field);
        }
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
