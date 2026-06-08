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
    equipment: {
        label: 'Equipment',
        description: 'Your owned gear and durability',
        keys: null,
    },
};

function getHighestOwned(user, tierArr) {
    for (let i = tierArr.length - 1; i >= 0; i--) {
        if (hasItem(user, tierArr[i])) return tierArr[i];
    }
    return null;
}

function isActiveInChain(key, user, tierArr) {
    const idx = tierArr.indexOf(key);
    if (idx === -1) return false;
    for (let i = idx + 1; i < tierArr.length; i++) {
        if (hasItem(user, tierArr[i])) return false;
    }
    return true;
}

function itemLine(key, user) {
    const item = ITEMS[key];
    if (!item) return null;

    const qty    = user.inventory?.find(i => i.item === key)?.quantity ?? 0;
    const locked = !!(item.requires && !hasItem(user, item.requires));

    let badge = '';
    if (qty > 0)     badge = item.consumable ? ` ×${qty}` : ' ✅';
    else if (locked) badge = ' 🔒';

    const price = `$${formatNumber(item.price)}${item.consumable ? ' each' : ''}`;

    let extraLine = '';
    if (locked && item.requires) {
        extraLine = `\n*Requires: ${ITEMS[item.requires]?.name ?? item.requires}*`;
    } else if (qty > 0 && !item.consumable) {
        if (PICKAXE_TIERS.includes(key) && isActiveInChain(key, user, PICKAXE_TIERS)) {
            extraLine = `\n-# ${user.pickaxeDurability ?? 0} sessions remaining`;
        } else if (ROD_TIERS.includes(key) && isActiveInChain(key, user, ROD_TIERS)) {
            extraLine = `\n-# ${user.fishRodDurability ?? 0} casts remaining`;
        }
    }

    return `${item.emoji} **${item.name}**${badge}  ·  ${price}\n${item.description}${extraLine}`;
}

function itemLineForMode(key, user, mode = 'buy') {
    const item = ITEMS[key];
    if (!item) return null;

    const qty    = user.inventory?.find(i => i.item === key)?.quantity ?? 0;
    const locked = !!(item.requires && !hasItem(user, item.requires));
    const displayPrice = mode === 'sell' ? Math.floor(item.price * SELL_RATE) : item.price;
    const price = `$${formatNumber(displayPrice)}${item.consumable ? ' each' : ''}`;

    let extraLine = '';
    if (locked && item.requires) {
        extraLine = `\n*Requires: ${ITEMS[item.requires]?.name ?? item.requires}*`;
    } else if (qty > 0 && !item.consumable) {
        if (PICKAXE_TIERS.includes(key) && isActiveInChain(key, user, PICKAXE_TIERS)) {
            extraLine = `\n-# ${user.pickaxeDurability ?? 0} sessions remaining`;
        } else if (ROD_TIERS.includes(key) && isActiveInChain(key, user, ROD_TIERS)) {
            extraLine = `\n-# ${user.fishRodDurability ?? 0} casts remaining`;
        }
    }

    return `${item.emoji} **${item.name}** (${formatNumber(qty)})${locked ? ' 🔒' : ''}  ·  ${price}\n${item.description}${extraLine}`;
}

function buildEquipmentBody(user) {
    const sections = [];

    const rodId    = getHighestOwned(user, ROD_TIERS);
    const bucketId = getHighestOwned(user, BUCKET_TIERS);
    if (rodId || bucketId) {
        const lines = [];
        if (rodId) {
            const r = ITEMS[rodId];
            lines.push(`${r.emoji} **${r.name}** ✅  ·  $${formatNumber(r.price)}\n${r.description}\n-# ${user.fishRodDurability ?? 0} casts remaining`);
        }
        if (bucketId) {
            const b = ITEMS[bucketId];
            lines.push(`${b.emoji} **${b.name}** ✅  ·  $${formatNumber(b.price)}\n${b.description}`);
        }
        sections.push(`**🎣 Fishing**\n${lines.join('\n\n')}`);
    }

    const pickaxeId = getHighestOwned(user, PICKAXE_TIERS);
    if (pickaxeId || hasItem(user, 'mining_backpack')) {
        const lines = [];
        if (pickaxeId) {
            const p = ITEMS[pickaxeId];
            lines.push(`${p.emoji} **${p.name}** ✅  ·  $${formatNumber(p.price)}\n${p.description}\n-# ${user.pickaxeDurability ?? 0} sessions remaining`);
        }
        if (hasItem(user, 'mining_backpack')) {
            const bp = ITEMS.mining_backpack;
            lines.push(`${bp.emoji} **${bp.name}** ✅  ·  $${formatNumber(bp.price)}\n${bp.description}`);
        }
        sections.push(`**⛏️ Mining**\n${lines.join('\n\n')}`);
    }

    const streamOwned = ['keyboard_mouse', 'camera', 'ring_light', 'microphone', 'dedicated_server'].filter(k => hasItem(user, k));
    if (streamOwned.length > 0) {
        const lines = streamOwned.map(k => {
            const s = ITEMS[k];
            return `${s.emoji} **${s.name}** ✅  ·  $${formatNumber(s.price)}\n${s.description}`;
        });
        sections.push(`**📺 Streaming**\n${lines.join('\n\n')}`);
    }

    const consumOwned = ['lifesaver', 'fishing_bait', 'mining_bomb'].filter(k => hasItem(user, k));
    if (consumOwned.length > 0) {
        const lines = consumOwned.map(k => {
            const c   = ITEMS[k];
            const qty = user.inventory?.find(i => i.item === k)?.quantity ?? 0;
            return `${c.emoji} **${c.name}** ×${qty}  ·  $${formatNumber(c.price)} each\n${c.description}`;
        });
        sections.push(`**🎒 Consumables**\n${lines.join('\n\n')}`);
    }

    return sections.length > 0
        ? sections.join('\n\n')
        : `*You don't own any equipment yet.\nBrowse the categories above to get started.*`;
}

