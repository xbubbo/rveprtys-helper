const { ButtonBuilder, ButtonStyle } = require('discord.js');
const { getUser } = require('../../utils/economy');
const { formatNumber } = require('../../utils/format');
const { hasItem, consumeItem } = require('../../utils/inventory');
const { COOLDOWN, CATCH_ITEMS, TIERS, ROD_STATS } = require('./catalog');
const { ITEMS, ROD_TIERS } = require('../shop/items');
const {
    rand, getTier, getRod, getBucket, bucketCount,
    randomWeight, displayWeight, normalizeBucketEntries,
    getCatchValue, calcSellTotal, recordSales, pickItem,
    buildPanel, mainButtons, statusFooter,
} = require('./utils');

function limitLines(lines, max = 18) {
    if (lines.length <= max) return lines;
    return [...lines.slice(0, max), `...and ${lines.length - max} more`];
}

function tierFromLoc(loc, rod) {
    const found  = TIERS.find(t => t.loc === loc);
    const rodIdx = ROD_TIERS.indexOf(rod?.id ?? '');
    if (found && rodIdx >= found.rodMin) return found;
    return getTier(rod?.id);
}

async function handleCast(interaction) {
    await interaction.deferUpdate();
    const user   = await getUser(interaction.user.id);
    const rod    = getRod(user);
    const bucket = getBucket(user);
    if (!rod || !bucket) return;

    const loc    = interaction.customId.split(':')[1] ?? getTier(rod.id).loc;
    const tier   = tierFromLoc(loc, rod);
    const safeLoc = tier.loc;
    const footer = statusFooter(rod, tier, user, bucket);
    const msg    = interaction.message;

    const now     = Date.now();
    const readyAt = (user.lastFishCast ?? 0) + COOLDOWN;
    if (now < readyAt) {
        const ts   = Math.floor(readyAt / 1000);
        const sell = await calcSellTotal(user.fishBucket, bucket.sellMultiplier ?? 1);
        await msg.edit(buildPanel('Fishing', `Next cast: <t:${ts}:R>`, footer, mainButtons(sell, bucketCount(user), safeLoc)));
        return;
    }

    const cnt = bucketCount(user);
    if (cnt >= bucket.slots) {
        const sell = await calcSellTotal(user.fishBucket, bucket.sellMultiplier ?? 1);
        await msg.edit(buildPanel('Fishing', `Your **${bucket.name}** is full. Sell before casting.`, footer, mainButtons(sell, cnt, safeLoc)));
        return;
    }

    user.lastFishCast      = now;
    user.fishRodDurability = Math.max(0, (user.fishRodDurability ?? rod.durability) - 1);
    const rodBroke         = user.fishRodDurability === 0;
    if (rodBroke) user.inventory = (user.inventory || []).filter(i => i.item !== rod.id);
    const hasBait = hasItem(user, 'fishing_bait');
    await user.save();

    await msg.edit(buildPanel('Fishing', `Casting at the **${tier.label}**...`, footer));
    await new Promise(r => setTimeout(r, rand(2000, 4500)));

    const roll    = Math.random();
    const isBomb  = roll < 0.02;
    const nothing = !isBomb && roll < 0.07;

    if (nothing) {
        const sell = await calcSellTotal(user.fishBucket, bucket.sellMultiplier ?? 1);
        const body = 'Nothing on the line.' + (rodBroke ? `\n\n*Your **${rod.name}** broke - buy a new one from \`/shop\`.*` : '');
        await msg.edit(buildPanel('Fishing', body, footer, mainButtons(sell, cnt, safeLoc)));
        return;
    }

    const itemOnLine = isBomb ? 'bomb' : pickItem(safeLoc, rod.stats.skip, hasBait);
    const reelWindow = rand(2500, 4000);
    const expiresAt  = Date.now() + reelWindow;
    const reelId     = `fish_reel:${safeLoc}:${itemOnLine}:${expiresAt}:${hasBait ? 1 : 0}:${rod.id}`;
    const cutId      = `fish_cut:${safeLoc}:${expiresAt}`;

    const biteButtons = [
        new ButtonBuilder().setCustomId(reelId).setLabel('Reel In').setStyle(ButtonStyle.Success),
        ...(isBomb ? [new ButtonBuilder().setCustomId(cutId).setLabel('Cut Line').setStyle(ButtonStyle.Danger)] : []),
    ];

    await msg.edit(buildPanel('Fishing',
        isBomb ? 'Something is pulling hard. Feels different from a normal fish.' : `Something on the line at the **${tier.label}**.`,
        footer, biteButtons
    ));
}

