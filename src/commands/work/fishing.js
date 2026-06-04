const {
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
} = require('discord.js');
const { getUser } = require('../../utils/economy');
const { formatNumber } = require('../../utils/format');
const { hasItem, consumeItem } = require('../../utils/inventory');
const { ITEMS, ROD_TIERS, BUCKET_TIERS } = require('../shop/items');
const FishMarket = require('../../models/fishmarket');

const COOLDOWN = 10 * 1000;

const CATCH_ITEMS = {
    junk_boot:     { name: 'Old Boot',     emoji: '👢', value: 8,      type: 'junk'    },
    junk_can:      { name: 'Tin Can',      emoji: '🥫', value: 12,     type: 'junk'    },
    junk_seaweed:  { name: 'Seaweed',      emoji: '🌿', value: 5,      type: 'junk'    },
    fish_minnow:   { name: 'Minnow',       emoji: '🐟', value: 60,     type: 'fish'    },
    fish_perch:    { name: 'Perch',        emoji: '🐠', value: 180,    type: 'fish'    },
    fish_bass:     { name: 'Bass',         emoji: '🐡', value: 500,    type: 'fish'    },
    fish_trout:    { name: 'Trout',        emoji: '🐟', value: 1200,   type: 'fish'    },
    fish_salmon:   { name: 'Salmon',       emoji: '🐠', value: 3000,   type: 'fish'    },
    fish_tuna:     { name: 'Tuna',         emoji: '🐡', value: 8000,   type: 'fish'    },
    fish_swordfish:{ name: 'Swordfish',    emoji: '🐬', value: 22000,  type: 'fish'    },
    fish_shark:    { name: 'Shark',        emoji: '🦈', value: 65000,  type: 'fish'    },
    fish_monster:  { name: 'Monster Fish', emoji: '🐉', value: 250000, type: 'monster' },
};

const TABLES = {
    pond:    [['junk_boot',8],['junk_can',10],['junk_seaweed',7],['fish_minnow',40],['fish_perch',22],['fish_bass',10],['fish_trout',2],['fish_monster',0.3]],
    river:   [['junk_can',5],['junk_seaweed',4],['fish_minnow',15],['fish_perch',25],['fish_bass',25],['fish_trout',18],['fish_salmon',6],['fish_monster',0.5]],
    ocean:   [['junk_boot',2],['fish_bass',8],['fish_trout',15],['fish_salmon',22],['fish_tuna',28],['fish_swordfish',18],['fish_shark',5],['fish_monster',1]],
    deepsea: [['fish_salmon',8],['fish_tuna',18],['fish_swordfish',25],['fish_shark',28],['fish_monster',3]],
};

const TIERS = [
    { min: 0,      loc: 'pond',    label: 'Pond'     },
    { min: 10000,  loc: 'river',   label: 'River'    },
    { min: 50000,  loc: 'ocean',   label: 'Ocean'    },
    { min: 200000, loc: 'deepsea', label: 'Deep Sea' },
];

const ROD_STATS = {
    fishing_rod_wooden:   { skip: 0, snapChance: 0.08,  multiChance: 0,    multiCount: 1 },
    fishing_rod_basic:    { skip: 1, snapChance: 0.04,  multiChance: 0,    multiCount: 1 },
    fishing_rod_upgraded: { skip: 2, snapChance: 0.02,  multiChance: 0.15, multiCount: 2 },
    fishing_rod_super:    { skip: 3, snapChance: 0.005, multiChance: 0.25, multiCount: 3 },
};

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function getTier(w)      { let t = TIERS[0]; for (const x of TIERS) { if (w >= x.min) t = x; } return t; }

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
    return (user.fishBucket || []).reduce((a, i) => a + i.quantity, 0);
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
    for (const e of (fishBucket || [])) {
        total += (await getNpcPrice(guildId, e.item, CATCH_ITEMS[e.item]?.value ?? 0)) * e.quantity;
    }
    return Math.floor(total * mult);
}

async function recordSales(guildId, items) {
    for (const e of items) {
        if (!CATCH_ITEMS[e.item] || e.item.startsWith('junk_')) continue;
        await FishMarket.findOneAndUpdate(
            { guildId, fishType: e.item },
            { $inc: { soldLast24h: e.quantity }, $setOnInsert: { lastReset: new Date() } },
            { upsert: true }
        );
    }
}