function buildActionRows(pageId, user, mode = 'buy') {
    const page = PAGES[pageId];
    if (!page?.keys) return [];

    const buttons = [];

    for (const key of page.keys) {
        const item = ITEMS[key];
        if (!item) continue;
        const qty    = user.inventory?.find(i => i.item === key)?.quantity ?? 0;
        const locked = !!(item.requires && !hasItem(user, item.requires));

        if (mode === 'sell') {
            buttons.push(
                new ButtonBuilder()
                    .setCustomId(`shop_sell:${key}:${pageId}`)
                    .setLabel(item.name)
                    .setStyle(ButtonStyle.Danger)
                    .setDisabled(qty <= 0)
            );
            continue;
        }

        buttons.push(
            new ButtonBuilder()
                .setCustomId(`shop_buy:${key}:${pageId}`)
                .setLabel(item.name)
                .setStyle(item.consumable ? ButtonStyle.Success : ButtonStyle.Primary)
                .setDisabled(locked || (!item.consumable && qty > 0))
        );
    }

    const rows = [];
    for (let i = 0; i < buttons.length; i += 5) {
        rows.push(new ActionRowBuilder().addComponents(...buttons.slice(i, i + 5)));
    }
    return rows;
}

function buildSelectMenu(currentId, mode = 'buy') {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`shop_select:${mode}`)
            .setPlaceholder('Select a category...')
            .addOptions(
                Object.entries(PAGES).map(([id, page]) => ({
                    label:       page.label,
                    value:       id,
                    description: page.description,
                    default:     id === currentId,
                }))
            )
    );
}

function buildModeMenu(pageId, mode = 'buy') {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`shop_mode:${pageId ?? 'none'}`)
            .setPlaceholder('Select shop mode...')
            .addOptions(
                { label: 'Buy',  value: 'buy',  description: 'Show buy buttons',  default: mode === 'buy' },
                { label: 'Sell', value: 'sell', description: 'Show sell buttons', default: mode === 'sell' },
            )
    );
}

function buildPage(pageId, user, mode = 'buy') {
    const page = pageId ? PAGES[pageId] : null;

    let body;
    if (!page) {
        body = 'Select a category to browse items.';
    } else if (!page.keys) {
        body = buildEquipmentBody(user);
    } else {
        body = page.keys.map(k => itemLineForMode(k, user, mode)).filter(Boolean).join('\n\n');
    }

    const container = new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent('### 🏪 Shop'))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(body))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# /buy <item>  ·  ?buy <item>  ·  /sell <item>  ·  ?sell <item>`))
        .addActionRowComponents(buildSelectMenu(pageId, mode))
        .addActionRowComponents(buildModeMenu(pageId, mode));

    const actionRows = pageId ? buildActionRows(pageId, user, mode) : [];
    for (const row of actionRows) container.addActionRowComponents(row);

    return { flags: MessageFlags.IsComponentsV2, components: [container] };
}

async function execute(interaction, user) {
    return interaction.reply(buildPage(null, user, 'buy'));
}

async function handleShopSelect(interaction) {
    await interaction.deferUpdate();
    const [, modeRaw = 'buy'] = interaction.customId.split(':');
    const mode = modeRaw === 'sell' ? 'sell' : 'buy';
    const pageId = interaction.values?.[0];
    if (!PAGES[pageId]) return;
    const user = await getUser(interaction.user.id);
    await interaction.message.edit(buildPage(pageId, user, mode));
}

async function handleShopMode(interaction) {
    await interaction.deferUpdate();
    const [, pageIdRaw] = interaction.customId.split(':');
    const pageId = PAGES[pageIdRaw] ? pageIdRaw : null;
    const mode = interaction.values?.[0] === 'sell' ? 'sell' : 'buy';
    const user = await getUser(interaction.user.id);
    await interaction.message.edit(buildPage(pageId, user, mode));
}

async function handleShopBuy(interaction) {
    const [, key, pageId] = interaction.customId.split(':');
    const item = ITEMS[key];
    if (!item) return interaction.reply({ content: '❌ Invalid item.', ephemeral: true });

    await interaction.deferUpdate();
    const user = await getUser(interaction.user.id);

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

    await interaction.message.edit(buildPage(PAGES[pageId] ? pageId : null, user, 'buy'));
}

async function handleShopSell(interaction) {
    const [, key, pageId] = interaction.customId.split(':');
    const item = ITEMS[key];

    await interaction.deferUpdate();
    const user = await getUser(interaction.user.id);

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

    await interaction.message.edit(buildPage(PAGES[pageId] ? pageId : null, user, 'sell'));
    await interaction.followUp({ content: `${item.emoji} Sold **${item.name}** for **$${formatNumber(sellPrice)}**.`, ephemeral: true });
}

module.exports = { execute, handleShopSelect, handleShopMode, handleShopBuy, handleShopSell };
