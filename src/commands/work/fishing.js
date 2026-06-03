const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { formatNumber } = require('../../utils/format');
const { hasAnyItem, hasItem, consumeItem } = require('../../utils/inventory');
const { ITEMS, ROD_TIERS, BUCKET_TIERS } = require('../shop/items');
const cooldowns = require('../../utils/cooldowns');

const COOLDOWN = 10 * 1000; // 10 seconds between casts

// All catchable items
const CATCH_ITEMS = {
    junk_boot:     { name: 'Old Boot',      emoji: '👢', value: 8,       type: 'junk'    },
    junk_can:      { name: 'Tin Can',       emoji: '🥫', value: 12,      type: 'junk'    },
    junk_seaweed:  { name: 'Seaweed',       emoji: '🌿', value: 5,       type: 'junk'    },
    fish_minnow:   { name: 'Minnow',        emoji: '🐟', value: 60,      type: 'fish'    },
    fish_perch:    { name: 'Perch',         emoji: '🐠', value: 180,     type: 'fish'    },
    fish_bass:     { name: 'Bass',          emoji: '🐡', value: 500,     type: 'fish'    },
    fish_trout:    { name: 'Trout',         emoji: '🐟', value: 1200,    type: 'fish'    },
    fish_salmon:   { name: 'Salmon',        emoji: '🐠', value: 3000,    type: 'fish'    },
    fish_tuna:     { name: 'Tuna',          emoji: '🐡', value: 8000,    type: 'fish'    },
    fish_swordfish:{ name: 'Swordfish',     emoji: '🐬', value: 22000,   type: 'fish'    },
    fish_shark:    { name: 'Shark',         emoji: '🦈', value: 65000,   type: 'fish'    },
    fish_monster:  { name: 'MONSTER Fish!', emoji: '🐉', value: 250000,  type: 'monster' },
};

// [itemId, weight] per location
const TABLES = {
    pond: [
        ['junk_boot', 8], ['junk_can', 10], ['junk_seaweed', 7],
        ['fish_minnow', 40], ['fish_perch', 22], ['fish_bass', 10],
        ['fish_trout', 2], ['fish_monster', 0.3],
    ],
    river: [
        ['junk_can', 5], ['junk_seaweed', 4],
        ['fish_minnow', 15], ['fish_perch', 25], ['fish_bass', 25],
        ['fish_trout', 18], ['fish_salmon', 6], ['fish_monster', 0.5],
    ],
    ocean: [
        ['junk_boot', 2],
        ['fish_bass', 8], ['fish_trout', 15], ['fish_salmon', 22],
        ['fish_tuna', 28], ['fish_swordfish', 18], ['fish_shark', 5],
        ['fish_monster', 1],
    ],
    deepsea: [
        ['fish_salmon', 8], ['fish_tuna', 18], ['fish_swordfish', 25],
        ['fish_shark', 28], ['fish_monster', 3],
    ],
};

const TIERS = [
    { min: 0,       loc: 'pond',    label: 'Pond'     },
    { min: 10000,   loc: 'river',   label: 'River'    },
    { min: 50000,   loc: 'ocean',   label: 'Ocean'    },
    { min: 200000,  loc: 'deepsea', label: 'Deep Sea' },
];

// Rod stats
const ROD_STATS = {
    fishing_rod_wooden:   { skip: 0, snapChance: 0.08, multiChance: 0,    multiCount: 1 },
    fishing_rod_basic:    { skip: 1, snapChance: 0.04, multiChance: 0,    multiCount: 1 },
    fishing_rod_upgraded: { skip: 2, snapChance: 0.02, multiChance: 0.15, multiCount: 2 },
    fishing_rod_super:    { skip: 3, snapChance: 0.005,multiChance: 0.25, multiCount: 3 },
};

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function getTier(wealth) {
    let t = TIERS[0];
    for (const tier of TIERS) { if (wealth >= tier.min) t = tier; }
    return t;
}

function getBucket(user) {
    for (let i = BUCKET_TIERS.length - 1; i >= 0; i--) {
        const id = BUCKET_TIERS[i];
        if (hasItem(user, id)) return { id, ...ITEMS[id] };
    }
    return null;
}

function getRod(user) {
    for (let i = ROD_TIERS.length - 1; i >= 0; i--) {
        const id = ROD_TIERS[i];
        if (hasItem(user, id)) return { id, ...ITEMS[id], stats: ROD_STATS[id] };
    }
    return null;
}