function pickItem(loc, skip, useBait) {
    // Bait bumps the effective skip by 1 - removes one extra low-tier entry from the table
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

function mainButtons(sellTotal) {
    return [
        new ButtonBuilder().setCustomId('fish_cast').setLabel('Cast').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('fish_sell')
            .setLabel(sellTotal > 0 ? `Sell All  $${formatNumber(sellTotal)}` : 'Sell All')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(sellTotal === 0),
    ];
}

function statusFooter(rod, tier, user, bucket) {
    return `${tier.label}  ·  ${rod.name} ${user.fishRodDurability ?? 0} uses left  ·  ${bucketCount(user)}/${bucket.slots} in bucket`;
}

// ─── Main command ─────────────────────────────────────────────────────────────

async function execute(interaction, user) {
    const rod    = getRod(user);
    const bucket = getBucket(user);
    if (!rod)    return interaction.reply({ content: 'You need a fishing rod. Buy one from `/shop`.', ephemeral: true });
    if (!bucket) return interaction.reply({ content: 'You need a bucket. Start with a Wooden Bucket ($100) from `/shop`.', ephemeral: true });

    const tier      = getTier(user.balance + user.bank);
    const sellTotal = await calcSellTotal(interaction.guild.id, user.fishBucket, bucket.sellMultiplier ?? 1);

    return interaction.reply({
        ...buildPanel(
            'Fishing',
            `Ready to cast at the **${tier.label}**.`,
            statusFooter(rod, tier, user, bucket),
            mainButtons(sellTotal)
        ),
        fetchReply: true,
    });
}

// ─── Global button handlers ───────────────────────────────────────────────────

async function handleCast(interaction) {
    await interaction.deferUpdate();
    const user   = await getUser(interaction.user.id, interaction.guild.id);
    const rod    = getRod(user);
    const bucket = getBucket(user);
    if (!rod || !bucket) return;

    const tier    = getTier(user.balance + user.bank);
    const footer  = statusFooter(rod, tier, user, bucket);
    const msg     = interaction.message;

    const now     = Date.now();
    if (now - (user.lastFishCast ?? 0) < COOLDOWN) {
        const readyAt = Math.floor((user.lastFishCast + COOLDOWN) / 1000);
        const sell    = await calcSellTotal(interaction.guild.id, user.fishBucket, bucket.sellMultiplier ?? 1);
        await msg.edit(buildPanel('Fishing', `Next cast: <t:${readyAt}:R>`, footer, mainButtons(sell)));
        return;
    }

    const cnt = bucketCount(user);
    if (cnt >= bucket.slots) {
        const sell = await calcSellTotal(interaction.guild.id, user.fishBucket, bucket.sellMultiplier ?? 1);
        await msg.edit(buildPanel('Fishing', `Your **${bucket.name}** is full. Sell before casting.`, footer, mainButtons(sell)));
        return;
    }

    user.lastFishCast      = now;
    user.fishRodDurability = Math.max(0, (user.fishRodDurability ?? rod.durability) - 1);
    const rodBroke         = user.fishRodDurability === 0;
    if (rodBroke) user.inventory = (user.inventory || []).filter(i => i.item !== rod.id);
    const hasBait = hasItem(user, 'fishing_bait');
    await user.save();

    if (rodBroke) {
        const sell = await calcSellTotal(interaction.guild.id, user.fishBucket, bucket.sellMultiplier ?? 1);
        await msg.edit(buildPanel('Fishing', `Your **${rod.name}** broke. Buy a new one from \`/shop\`.`, footer, mainButtons(sell)));
        return;
    }

    await msg.edit(buildPanel('Fishing', `Casting at the **${tier.label}**...`, footer));
    await new Promise(r => setTimeout(r, rand(2000, 4500)));

    const roll    = Math.random();
    const isBomb  = roll < 0.02;
    const nothing = !isBomb && roll < 0.07;

    if (nothing) {
        const sell = await calcSellTotal(interaction.guild.id, user.fishBucket, bucket.sellMultiplier ?? 1);
        await msg.edit(buildPanel('Fishing', 'Nothing on the line.', footer, mainButtons(sell)));
        return;
    }

    // Encode state directly into the button custom ID - no DB write needed
    const itemOnLine = isBomb ? 'bomb' : pickItem(tier.loc, rod.stats.skip, hasBait);
    const reelWindow = rand(2500, 4000);
    const expiresAt  = Date.now() + reelWindow;

    // fish_reel:TIER:ITEM:EXPIRES:BAIT  (max ~57 chars, well under 100 limit)
    const reelId = `fish_reel:${tier.loc}:${itemOnLine}:${expiresAt}:${hasBait ? 1 : 0}`;
    const cutId  = `fish_cut:${expiresAt}`;

    const biteButtons = [
        new ButtonBuilder().setCustomId(reelId).setLabel('Reel In').setStyle(ButtonStyle.Success),
        ...(isBomb ? [new ButtonBuilder().setCustomId(cutId).setLabel('Cut Line').setStyle(ButtonStyle.Danger)] : []),
    ];
    const biteText = isBomb
        ? 'Something is pulling hard. Feels different from a normal fish.'
        : `Something on the line at the **${tier.label}**.`;

    await msg.edit(buildPanel('Fishing', biteText, footer, biteButtons));
}

async function handleReel(interaction) {
    await interaction.deferUpdate();
    // Parse state from the custom ID: fish_reel:TIER:ITEM:EXPIRES:BAIT
    const [, tierLoc, itemOnLine, expiresStr, baitStr] = interaction.customId.split(':');
    const expiresAt = parseInt(expiresStr);

    const user   = await getUser(interaction.user.id, interaction.guild.id);
    const rod    = getRod(user);
    const bucket = getBucket(user);
    if (!rod || !bucket) return;

    const tier   = getTier(user.balance + user.bank);
    const footer = statusFooter(rod, tier, user, bucket);
    const msg    = interaction.message;

    if (Date.now() > expiresAt) {
        const sell = await calcSellTotal(interaction.guild.id, user.fishBucket, bucket.sellMultiplier ?? 1);
        await msg.edit(buildPanel('Fishing', 'Too slow - it got away.', footer, mainButtons(sell)));
        return;
    }

    if (itemOnLine === 'bomb') {
        const bucket_ = user.fishBucket || [];
        const lost    = [];
        const n       = Math.min(rand(1, 3), bucket_.length);
        for (let k = 0; k < n; k++) {
            if (!bucket_.length) break;
            const idx = Math.floor(Math.random() * bucket_.length);
            const e   = bucket_[idx];
            const c   = CATCH_ITEMS[e.item];
            lost.push(`${c?.emoji ?? ''} ${c?.name ?? e.item}`);
            e.quantity--;
            if (e.quantity <= 0) bucket_.splice(idx, 1);
        }
        user.fishBucket = bucket_;
        await user.save();
        const sell = await calcSellTotal(interaction.guild.id, user.fishBucket, bucket.sellMultiplier ?? 1);
        const body = lost.length ? `Bomb.\n\nLost:\n${lost.join('\n')}` : 'Bomb. Your bucket was empty.';
        await msg.edit(buildPanel('Fishing', body, statusFooter(rod, tier, user, bucket), mainButtons(sell)));
        return;
    }

    const rodStats = rod.stats;
    if (Math.random() < rodStats.snapChance) {
        const sell = await calcSellTotal(interaction.guild.id, user.fishBucket, bucket.sellMultiplier ?? 1);
        await msg.edit(buildPanel('Fishing', 'Line snapped.', footer, mainButtons(sell)));
        return;
    }

    const hadBait = baitStr === '1';
    if (hadBait) consumeItem(user, 'fishing_bait');

    let catchCount = 1;
    if (rodStats.multiChance > 0 && Math.random() < rodStats.multiChance) catchCount = rodStats.multiCount;
    catchCount = Math.min(catchCount, bucket.slots - bucketCount(user));

    const caught = [];
    for (let k = 0; k < catchCount; k++) {
        const id = k === 0 ? itemOnLine : pickItem(tierLoc, rodStats.skip, hadBait && k === 1);
        caught.push(id);
        if (!user.fishBucket) user.fishBucket = [];
        const ex = user.fishBucket.find(e => e.item === id);
        if (ex) ex.quantity++;
        else user.fishBucket.push({ item: id, quantity: 1 });
    }
    await user.save();

    const isMonster = caught.some(id => CATCH_ITEMS[id]?.type === 'monster');
    const lines     = await Promise.all(caught.map(async id => {
        const c     = CATCH_ITEMS[id];
        const price = await getNpcPrice(interaction.guild.id, id, c.value);
        return `${c.emoji} **${c.name}**  ·  $${formatNumber(price)}`;
    }));

    const newCount  = bucketCount(user);
    const sellTotal = await calcSellTotal(interaction.guild.id, user.fishBucket, bucket.sellMultiplier ?? 1);
    const full      = newCount >= bucket.slots;
    const title     = isMonster ? 'Fishing  -  Monster Catch' : catchCount > 1 ? `Fishing  -  ${catchCount}x Catch` : 'Fishing';
    const body      = lines.join('\n') + `\n\n${newCount}/${bucket.slots} in bucket` + (full ? '\nBucket full. Sell before casting again.' : '');

    await msg.edit(buildPanel(title, body, statusFooter(rod, tier, user, bucket), mainButtons(sellTotal)));
}

async function handleCut(interaction) {
    await interaction.deferUpdate();
    const user   = await getUser(interaction.user.id, interaction.guild.id);
    const rod    = getRod(user);
    const bucket = getBucket(user);
    if (!rod || !bucket) return;

    const tier = getTier(user.balance + user.bank);
    const sell = await calcSellTotal(interaction.guild.id, user.fishBucket, bucket.sellMultiplier ?? 1);
    await interaction.message.edit(buildPanel('Fishing', 'Line cut.', statusFooter(rod, tier, user, bucket), mainButtons(sell)));
}

async function handleSell(interaction) {
    await interaction.deferUpdate();
    const user   = await getUser(interaction.user.id, interaction.guild.id);
    const rod    = getRod(user);
    const bucket = getBucket(user);
    const items  = [...(user.fishBucket || [])];
    if (!items.length || !bucket) return;

    const count    = bucketCount(user);
    const isFull   = count >= bucket.slots;
    const fullBonus = isFull ? 1.15 : 1;
    const mult     = (bucket.sellMultiplier ?? 1) * fullBonus;
    const rows  = await Promise.all(
        items
            .sort((a, b) => (CATCH_ITEMS[b.item]?.value ?? 0) - (CATCH_ITEMS[a.item]?.value ?? 0))
            .map(async e => {
                const c     = CATCH_ITEMS[e.item];
                const price = await getNpcPrice(interaction.guild.id, e.item, c?.value ?? 0);
                return `${c?.emoji ?? ''} ${c?.name ?? e.item} x${e.quantity}  $${formatNumber(price * e.quantity)}`;
            })
    );

    let raw = 0;
    for (const e of items) {
        raw += (await getNpcPrice(interaction.guild.id, e.item, CATCH_ITEMS[e.item]?.value ?? 0)) * e.quantity;
    }
    const total = Math.floor(raw * mult);

    await recordSales(interaction.guild.id, items);
    user.fishBucket = [];
    user.balance    = parseFloat((user.balance + total).toFixed(2));
    await user.save();

    const tier      = rod ? getTier(user.balance + user.bank) : TIERS[0];
    const bonusParts = [];
    if (bucket.sellMultiplier > 1) bonusParts.push(`${bucket.name} x${bucket.sellMultiplier}`);
    if (isFull) bonusParts.push('Full bucket +15%');
    const multLine = bonusParts.length ? `\n-# ${bonusParts.join('  ·  ')}` : '';
    const castBtn   = [new ButtonBuilder().setCustomId('fish_cast').setLabel('Cast Again').setStyle(ButtonStyle.Primary)];

    await interaction.message.edit(buildPanel(
        'Fishing  -  Sold',
        rows.join('\n') + `\n\n**Total  $${formatNumber(total)}**${multLine}`,
        `New balance: $${formatNumber(user.balance)}`,
        castBtn
    ));
}

module.exports = { execute, handleCast, handleReel, handleCut, handleSell, CATCH_ITEMS, TIERS };