async function handleReel(interaction) {
    await interaction.deferUpdate();
    const [, tierLoc, itemOnLine, expiresStr, baitStr, castRodId] = interaction.customId.split(':');
    const expiresAt = parseInt(expiresStr);

    const user       = await getUser(interaction.user.id);
    const rod        = getRod(user);
    const bucket     = getBucket(user);
    if (!bucket) return;

    // Use cast rod stats even if the rod broke and was removed from inventory
    const castRodStats = (castRodId && ROD_STATS[castRodId]) ?? rod?.stats;
    const rodBroke     = castRodId ? !hasItem(user, castRodId) : false;
    const castRodName  = (castRodId && ITEMS[castRodId]?.name) ?? rod?.name ?? 'your rod';
    const brokeNote    = rodBroke ? `\n\n*Your **${castRodName}** broke - buy a new one from \`/shop\`.*` : '';

    const activeRod = rod; // may be null if rod broke and no backup
    const tier      = TIERS.find(t => t.loc === tierLoc) ?? getTier(activeRod?.id);
    const footer    = statusFooter(activeRod, tier, user, bucket);
    const msg       = interaction.message;

    if (Date.now() > expiresAt) {
        const sell = await calcSellTotal(user.fishBucket, bucket.sellMultiplier ?? 1);
        await msg.edit(buildPanel('Fishing', 'Too slow - it got away.', footer, mainButtons(sell, bucketCount(user), tierLoc)));
        return;
    }

    if (itemOnLine === 'bomb') {
        const bucket_ = normalizeBucketEntries(user.fishBucket);
        const lost    = [];
        const n       = Math.min(rand(1, 3), bucket_.length);
        for (let k = 0; k < n; k++) {
            if (!bucket_.length) break;
            const idx = Math.floor(Math.random() * bucket_.length);
            const e   = bucket_[idx];
            const c   = CATCH_ITEMS[e.item];
            lost.push(`${c?.emoji ?? ''} ${c?.name ?? e.item} (${displayWeight(e.weight)})`);
            bucket_.splice(idx, 1);
        }
        user.fishBucket = bucket_;
        await user.save();
        const sell = await calcSellTotal(user.fishBucket, bucket.sellMultiplier ?? 1);
        const body = lost.length ? `Bomb.\n\nLost:\n${lost.join('\n')}` : 'Bomb. Your bucket was empty.';
        await msg.edit(buildPanel('Fishing', body, statusFooter(rod, tier, user, bucket), mainButtons(sell, bucketCount(user), tierLoc)));
        return;
    }

    if (Math.random() < (castRodStats?.snapChance ?? 0.08)) {
        const sell = await calcSellTotal(user.fishBucket, bucket.sellMultiplier ?? 1);
        await msg.edit(buildPanel('Fishing', 'Line snapped.' + brokeNote, footer, mainButtons(sell, bucketCount(user), tierLoc)));
        return;
    }

    const hadBait = baitStr === '1';
    if (hadBait) consumeItem(user, 'fishing_bait');

    let catchCount = 1;
    if ((castRodStats?.multiChance ?? 0) > 0 && Math.random() < castRodStats.multiChance) catchCount = castRodStats.multiCount;
    catchCount = Math.min(catchCount, bucket.slots - bucketCount(user));

    const bonusSkip = Math.max(0, (castRodStats?.skip ?? 0) - 1);

    const caught = [];
    for (let k = 0; k < catchCount; k++) {
        const id = k === 0 ? itemOnLine : pickItem(tierLoc, bonusSkip, false);
        const entry = { item: id, weight: randomWeight(id) };
        caught.push(entry);
        if (!user.fishBucket) user.fishBucket = [];
        user.fishBucket = normalizeBucketEntries(user.fishBucket);
        user.fishBucket.push(entry);
    }
    await user.save();

    const isMonster = caught.some(e => CATCH_ITEMS[e.item]?.type === 'monster');
    const lines     = await Promise.all(caught.map(async e => {
        const c     = CATCH_ITEMS[e.item];
        const price = await getCatchValue(e);
        return `${c.emoji} **${c.name}** (${displayWeight(e.weight)})  ·  $${formatNumber(price)}`;
    }));

    const newCount  = bucketCount(user);
    const sellTotal = await calcSellTotal(user.fishBucket, bucket.sellMultiplier ?? 1);
    const full      = newCount >= bucket.slots;
    const title     = isMonster ? 'Fishing  -  Monster Catch' : catchCount > 1 ? `Fishing  -  ${catchCount}x Catch` : 'Fishing';
    const body      = lines.join('\n') + `\n\n${newCount}/${bucket.slots} in bucket` + (full ? '\nBucket full. Sell before casting again.' : '') + brokeNote;

    await msg.edit(buildPanel(title, body, statusFooter(activeRod, tier, user, bucket), mainButtons(sellTotal, newCount, tierLoc)));
}

