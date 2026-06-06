const {
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle,
    StringSelectMenuBuilder, MessageFlags,
} = require('discord.js');
const { formatNumber } = require('../../utils/format');
const { getUser }      = require('../../utils/economy');
const { hasItem }      = require('../../utils/inventory');
const { ITEMS, ROD_TIERS, BUCKET_TIERS, PICKAXE_TIERS } = require('./items');

const SELL_RATE = 0.25;

const PAGES = {
    general: {
        label: 'General',
        description: 'General items',
        keys: ['lifesaver'],
    },
    fishing: {
        label: 'Fishing',
        description: 'Rods, bait and buckets',
        keys: [
            'fishing_rod_wooden', 'fishing_rod_basic', 'fishing_rod_upgraded',
            'fishing_rod_super', 'fishing_rod_legendary', 'fishing_bait',
            'bucket_wooden', 'bucket_iron', 'bucket_gold', 'bucket_diamond', 'bucket_crystal',
        ],
    },
    mining: {
        label: 'Mining',
        description: 'Pickaxes, backpack and bombs',
        keys: ['pickaxe_wooden', 'pickaxe_basic', 'pickaxe_iron', 'pickaxe_diamond', 'pickaxe_netherite', 'mining_backpack', 'mining_bomb'],
    },
    streaming: {
        label: 'Streaming',
        description: 'Streaming setup and upgrades',
        keys: ['keyboard_mouse', 'camera', 'ring_light', 'microphone', 'dedicated_server'],
    },
};

const PAGE_IDS = Object.keys(PAGES);

function itemLine(key, user) {
    const item = ITEMS[key];
    if (!item) return null;
    const qty    = user.inventory?.find(i => i.item === key)?.quantity ?? 0;
    const locked = !!(item.requires && !hasItem(user, item.requires));

    let badge   = '';
    let reqLine = '';

    if (qty > 0) {
        badge = item.consumable ? ` ×${qty}` : ' ✅';
    } else if (locked) {
        badge   = ' 🔒';
        reqLine = `*Requires: ${ITEMS[item.requires]?.name ?? item.requires}*\n`;
    }

    const price = `$${formatNumber(item.price)}${item.consumable ? ' each' : ''}`;
    return `${item.emoji} **${item.name}**${badge} - ${price}\n${reqLine}${item.description}`;
}

function buildSelectRow(currentId) {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('shop_select')
            .setPlaceholder('Browse a category...')
            .addOptions(PAGE_IDS.map(id => ({
                label:       PAGES[id].label,
                value:       id,
                description: PAGES[id].description,
                default:     id === currentId,
            })))
    );
}

function buildActionRow(pageId, user) {
    const page = PAGES[pageId];
    if (!page) return null;

    const buyButtons  = [];
    const sellButtons = [];

    for (const key of page.keys) {
        const item = ITEMS[key];
        if (!item) continue;
        const qty    = user.inventory?.find(i => i.item === key)?.quantity ?? 0;
        const locked = !!(item.requires && !hasItem(user, item.requires));

        if (item.consumable) {
            buyButtons.push(
                new ButtonBuilder()
                    .setCustomId(`shop_buy:${key}:${pageId}`)
                    .setLabel(`Buy ${item.name}`)
                    .setStyle(ButtonStyle.Success)
            );
        } else if (qty === 0 && !locked) {
            buyButtons.push(
                new ButtonBuilder()
                    .setCustomId(`shop_buy:${key}:${pageId}`)
                    .setLabel(`Buy ${item.name}`)
                    .setStyle(ButtonStyle.Primary)
            );
        } else if (qty > 0) {
            sellButtons.push(
                new ButtonBuilder()
                    .setCustomId(`shop_sell:${key}:${pageId}`)
                    .setLabel(`Sell ${item.name}`)
                    .setStyle(ButtonStyle.Danger)
            );
        }
    }

    const all = [...buyButtons, ...sellButtons].slice(0, 5);
    return all.length > 0 ? new ActionRowBuilder().addComponents(...all) : null;
}

