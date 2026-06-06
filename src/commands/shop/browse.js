const {
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
} = require('discord.js');
const { formatNumber } = require('../../utils/format');
const { getUser }      = require('../../utils/economy');
const { ITEMS }        = require('./items');

const PAGES = [
    { label: '🏪 General',           keys: ['lifesaver'] },
    { label: '🎣 Fishing - Rods',    keys: ['fishing_rod_wooden', 'fishing_rod_basic', 'fishing_rod_upgraded', 'fishing_rod_super', 'fishing_rod_legendary', 'fishing_bait'] },
    { label: '🪣 Fishing - Buckets', keys: ['bucket_wooden', 'bucket_iron', 'bucket_gold', 'bucket_diamond', 'bucket_crystal'] },
    { label: '⛏️ Mining',             keys: ['pickaxe_wooden', 'pickaxe_basic', 'pickaxe_iron', 'pickaxe_diamond', 'pickaxe_netherite', 'mining_backpack', 'mining_bomb'] },
    { label: '📺 Streaming',          keys: ['keyboard_mouse', 'camera', 'ring_light', 'microphone', 'dedicated_server'] },
    { label: '🎒 Inventory',          keys: null },
];

function itemLine(key, user) {
    const item = ITEMS[key];
    if (!item) return null;
    const qty      = user.inventory?.find(i => i.item === key)?.quantity ?? 0;
    const ownedStr = qty > 0 ? (item.consumable ? `${qty}` : '✅') : '-';
    const reqLine  = item.requires ? `*Requires: ${ITEMS[item.requires]?.name ?? item.requires}*\n` : '';
    return `${item.emoji} **${item.name}** - $${formatNumber(item.price)}  ·  Owned: **${ownedStr}**\n${reqLine}${item.description}`;
}

function buildPage(pageIndex, user) {
    const page = PAGES[pageIndex];

    let body;
    if (!page.keys) {
        const owned = (user.inventory ?? []).filter(e => e.quantity > 0);
        body = owned.length
            ? owned.map(e => {
                const item = ITEMS[e.item];
                return item ? `${item.emoji} **${item.name}**${e.quantity > 1 ? `  x${e.quantity}` : ''}` : null;
            }).filter(Boolean).join('\n')
            : '*Your inventory is empty.*';
    } else {
        body = page.keys.map(k => itemLine(k, user)).filter(Boolean).join('\n\n');
    }

    const navRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`shop_page:${pageIndex - 1}`)
            .setLabel('← Back')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pageIndex === 0),
        new ButtonBuilder()
            .setCustomId('shop_page:info')
            .setLabel(`${pageIndex + 1} / ${PAGES.length}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId(`shop_page:${pageIndex + 1}`)
            .setLabel('Next →')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(pageIndex === PAGES.length - 1),
    );

    const container = new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${page.label}`))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(body))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# /buy <item>  ·  ?buy <item>  ·  /sell <item>  ·  ?sell <item>`))
        .addActionRowComponents(navRow);

    return { flags: MessageFlags.IsComponentsV2, components: [container] };
}

async function execute(interaction, user) {
    return interaction.reply(buildPage(0, user));
}

async function handlePage(interaction) {
    await interaction.deferUpdate();
    const pageIndex = parseInt(interaction.customId.split(':')[1]);
    if (isNaN(pageIndex) || pageIndex < 0 || pageIndex >= PAGES.length) return;
    const user = await getUser(interaction.user.id, interaction.guild.id);
    await interaction.message.edit(buildPage(pageIndex, user));
}

module.exports = { execute, handlePage };