async function handleCut(interaction) {
    await interaction.deferUpdate();
    const parts  = interaction.customId.split(':');
    const loc    = parts[1] ?? 'pond';
    const user   = await getUser(interaction.user.id);
    const rod    = getRod(user);
    const bucket = getBucket(user);
    if (!rod || !bucket) return;

    const tier = TIERS.find(t => t.loc === loc) ?? getTier(rod.id);
    const sell = await calcSellTotal(user.fishBucket, bucket.sellMultiplier ?? 1);
    await interaction.message.edit(buildPanel('Fishing', 'Line cut.', statusFooter(rod, tier, user, bucket), mainButtons(sell, bucketCount(user), loc)));
}

async function handleSell(interaction) {
    await interaction.deferUpdate();
    const loc    = interaction.customId.split(':')[1] ?? 'pond';
    const user   = await getUser(interaction.user.id);
    const bucket = getBucket(user);
    const items  = normalizeBucketEntries(user.fishBucket);
    if (!items.length || !bucket) return;

    const count     = bucketCount(user);
    const isFull    = count >= bucket.slots;
    const mult      = (bucket.sellMultiplier ?? 1) * (isFull ? 1.15 : 1);

    const rows = await Promise.all(
        items
            .sort((a, b) => (CATCH_ITEMS[b.item]?.value ?? 0) - (CATCH_ITEMS[a.item]?.value ?? 0))
            .map(async e => {
                const c     = CATCH_ITEMS[e.item];
                const price = await getCatchValue(e);
                return `${c?.emoji ?? ''} ${c?.name ?? e.item} (${displayWeight(e.weight)})  $${formatNumber(price)}`;
            })
    );

    let raw = 0;
    for (const e of items) raw += await getCatchValue(e);
    const total = Math.floor(raw * mult);

    await recordSales(items);
    user.fishBucket = [];
    user.balance    = parseFloat((user.balance + total).toFixed(2));
    await user.save();

    const bonusParts = [];
    if (bucket.sellMultiplier > 1) bonusParts.push(`${bucket.name} x${bucket.sellMultiplier}`);
    if (isFull) bonusParts.push('Full bucket +15%');
    const multLine = bonusParts.length ? `\n-# ${bonusParts.join('  ·  ')}` : '';

    await interaction.message.edit(buildPanel(
        'Fishing  -  Sold',
        limitLines(rows).join('\n') + `\n\n**Total  $${formatNumber(total)}**${multLine}`,
        `New balance: $${formatNumber(user.balance)}`,
        [new ButtonBuilder().setCustomId(`fish_cast:${loc}`).setLabel('Cast Again').setStyle(ButtonStyle.Primary)]
    ));
}

async function handleBucket(interaction) {
    await interaction.deferUpdate();
    const loc    = interaction.customId.split(':')[1] ?? 'pond';
    const user   = await getUser(interaction.user.id);
    const bucket = getBucket(user);
    const msg    = interaction.message;

    const items = normalizeBucketEntries(user.fishBucket).sort((a, b) => (CATCH_ITEMS[b.item]?.value ?? 0) - (CATCH_ITEMS[a.item]?.value ?? 0));
    const lines = await Promise.all(items.map(async e => {
        const c     = CATCH_ITEMS[e.item];
        const price = await getCatchValue(e);
        return `${c?.emoji ?? ''} **${c?.name ?? e.item}** (${displayWeight(e.weight)})  ·  $${formatNumber(price)}`;
    }));

    const count = bucketCount(user);
    const sell  = await calcSellTotal(user.fishBucket, bucket?.sellMultiplier ?? 1);

    await msg.edit(buildPanel(
        'Bucket',
        lines.length ? limitLines(lines).join('\n') : 'Your bucket is empty.',
        `${count}/${bucket?.slots ?? '?'} items  ·  Value: $${formatNumber(sell)}`,
        [
            new ButtonBuilder().setCustomId(`fish_back:${loc}`).setLabel('Back').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`fish_sell:${loc}`)
                .setLabel(sell > 0 ? `Sell All ($${formatNumber(sell)})` : 'Sell All')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(sell === 0),
        ]
    ));
}

async function handleBack(interaction) {
    await interaction.deferUpdate();
    const loc    = interaction.customId.split(':')[1] ?? 'pond';
    const user   = await getUser(interaction.user.id);
    const rod    = getRod(user);
    const bucket = getBucket(user);
    if (!rod || !bucket) return;

    const tier = TIERS.find(t => t.loc === loc) ?? getTier(rod.id);
    const sell = await calcSellTotal(user.fishBucket, bucket.sellMultiplier ?? 1);

    await interaction.message.edit(buildPanel(
        'Fishing',
        `Ready to cast at the **${tier.label}**.`,
        statusFooter(rod, tier, user, bucket),
        mainButtons(sell, bucketCount(user), loc)
    ));
}

module.exports = { handleCast, handleReel, handleCut, handleSell, handleBucket, handleBack };