function buildPage(pageId, user) {
    const page = PAGES[pageId] ?? PAGES.general;
    const body = page.keys.map(k => itemLine(k, user)).filter(Boolean).join('\n\n');

    const container = new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### 🏪 Shop - ${page.label}`))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(body))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# /buy <item>  ·  ?buy <item>  ·  /sell <item>  ·  ?sell <item>`))
        .addActionRowComponents(buildSelectRow(pageId));

    const actionRow = buildActionRow(pageId, user);
    if (actionRow) container.addActionRowComponents(actionRow);

    return { flags: MessageFlags.IsComponentsV2, components: [container] };
}

async function execute(interaction, user) {
    return interaction.reply(buildPage('general', user));
}

async function handleShopSelect(interaction) {
    await interaction.deferUpdate();
    const pageId = interaction.values?.[0];
    if (!PAGES[pageId]) return;
    const user = await getUser(interaction.user.id, interaction.guild.id);
    await interaction.message.edit(buildPage(pageId, user));
}

async function handleShopBuy(interaction) {
    const [, key, pageId] = interaction.customId.split(':');
    const item = ITEMS[key];
    if (!item) return interaction.reply({ content: '❌ Invalid item.', ephemeral: true });

    await interaction.deferUpdate();
    const user = await getUser(interaction.user.id, interaction.guild.id);

    if (item.requires && !hasItem(user, item.requires)) {
        await interaction.followUp({ content: `❌ You need a **${ITEMS[item.requires]?.name ?? item.requires}** first.`, ephemeral: true });
        return;
    }
    if (!item.consumable && hasItem(user, key)) {
        await interaction.followUp({ content: `❌ You already own a **${item.name}**.`, ephemeral: true });
        return;
    }
    if (user.balance < item.price) {
        await interaction.followUp({ content: `❌ You need **$${formatNumber(item.price)}** but only have **$${formatNumber(user.balance)}**.`, ephemeral: true });
        return;
    }

    user.balance = parseFloat((user.balance - item.price).toFixed(2));
    const existing = user.inventory?.find(i => i.item === key);
    if (existing) {
        existing.quantity++;
    } else {
        if (!user.inventory) user.inventory = [];
        user.inventory.push({ item: key, quantity: 1 });
    }
    if (ROD_TIERS.includes(key) && item.durability)     user.fishRodDurability = item.durability;
    if (PICKAXE_TIERS.includes(key) && item.durability) user.pickaxeDurability  = item.durability;
    await user.save();

    await interaction.message.edit(buildPage(PAGES[pageId] ? pageId : 'general', user));
}

async function handleShopSell(interaction) {
    const [, key, pageId] = interaction.customId.split(':');
    const item = ITEMS[key];

    await interaction.deferUpdate();
    const user = await getUser(interaction.user.id, interaction.guild.id);

    if (!item || !hasItem(user, key)) {
        await interaction.followUp({ content: `❌ You don't own a **${item?.name ?? key}**.`, ephemeral: true });
        return;
    }

    const entry = user.inventory.find(i => i.item === key);
    entry.quantity--;
    if (entry.quantity <= 0) user.inventory = user.inventory.filter(i => i.item !== key);
    if (PICKAXE_TIERS.includes(key)) user.pickaxeDurability = 0;
    if (ROD_TIERS.includes(key))     user.fishRodDurability = 0;

    const sellPrice = Math.floor(item.price * SELL_RATE);
    user.balance    = parseFloat((user.balance + sellPrice).toFixed(2));
    await user.save();

    await interaction.message.edit(buildPage(PAGES[pageId] ? pageId : 'general', user));
    await interaction.followUp({ content: `${item.emoji} Sold **${item.name}** for **$${formatNumber(sellPrice)}**.`, ephemeral: true });
}

module.exports = { execute, handleShopSelect, handleShopBuy, handleShopSell };