function pickFromTable(loc, skip, useBait) {
    let table = [...TABLES[loc]].slice(skip);
    if (useBait && table.length > 1) {
        table = table.map((e, i) => i === 0 ? [e[0], Math.floor(e[1] / 2)] : e);
    }
    const total = table.reduce((a, e) => a + e[1], 0);
    let r = Math.random() * total;
    for (const [id, w] of table) { r -= w; if (r <= 0) return id; }
    return table[table.length - 1][0];
}

function bucketLine(user, bucket) {
    const count = (user.fishBucket || []).reduce((a, i) => a + i.quantity, 0);
    return `🪣 **${count}/${bucket.slots}** items in bucket`;
}

async function execute(interaction, user) {
    const cdKey = `fish_${interaction.user.id}`;
    const now   = Date.now();

    if (cooldowns.fish.has(cdKey)) {
        const exp = cooldowns.fish.get(cdKey) + COOLDOWN;
        if (now < exp) {
            const s = Math.ceil((exp - now) / 1000);
            return interaction.reply({ content: `⏳ Wait **${s}s** before casting again.`, ephemeral: true });
        }
    }

    const rod    = getRod(user);
    const bucket = getBucket(user);
    if (!rod)    return interaction.reply({ content: '❌ You need a rod.', ephemeral: true });
    if (!bucket) return interaction.reply({ content: '❌ You need a bucket.', ephemeral: true });

    const bucketCount = (user.fishBucket || []).reduce((a, i) => a + i.quantity, 0);
    if (bucketCount >= bucket.slots)
        return interaction.reply({ content: `❌ Your ${bucket.name} is full (${bucketCount}/${bucket.slots}). Use \`/sell\` to sell your catch first.`, ephemeral: true });

    cooldowns.fish.set(cdKey, now);

    // Deduct rod durability
    user.fishRodDurability = (user.fishRodDurability ?? rod.durability) - 1;
    const rodBroke = user.fishRodDurability <= 0;
    if (rodBroke) {
        if (!user.inventory) user.inventory = [];
        user.inventory = user.inventory.filter(i => i.item !== rod.id);
        user.fishRodDurability = 0;
    }
    await user.save();

    const tier     = getTier(user.balance + user.bank);
    const nextTier = TIERS[TIERS.indexOf(tier) + 1];
    const stats    = rod.stats;
    const useBait  = consumeItem(user, 'fishing_bait');
    if (useBait) await user.save();

    // Determine event type: normal fish (93%), bomb (2%), nothing (5%)
    const eventRoll = Math.random();
    const isBomb    = eventRoll < 0.02;
    const isNothing = !isBomb && eventRoll < 0.07;

    const rodDurDisplay = rodBroke
        ? `💔 Your **${rod.name}** broke!`
        : `${rod.emoji} **${rod.name}** (${user.fishRodDurability} casts left)`;

    if (isNothing || rodBroke) {
        const embed = new EmbedBuilder()
            .setTitle('🎣 No bite...')
            .setDescription(
                (rodBroke ? `💔 Your **${rod.name}** broke on this cast! Buy a new one from \`/shop browse\`.\n\n` : '') +
                (isNothing ? 'Nothing on the line this time.\n\n' : '') +
                bucketLine(user, bucket)
            )
            .setColor(0x71717a)
            .setFooter({ text: `${tier.label} | ${rodDurDisplay}` });
        return interaction.reply({ embeds: [embed] });
    }

    // Show the cast embed with appropriate message
    const castDesc = isBomb
        ? `Something's pulling **really** hard... it could be huge, or it could be trouble. 💀`
        : `Something's on the line at the **${tier.label}**! Reel it in!`;

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('fish_reel').setLabel('Reel In').setStyle(ButtonStyle.Primary),
        ...(isBomb ? [new ButtonBuilder().setCustomId('fish_cutline').setLabel('Cut Line').setStyle(ButtonStyle.Danger)] : []),
    );

    const msg = await interaction.reply({
        embeds: [new EmbedBuilder()
            .setTitle(isBomb ? '🤔 Something Big...' : '🎣 Fish On!')
            .setDescription(castDesc + (useBait ? '\n🪱 *Bait active*' : ''))
            .setColor(isBomb ? 0xff8800 : 0xf6ad55)
            .setFooter({ text: `${tier.label} | ${rodDurDisplay}` })],
        components: [buttons],
        fetchReply: true,
    });

    const window = rand(2000, 4000);
    const collector = msg.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id,
        time: window,
        max: 1,
    });

    let acted = false;

    collector.on('collect', async i => {
        acted = true;

        if (i.customId === 'fish_cutline') {
            return i.update({
                embeds: [new EmbedBuilder()
                    .setTitle('✂️ Line Cut')
                    .setDescription(`You cut the line and avoided whatever was down there.\n\n${bucketLine(user, bucket)}`)
                    .setColor(0x71717a)
                    .setFooter({ text: `${tier.label} | ${rodDurDisplay}` })],
                components: [],
            });
        }

        // Reel in
        if (isBomb) {
            // Bomb destroys 1-3 random items from bucket
            const lostItems = [];
            const bucket_ = user.fishBucket || [];
            const toRemove = Math.min(rand(1, 3), bucket_.length);
            for (let n = 0; n < toRemove; n++) {
                if (!bucket_.length) break;
                const idx  = Math.floor(Math.random() * bucket_.length);
                const entry = bucket_[idx];
                entry.quantity--;
                const item = CATCH_ITEMS[entry.item];
                lostItems.push(`${item?.emoji ?? '📦'} ${item?.name ?? entry.item}`);
                if (entry.quantity <= 0) bucket_.splice(idx, 1);
            }
            user.fishBucket = bucket_;
            await user.save();
            return i.update({
                embeds: [new EmbedBuilder()
                    .setTitle('💣 BOMB!')
                    .setDescription(
                        lostItems.length
                            ? `💥 It was a bomb! It destroyed:\n${lostItems.join('\n')}\n\n${bucketLine(user, bucket)}`
                            : `💥 It was a bomb! Luckily your bucket was empty.\n\n${bucketLine(user, bucket)}`
                    )
                    .setColor(0xff0000)
                    .setFooter({ text: `${tier.label} | ${rodDurDisplay}` })],
                components: [],
            });
        }

        // Line snap check
        if (Math.random() < stats.snapChance) {
            return i.update({
                embeds: [new EmbedBuilder()
                    .setTitle('💔 Line Snapped!')
                    .setDescription(`The line snapped and the fish got away!\n\n${bucketLine(user, bucket)}`)
                    .setColor(0xff4444)
                    .setFooter({ text: `${tier.label} | ${rodDurDisplay}` })],
                components: [],
            });
        }

        // Determine how many fish
        let catchCount = 1;
        if (stats.multiChance > 0 && Math.random() < stats.multiChance) {
            catchCount = stats.multiCount;
        }
        // Don't overfill bucket
        const space   = bucket.slots - bucketCount;
        catchCount    = Math.min(catchCount, space);

        const caught = [];
        for (let n = 0; n < catchCount; n++) {
            const itemId = pickFromTable(tier.loc, stats.skip, useBait && n === 0);
            caught.push(itemId);
            if (!user.fishBucket) user.fishBucket = [];
            const existing = user.fishBucket.find(e => e.item === itemId);
            if (existing) existing.quantity++;
            else user.fishBucket.push({ item: itemId, quantity: 1 });
        }
        await user.save();

        const lines = caught.map(id => {
            const c = CATCH_ITEMS[id];
            return `${c.emoji} **${c.name}** (worth ~$${formatNumber(c.value)})`;
        });

        const newCount = (user.fishBucket || []).reduce((a, e) => a + e.quantity, 0);
        const isMonster = caught.some(id => CATCH_ITEMS[id]?.type === 'monster');

        return i.update({
            embeds: [new EmbedBuilder()
                .setTitle(isMonster ? '🐉 MONSTER CATCH!!' : catchCount > 1 ? '🎣 Multi-Catch!' : '🎣 Nice Catch!')
                .setDescription(
                    lines.join('\n') +
                    `\n\n🪣 **${newCount}/${bucket.slots}** in bucket` +
                    (newCount >= bucket.slots ? '\n⚠️ Bucket full! Use `/sell` to sell your catch.' : '')
                )
                .setColor(isMonster ? 0xFFD700 : catchCount > 1 ? 0x00ccff : 0x00cc44)
                .setFooter({ text: `${tier.label} | ${rodDurDisplay}` })],
            components: [],
        });
    });

    collector.on('end', async (_, reason) => {
        if (!acted) {
            await msg.edit({
                embeds: [new EmbedBuilder()
                    .setTitle('🐟 Got Away!')
                    .setDescription(`Too slow - the fish escaped.\n\n${bucketLine(user, bucket)}`)
                    .setColor(0xff3333)
                    .setFooter({ text: `${tier.label} | ${rodDurDisplay}` })],
                components: [],
            }).catch(() => {});
        }
    });
}

module.exports = { execute, TIERS, COOLDOWN, CATCH_ITEMS };
