const {
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
} = require('discord.js');
const { formatNumber } = require('../../utils/format');
const { hasItem } = require('../../utils/inventory');
const { ITEMS, ROD_TIERS, BUCKET_TIERS } = require('../shop/items');
const FishMarket = require('../../models/fishmarket');
const { COOLDOWN, CATCH_ITEMS, WEIGHT_STATS, TABLES, ROD_STATS } = require('./catalog');

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function getTier(wealth) {
    const { TIERS } = require('./catalog');
    let t = TIERS[0];
    for (const x of TIERS) { if (wealth >= x.min) t = x; }
    return t;
}

function getRod(user) {
    for (let i = ROD_TIERS.length - 1; i >= 0; i--) {
        const id = ROD_TIERS[i];
        if (hasItem(user, id)) return { id, ...ITEMS[id], stats: ROD_STATS[id] };
    }
    return null;
}

function getBucket(user) {
    for (let i = BUCKET_TIERS.length - 1; i >= 0; i--) {
        const id = BUCKET_TIERS[i];
        if (hasItem(user, id)) return { id, ...ITEMS[id] };
    }
    return null;
}

function bucketCount(user) {
    return (user.fishBucket || []).reduce((a, i) => a + (i.quantity ?? 1), 0);
}

function randomWeight(itemId) {
    const stats = WEIGHT_STATS[itemId];
    if (!stats) return 1;
    const weight = stats.min + Math.random() * (stats.max - stats.min);
    return Math.round(weight * 10) / 10;
}

function displayWeight(weight) {
    return `${formatNumber(Number(weight ?? 1))} lbs`;
}

function normalizeBucketEntries(fishBucket) {
    const entries = [];
    for (const e of (fishBucket || [])) {
        const quantity = e.quantity ?? 1;
        for (let k = 0; k < quantity; k++) {
            const stats = WEIGHT_STATS[e.item];
            entries.push({ item: e.item, weight: Number(e.weight ?? stats?.avg ?? 1) });
        }
    }
    return entries;
}

async function getNpcPrice(guildId, fishType, baseValue) {
    try {
        const market = await FishMarket.findOne({ guildId, fishType });
        if (!market) return baseValue;
        if (Date.now() - market.lastReset > 24 * 60 * 60 * 1000) {
            market.soldLast24h = 0; market.lastReset = new Date(); await market.save();
            return baseValue;
        }
        return Math.floor(baseValue * Math.max(0.20, 1 - market.soldLast24h * 0.008));
    } catch { return baseValue; }
}

async function calcSellTotal(guildId, fishBucket, mult) {
    let total = 0;
    for (const e of normalizeBucketEntries(fishBucket)) {
        total += await getCatchValue(guildId, e);
    }
    return Math.floor(total * mult);
}

async function recordSales(guildId, items) {
    const counts = new Map();
    for (const e of normalizeBucketEntries(items)) {
        if (!CATCH_ITEMS[e.item] || e.item.startsWith('junk_')) continue;
        counts.set(e.item, (counts.get(e.item) ?? 0) + 1);
    }
    for (const [item, quantity] of counts) {
        await FishMarket.findOneAndUpdate(
            { guildId, fishType: item },
            { $inc: { soldLast24h: quantity }, $setOnInsert: { lastReset: new Date() } },
            { upsert: true }
        );
    }
}

async function getCatchValue(guildId, entry) {
    const item = CATCH_ITEMS[entry.item];
    const basePrice = await getNpcPrice(guildId, entry.item, item?.value ?? 0);
    const avgWeight = WEIGHT_STATS[entry.item]?.avg ?? entry.weight ?? 1;
    const weight = Number(entry.weight ?? avgWeight);
    return Math.max(1, Math.floor(basePrice * (weight / avgWeight)));
}

function pickItem(loc, skip, useBait) {
    const effectiveSkip = useBait ? Math.min(skip + 1, TABLES[loc].length - 1) : skip;
    let table = [...TABLES[loc]].slice(effectiveSkip);
    const total = table.reduce((a, e) => a + e[1], 0);
    let r = Math.random() * total;
    for (const [id, w] of table) { r -= w; if (r <= 0) return id; }
    return table[table.length - 1][0];
}

function buildPanel(title, body, footer, buttons = []) {
    const container = new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${title}`))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(body));
    if (footer) {
        container
            .addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${footer}`));
    }
    if (buttons.length) {
        container.addActionRowComponents(new ActionRowBuilder().addComponents(...buttons));
    }
    return { flags: MessageFlags.IsComponentsV2, components: [container] };
}

function mainButtons(sellTotal, bucketItems = 0) {
    return [
        new ButtonBuilder().setCustomId('fish_cast').setLabel('Cast').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('fish_sell')
            .setLabel(sellTotal > 0 ? `Sell All ($${formatNumber(sellTotal)})` : 'Sell All')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(sellTotal === 0),
        new ButtonBuilder().setCustomId('fish_bucket')
            .setLabel('View Bucket')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(bucketItems === 0),
    ];
}

function statusFooter(rod, tier, user, bucket) {
    const readyAt  = Math.floor(((user.lastFishCast ?? 0) + COOLDOWN) / 1000);
    const castLine = Date.now() < (user.lastFishCast ?? 0) + COOLDOWN
        ? `Next cast <t:${readyAt}:R>`
        : 'Ready to cast';
    return `${tier.label}  ·  ${rod.name} ${user.fishRodDurability ?? 0} uses left  ·  ${bucketCount(user)}/${bucket.slots} in bucket  ·  ${castLine}`;
}

module.exports = {
    rand, getTier, getRod, getBucket, bucketCount,
    randomWeight, displayWeight, normalizeBucketEntries,
    getNpcPrice, getCatchValue, calcSellTotal, recordSales, pickItem,
    buildPanel, mainButtons, statusFooter,
};
